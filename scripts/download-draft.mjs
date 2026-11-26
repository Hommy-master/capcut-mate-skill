#!/usr/bin/env node

/**
 * 剪映草稿完整下载器（简创AIGC 版）。
 *
 * 按 capcut-mate/desktop-client 的下载流程移植：
 *   1. get_draft 拉取文件列表；
 *   2. 最多 10 路并发下载，单文件最多 10 次重试，支持 Range 断点续传、
 *      空闲超时与相对劣化看门狗；
 *   3. 改写 draft_content.json / draft_info.json 中的素材路径，把草稿内
 *      http(s) 素材下载到 assets/{videos,audios,images}，再归一化为剪映的
 *      ##_draftpath_placeholder_<UUID>_## 相对路径；
 *   4. 改写 draft_meta_info.json 的草稿名与目录，指向本地正式草稿目录；
 *   5. macOS/Linux 通过隐藏暂存目录 + 原子改名发布；Windows 直接写正式目录，
 *      并用 robocopy 触发剪映的目录发现；全部文件成功后写入草稿目录提示文件；
 *   6. 轮询草稿根目录的 root_meta_info.json，确认剪映已收录该草稿。
 *
 * 域名白名单：草稿链接只接受 jcaigc.cn 域名族。
 *
 * 本技能完全开源免费，后端为开源项目 CapCut Mate（Apache-2.0）：
 *   https://github.com/Hommy-master/capcut-mate
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  extname,
  join,
  posix,
  resolve,
  sep,
  win32,
} from "node:path";
import { pathToFileURL } from "node:url";

import {
  MAX_DOWNLOAD_ATTEMPTS,
  createConcurrencyLimiter,
  downloadBinaryToFile,
  fetchBytesWithRetry,
  mapLimit,
  retryDownloadTask,
} from "./download-engine.mjs";
import {
  isHttpUrl,
  localizeDraftMeta,
  materialLocalDir,
  normalizeDraftContent,
  rewriteDraftPaths,
} from "./draft-paths.mjs";
import {
  ROOT_META_INFO_FILENAME,
  waitForDraftDiscovery,
} from "./draft-discovery.mjs";
import {
  backupExistingDraft,
  getStagingDraftDir,
  pathExists,
  publishStagedDraft,
  removeBackupDraft,
} from "./draft-staging.mjs";
import {
  getMacProtectedFolderName,
  isPermissionError,
  macPermissionHint,
  probeWriteAccess,
} from "./file-permission.mjs";
import { writeDraftReadmeFile } from "./draft-readme.mjs";

/** 官方域名族（含 capcut-mate.jcaigc.cn、cm.jcaigc.cn 等）。 */
const OFFICIAL_DOMAIN = "jcaigc.cn";

/** 官方文档中出现过的两种 get_draft 路径。 */
const OFFICIAL_DRAFT_PATHS = new Set([
  "/openapi/capcut-mate/v1/get_draft",
  "/openapi/v1/get_draft",
]);

const DRAFT_ID_PATTERN = /^[A-Za-z0-9._-]{20,32}$/u;
const MAX_FILE_COUNT = 500;
const MAX_LIST_BYTES = 5 * 1024 * 1024;
/** 草稿 JSON 配置上限（会整体读入内存，不能与素材上限共用）。 */
const MAX_JSON_BYTES = 256 * 1024 * 1024;
/** 单个草稿最多同时下载的文件数 */
const MAX_CONCURRENT_DOWNLOADS = 10;
const DEFAULT_MAX_FILE_MB = 2048;
const DEFAULT_MAX_TOTAL_MB = 8192;

const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/x-msvideo": ".avi",
  "video/x-matroska": ".mkv",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
};

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".heic",
  ".jpe",
]);
const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".m4v",
  ".flv",
]);
const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".aac",
  ".m4a",
  ".flac",
  ".ogg",
  ".wma",
]);

function createLogger(verbose) {
  return {
    info(message) {
      if (verbose) process.stderr.write(`${message}\n`);
    },
    warn(message) {
      process.stderr.write(`${message}\n`);
    },
    always(message) {
      process.stderr.write(`${message}\n`);
    },
  };
}

function isInside(root, target) {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(target);
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${sep}`)
  );
}

function safeJoin(root, parts) {
  const target = resolve(root, ...parts);
  if (!isInside(root, target)) {
    throw new Error(`检测到草稿路径穿越：${target}`);
  }
  return target;
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isOfficialDomainHost(hostname) {
  const host = String(hostname).toLowerCase();
  return host === OFFICIAL_DOMAIN || host.endsWith(`.${OFFICIAL_DOMAIN}`);
}

/** 判断主机是否属于官方域名族。 */
export function isOfficialHost(hostname) {
  return isOfficialDomainHost(hostname);
}

/** 草稿文件链接校验：只接受 jcaigc.cn 域名族，且必须使用 HTTPS。 */
export function requireAllowedUrl(raw, expectedPaths) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`无效链接：${raw}`);
  }

  if (!isOfficialDomainHost(url.hostname)) {
    throw new Error(`仅允许下载 https://${OFFICIAL_DOMAIN} 域名族提供的草稿文件`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`官方草稿链接必须使用 HTTPS：${raw}`);
  }
  if (expectedPaths && !expectedPaths.has(url.pathname)) {
    throw new Error(`草稿链接路径不受支持：${url.pathname}`);
  }
  return url;
}

/** 下载草稿文件时校验每一跳重定向的最终主机。 */
function assertAllowedDraftAssetUrl(raw) {
  requireAllowedUrl(raw);
}

export function parseDraftUrl(raw) {
  const url = requireAllowedUrl(raw, OFFICIAL_DRAFT_PATHS);
  const draftId = url.searchParams.get("draft_id");
  if (
    !draftId ||
    !DRAFT_ID_PATTERN.test(draftId) ||
    draftId === "." ||
    draftId === ".."
  ) {
    throw new Error("草稿链接缺少有效的draft_id");
  }
  return { url, draftId };
}

/**
 * 从文件下载 URL 中截取 <draft_id>/... 的相对路径。
 * 不属于该草稿的链接抛 FOREIGN_FILE，由调用方跳过。
 */
export function relativeDraftPath(fileUrl, draftId) {
  let url;
  try {
    url = new URL(fileUrl);
  } catch {
    throw new Error(`无效链接：${fileUrl}`);
  }
  let decoded;
  try {
    decoded = decodeURIComponent(url.pathname).replaceAll("\\", "/");
  } catch {
    throw new Error(`无效链接：${fileUrl}`);
  }
  if (decoded.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`检测到草稿路径穿越：${fileUrl}`);
  }
  const parts = decoded.split("/").filter(Boolean);
  const index = parts.indexOf(draftId);
  if (index < 0) {
    const error = new Error(`文件链接不属于草稿${draftId}`);
    error.code = "FOREIGN_FILE";
    throw error;
  }
  const relative = parts.slice(index);
  if (
    relative.length < 2 ||
    relative.some(
      (part) =>
        part === "." ||
        part === ".." ||
        part.includes(":") ||
        part.includes("\0"),
    )
  ) {
    throw new Error(`检测到草稿路径穿越：${fileUrl}`);
  }
  return relative;
}

/**
 * 把一个列表项解析成 {downloadUrl, parts}。
 * 支持完整 URL 与裸文件名两种情况（裸文件名需要 --file-base）。
 */
export function resolveFileEntry(entry, draftId, fileBase) {
  if (typeof entry !== "string" || entry.length === 0) {
    throw new Error("草稿文件列表包含非字符串链接");
  }
  if (/^https?:\/\//iu.test(entry)) {
    requireAllowedUrl(entry);
    return { downloadUrl: entry, parts: relativeDraftPath(entry, draftId) };
  }
  if (!fileBase) {
    throw new Error(
      `服务返回的是裸文件名（${entry}），需要 --file-base 指定文件下载基地址。`,
    );
  }
  const name = entry.replaceAll("\\", "/");
  if (
    name.split("/").some((part) => part === "." || part === "..") ||
    /[?#\0]/u.test(name)
  ) {
    throw new Error(`检测到不受支持的草稿文件名：${entry}`);
  }
  const base = fileBase.endsWith("/") ? fileBase : `${fileBase}/`;
  const downloadUrl = new URL(name, base).toString();
  requireAllowedUrl(downloadUrl);
  return { downloadUrl, parts: [draftId, ...name.split("/").filter(Boolean)] };
}

/** 兼容官方几种可能的返回包装：{files}、{code,data:{files}}、{result:{files}}。 */
export function extractFileList(response) {
  if (!response || typeof response !== "object") {
    throw new Error("草稿文件列表响应格式不正确");
  }
  if (
    typeof response.code === "number" &&
    response.code !== 0 &&
    response.code !== 200
  ) {
    const detail = response.detail ?? response.message ?? response.msg;
    throw new Error(
      `获取草稿文件列表失败（code=${response.code}）：${
        typeof detail === "string" ? detail : "未知错误"
      }`,
    );
  }
  const candidates = [
    response.files,
    response.data?.files,
    response.result?.files,
  ];
  const files = candidates.find((item) => Array.isArray(item));
  if (!files) throw new Error("草稿文件列表响应格式不正确");
  return files;
}

export function discoverDraftRoots(
  platform = process.platform,
  homeDirectory = homedir(),
  environment = process.env,
) {
  const candidates = [environment.JIANYING_DRAFT_ROOT];
  if (platform === "win32") {
    const localAppData =
      environment.LOCALAPPDATA ??
      win32.join(homeDirectory, "AppData", "Local");
    candidates.push(
      win32.join(
        localAppData,
        "JianyingPro",
        "User Data",
        "Projects",
        "com.lveditor.draft",
      ),
    );
  } else if (platform === "darwin") {
    candidates.push(
      posix.join(
        homeDirectory,
        "Movies",
        "JianyingPro",
        "User Data",
        "Projects",
        "com.lveditor.draft",
      ),
    );
  }
  return [...new Set(candidates.filter(Boolean))];
}

/** 目录下存在 root_meta_info.json 或 .recycle_bin 子目录时，认为是剪映草稿根目录。 */
async function isConfirmedDraftRoot(dir) {
  try {
    await access(dir, constants.R_OK | constants.W_OK);
  } catch {
    return false;
  }
  try {
    const info = await stat(join(dir, ROOT_META_INFO_FILENAME));
    if (info.isFile()) return true;
  } catch {
    // ignore
  }
  try {
    const info = await stat(join(dir, ".recycle_bin"));
    if (info.isDirectory()) return true;
  } catch {
    // ignore
  }
  return false;
}

function formatRootPermissionError(root, probe) {
  if (process.platform === "darwin" && probe.permissionDenied) {
    return macPermissionHint(getMacProtectedFolderName(root));
  }
  return `无法写入剪映草稿目录：${probe.message || root}`;
}

/**
 * 选出可写的剪映草稿根目录：显式传入 > 环境变量 > 平台默认目录。
 * 默认目录优先选择含 root_meta_info.json / .recycle_bin 的已确认目录，
 * 避免把草稿装进一个随便同名或空目录。
 */
export async function resolveDraftRoot(explicitRoot, log = createLogger(false)) {
  if (explicitRoot) {
    const root = resolve(explicitRoot);
    let statError = null;
    const info = await stat(root).catch((error) => {
      statError = error;
      return null;
    });
    if (!info?.isDirectory()) {
      if (isPermissionError(statError)) {
        throw new Error(macPermissionHint(getMacProtectedFolderName(root)));
      }
      throw new Error(`剪映草稿目录不存在或不是目录：${root}`);
    }
    const probe = await probeWriteAccess(root);
    if (!probe.ok) throw new Error(formatRootPermissionError(root, probe));
    return root;
  }

  const candidates = discoverDraftRoots();
  const existing = [];
  for (const candidate of candidates) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isDirectory()) existing.push(candidate);
  }

  const confirmed = [];
  for (const dir of existing) {
    if (await isConfirmedDraftRoot(dir)) confirmed.push(dir);
  }
  const ordered = [...confirmed, ...existing.filter((dir) => !confirmed.includes(dir))];

  let lastProbe = null;
  let lastProbeDir = "";
  for (const dir of ordered) {
    const probe = await probeWriteAccess(dir);
    if (probe.ok) {
      log.info(`已自动识别剪映草稿目录：${dir}`);
      return dir;
    }
    lastProbe = probe;
    lastProbeDir = dir;
  }

  if (lastProbe?.permissionDenied) {
    throw new Error(formatRootPermissionError(lastProbeDir, lastProbe));
  }

  throw new Error(
    [
      "未找到可写的剪映草稿目录。",
      "请用 --draft-root 或环境变量 JIANYING_DRAFT_ROOT 指定剪映设置中的草稿位置。",
      "常见默认目录：",
      "  Windows: %LOCALAPPDATA%\\JianyingPro\\User Data\\Projects\\com.lveditor.draft",
      "  macOS:   ~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft",
      process.platform === "darwin" && (await pathExists(homedir() + "/Movies"))
        ? "若剪映已安装，请确认当前终端有「影片」文件夹访问权限（系统设置 → 隐私与安全性 → 文件与文件夹）。"
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function createDownloadProgressTracker() {
  const stats = {
    image: 0,
    video: 0,
    audio: 0,
    config: 0,
    success: 0,
    failure: 0,
  };

  return {
    count(category) {
      stats[category] += 1;
    },
    recordSuccess() {
      stats.success += 1;
    },
    recordFailure() {
      stats.failure += 1;
    },
    buildSummaryMessage() {
      const total = stats.image + stats.video + stats.audio + stats.config;
      return (
        `下载完成：共${total}个文件，图片：${stats.image}个，视频：${stats.video}个，` +
        `音频：${stats.audio}个，配置：${stats.config}个，` +
        `成功${stats.success}个，失败${stats.failure}个`
      );
    },
    get failureCount() {
      return stats.failure;
    },
    get totalCount() {
      return stats.image + stats.video + stats.audio + stats.config;
    },
    get stats() {
      return { ...stats };
    },
  };
}

function createByteBudget(maxBytes) {
  let bytes = 0;
  return {
    add(count) {
      bytes += count;
      if (bytes > maxBytes) {
        throw new Error(
          `草稿下载总大小超过限制：${bytes} bytes（上限 ${maxBytes} bytes）`,
        );
      }
    },
    get bytes() {
      return bytes;
    },
  };
}

/** 除图片/视频/音频外均视为配置文件 */
function classifyDraftFile(filePath) {
  const normalized = String(filePath).replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/assets/images/")) return "image";
  if (normalized.includes("/assets/videos/")) return "video";
  if (normalized.includes("/assets/audios/")) return "audio";

  const extension = extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  return "config";
}

function inferMaterialSubDir(materialType, material) {
  if (materialType === "audios") return "audios";
  if (materialType === "videos") {
    return material?.type === "photo" ? "images" : "videos";
  }
  return "misc";
}

function inferExtFromContentType(contentType, fallbackExt = ".bin") {
  if (!contentType || typeof contentType !== "string") return fallbackExt;
  const mime = contentType.split(";")[0].trim().toLowerCase();
  return MIME_TO_EXT[mime] || fallbackExt;
}

function sanitizeFilename(value) {
  if (!value || typeof value !== "string") return "";
  return value
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/[\u0000-\u001f]/g, "_")
    .trim();
}

/** 素材文件名带 URL 短哈希，避免同名素材互相覆盖，且跨运行可续传。 */
function buildMaterialFilename(baseName, urlHash, extension) {
  let base = baseName;
  if (base.toLowerCase().endsWith(extension.toLowerCase())) {
    base = base.slice(0, -extension.length);
  }
  return `${base.slice(0, 100)}_${urlHash}${extension}`;
}

function materialUrlHash(url) {
  return createHash("sha1").update(url).digest("hex").slice(0, 8);
}

async function writeFileAtomic(filePath, data) {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, data);
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function copyFileAtomic(fromPath, toPath) {
  const temporary = `${toPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await copyFile(fromPath, temporary);
    await rename(temporary, toPath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function writeJsonAtomic(filePath, data) {
  await writeFileAtomic(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * 下载草稿内的远程素材（materials.videos / materials.audios 中的 http 路径），
 * 落到 <草稿目录>/assets/{videos,audios,images}，并回写本地绝对路径。
 * 同一 URL 只下载一次；失败时保留原 URL，由归一化把 material_save_mode 置 0。
 */
async function downloadRemoteMaterial(item, listKey, draftDir, context) {
  const subDir = inferMaterialSubDir(listKey, item);
  const category =
    subDir === "images" ? "image" : subDir === "audios" ? "audio" : "video";
  const fallbackExt = listKey === "audios" ? ".mp3" : ".mp4";
  const sourceUrl = item.path;
  const rawBaseName =
    sanitizeFilename(item.material_name || item.name || item.id) || "material";
  const hash = materialUrlHash(sourceUrl);
  const destDir = materialLocalDir(draftDir, subDir);
  const fallbackPath = join(
    destDir,
    buildMaterialFilename(rawBaseName, hash, fallbackExt),
  );

  context.tracker.count(category);
  try {
    const result = await retryDownloadTask(
      () =>
        context.withSlot(() =>
          downloadBinaryToFile(sourceUrl, {
            destPath: fallbackPath,
            resolveDestPath: (headers) => {
              const contentType =
                headers?.get?.("content-type") ?? headers?.["content-type"];
              const extension = inferExtFromContentType(
                contentType,
                fallbackExt,
              );
              return join(
                destDir,
                buildMaterialFilename(rawBaseName, hash, extension),
              );
            },
            maxBytes: context.maxBytes,
          }),
        ),
      {
        onRetry: (error, attempt) => {
          context.log.info(
            `素材下载重试(${attempt}/${MAX_DOWNLOAD_ATTEMPTS})：${sourceUrl} — ${error.message}`,
          );
        },
      },
    );
    context.budget.add(result.size);
    context.tracker.recordSuccess();
    context.log.info(`素材已保存：${result.path}`);
    return result.path;
  } catch (error) {
    // 权限问题要让上层立即中止整批下载，而不是继续下载其余文件
    if (isPermissionError(error)) throw error;
    context.tracker.recordFailure();
    context.log.warn(
      `素材下载失败（已保留远程 URL）：${sourceUrl} — ${error.message}`,
    );
    return sourceUrl;
  }
}

async function localizeRemoteMaterialPaths(materials, draftDir, context) {
  if (!materials || typeof materials !== "object") return;

  const pending = [];
  for (const listKey of ["videos", "audios"]) {
    const list = materials[listKey];
    if (!Array.isArray(list)) continue;

    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      if (!isHttpUrl(item.path)) continue;

      const sourceUrl = item.path;
      if (context.cache.has(sourceUrl)) {
        item.path = context.cache.get(sourceUrl);
        continue;
      }

      let task = context.inflight.get(sourceUrl);
      if (!task) {
        task = downloadRemoteMaterial(item, listKey, draftDir, context);
        context.inflight.set(sourceUrl, task);
        // 防止未等待的 in-flight 任务产生未处理的 rejection
        task.then(
          (localPath) => context.cache.set(sourceUrl, localPath),
          () => {},
        );
      }
      pending.push(
        task.then((localPath) => {
          item.path = localPath;
        }),
      );
    }
  }

  if (pending.length > 0) await Promise.all(pending);
}

/**
 * 下载并改写一个 JSON 文件：
 * - 含 materials 的草稿内容：改写服务端路径、下载远程素材、归一化占位符路径；
 * - draft_meta_info.json：改写草稿名与正式目录路径；
 * - 其余 JSON：原样格式化保存。
 */
async function downloadAndPatchJson({
  entry,
  targetPath,
  draftDir,
  finalDir,
  draftId,
  context,
  withSlot,
}) {
  const bytes = await fetchBytesWithRetry(entry.downloadUrl, {
    validateUrl: assertAllowedDraftAssetUrl,
    maxBytes: MAX_JSON_BYTES,
    maxAttempts: MAX_DOWNLOAD_ATTEMPTS,
    timeoutMs: 30_000,
    deadlineMs: 300_000,
    withSlot,
  });
  context.budget.add(bytes.length);

  let data;
  try {
    data = JSON.parse(stripBom(bytes.toString("utf8")));
  } catch {
    throw new Error("草稿 JSON 文件解析失败");
  }

  if (data && typeof data === "object" && data.materials) {
    rewriteDraftPaths(data, draftId, draftDir);
    await localizeRemoteMaterialPaths(data.materials, draftDir, context);
    const mode = normalizeDraftContent(data, draftDir);
    context.log.info(`已归一化草稿路径，material_save_mode=${mode}`);
  } else if (
    basename(entry.fileName) === "draft_meta_info.json" ||
    basename(targetPath) === "draft_meta_info.json"
  ) {
    localizeDraftMeta(data, finalDir, draftId);
  }

  await writeJsonAtomic(targetPath, data);
}

/** Windows 上「权限异常」多与只读属性有关；下载完成后统一清除只读位。 */
async function ensureWindowsDraftFilesWritable(rootDir) {
  if (process.platform !== "win32" || !rootDir) return;
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      try {
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile()) {
          await chmod(fullPath, 0o666);
        }
      } catch {
        // 跳过无法调整权限的文件
      }
    }
  }
}

/**
 * 触发目录扫描，激活剪映的目录发现机制（仅 Windows 使用）。
 * 原理：用 robocopy 把草稿目录复制到临时目录再删除，触发
 * ReadDirectoryChangesW 变更通知，让剪映无需重启即可感知到新草稿。
 * macOS 不走这里：由暂存目录 + 原子改名发布草稿。
 */
async function triggerDirectoryScan(targetDir) {
  if (!targetDir) return;
  if (process.platform !== "win32") return;

  try {
    await access(targetDir);
  } catch {
    return;
  }

  const tempDir = `${targetDir}.tmp`;
  await new Promise((resolvePromise) => {
    const args = [
      targetDir,
      tempDir,
      "/E",
      "/COPY:DAT",
      "/R:1",
      "/W:1",
      "/NP",
      "/NJH",
      "/NJS",
    ];
    execFile("robocopy", args, { windowsHide: true }, (error) => {
      // robocopy 返回码 0-7 均表示成功或正常状态，8+ 才是错误
      const code = error ? error.code : 0;
      if (typeof code === "number" && code >= 8) {
        process.stderr.write(`警告：触发目录扫描失败，robocopy 返回码 ${code}\n`);
      }
      resolvePromise();
    });
  });

  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch {
    // 清理临时目录失败不影响草稿
  }
}

function discoveryWarning(result) {
  if (!result) return "";
  if (result.reason === "root_meta_missing") {
    return `未找到 ${ROOT_META_INFO_FILENAME}，无法确认剪映是否已发现草稿；打开剪映后会自动扫描草稿目录。`;
  }
  if (result.reason === "not_listed") {
    return (
      `草稿已下载，但剪映未在 ${(result.elapsedMs / 1000).toFixed(1)}s 内收录该草稿；` +
      "剪映未运行时打开后会自动发现，若剪映已开启请重启剪映。"
    );
  }
  if (result.reason === "root_meta_unreadable") {
    return `${ROOT_META_INFO_FILENAME} 暂时无法读取，未能确认剪映是否已发现草稿。`;
  }
  return "";
}

/**
 * 完整下载并安装一个草稿。
 *
 * @param {object} options
 * @param {string} options.draftUrl 草稿链接（带 draft_id）
 * @param {string} [options.draftRoot] 剪映草稿根目录；缺省自动探测
 * @param {string} [options.fileBase] get_draft 返回裸文件名时的下载基地址
 * @param {boolean} [options.replace] 允许覆盖同名草稿
 * @param {number} [options.maxFileMb] 单文件上限
 * @param {number} [options.maxTotalMb] 总下载量上限
 * @param {number} [options.discoveryTimeoutMs] 草稿发现确认超时
 * @param {boolean} [options.verbose] 输出逐文件进度
 * @param {object} [options.log] 自定义日志器（info/warn/always）
 * @returns {Promise<object>} 结构化结果
 */
export async function downloadDraft(options = {}) {
  const {
    draftUrl,
    draftRoot: explicitRoot,
    fileBase,
    replace = false,
    maxFileMb = DEFAULT_MAX_FILE_MB,
    maxTotalMb = DEFAULT_MAX_TOTAL_MB,
    discoveryTimeoutMs = 8000,
    verbose = false,
  } = options;
  const log = options.log ?? createLogger(verbose);

  if (typeof draftUrl !== "string" || draftUrl.length === 0) {
    throw new Error("必须提供草稿链接");
  }

  const { draftId } = parseDraftUrl(draftUrl);
  const root = await resolveDraftRoot(explicitRoot, log);

  const maxFileMbNumber = Number(maxFileMb);
  const maxTotalMbNumber = Number(maxTotalMb);
  const discoveryTimeoutNumber = Number(discoveryTimeoutMs);
  if (!Number.isFinite(maxFileMbNumber) || maxFileMbNumber <= 0) {
    throw new Error("--max-file-mb 必须是正数");
  }
  if (!Number.isFinite(maxTotalMbNumber) || maxTotalMbNumber <= 0) {
    throw new Error("--max-total-mb 必须是正数");
  }
  if (!Number.isFinite(discoveryTimeoutNumber) || discoveryTimeoutNumber < 0) {
    throw new Error("--discovery-timeout 必须是非负数");
  }

  const maxFileBytes = maxFileMbNumber * 1024 * 1024;
  const maxTotalBytes = maxTotalMbNumber * 1024 * 1024;

  const finalDir = join(root, draftId);
  const useStaging = process.platform !== "win32";
  const workDir = useStaging ? getStagingDraftDir(root, draftId) : finalDir;

  if ((await pathExists(finalDir)) && !replace) {
    throw new Error(
      `同名草稿已经存在：${finalDir}\n` +
        "为防止覆盖用户草稿，下载器默认拒绝安装。确认要覆盖后请加 --replace。",
    );
  }

  log.always(`正在获取草稿文件列表：${draftId}`);
  const listBytes = await fetchBytesWithRetry(draftUrl, {
    validateUrl: assertAllowedDraftAssetUrl,
    maxBytes: MAX_LIST_BYTES,
    maxAttempts: 3,
    timeoutMs: 15_000,
    deadlineMs: 30_000,
  });

  let listResponse;
  try {
    listResponse = JSON.parse(stripBom(listBytes.toString("utf8")));
  } catch {
    throw new Error("草稿文件列表不是有效JSON");
  }

  const files = extractFileList(listResponse);
  if (files.length === 0 || files.length > MAX_FILE_COUNT) {
    throw new Error(`草稿文件数量必须在1到${MAX_FILE_COUNT}之间`);
  }

  const entries = [];
  const normalizedTargets = new Set();
  for (const fileEntry of files) {
    let resolved;
    try {
      resolved = resolveFileEntry(fileEntry, draftId, fileBase);
    } catch (error) {
      if (error.code === "FOREIGN_FILE") {
        log.info(`跳过不属于草稿${draftId}的文件：${fileEntry}`);
        continue;
      }
      throw error;
    }
    const normalized = resolved.parts.join("/").toLowerCase();
    if (normalizedTargets.has(normalized)) {
      throw new Error(`草稿文件存在重复目标路径：${resolved.parts.join("/")}`);
    }
    normalizedTargets.add(normalized);
    entries.push({
      ...resolved,
      fileName: resolved.parts.at(-1),
    });
  }

  if (entries.length === 0) {
    throw new Error("草稿文件列表为空");
  }

  const requiredFiles = [
    `${draftId.toLowerCase()}/draft_content.json`,
    `${draftId.toLowerCase()}/draft_meta_info.json`,
  ];
  for (const required of requiredFiles) {
    if (!normalizedTargets.has(required)) {
      throw new Error(`草稿缺少核心文件：${required.split("/").at(-1)}`);
    }
  }

  log.always(`草稿共 ${entries.length} 个文件，开始下载到 ${workDir}`);

  // 文件列表校验通过后再备份同名草稿：列表请求失败时不会动用户原草稿。
  let backupDir = null;
  if (!useStaging && replace && (await pathExists(finalDir))) {
    backupDir = await backupExistingDraft(finalDir, root);
    log.info(`已备份同名草稿：${backupDir}`);
  }

  await mkdir(workDir, { recursive: true });

  const tracker = createDownloadProgressTracker();
  const budget = createByteBudget(maxTotalBytes);
  const withSlot = createConcurrencyLimiter(MAX_CONCURRENT_DOWNLOADS);
  const materialContext = {
    cache: new Map(),
    inflight: new Map(),
    tracker,
    budget,
    withSlot,
    maxBytes: maxFileBytes,
    log,
  };

  let permissionError = null;

  const downloadOne = async (entry) => {
    if (permissionError) return;

    const category = classifyDraftFile(entry.fileName);
    tracker.count(category);
    // entry.parts 以 draft_id 开头，而 workDir 本身就是该草稿目录。
    const targetPath = safeJoin(workDir, entry.parts.slice(1));

    try {
      await mkdir(dirname(targetPath), { recursive: true });

      if (targetPath.toLowerCase().endsWith(".json")) {
        await downloadAndPatchJson({
          entry,
          targetPath,
          draftDir: workDir,
          finalDir,
          draftId,
          context: materialContext,
          withSlot,
        });
      } else {
        const result = await retryDownloadTask(
          () =>
            withSlot(() =>
              downloadBinaryToFile(entry.downloadUrl, {
                destPath: targetPath,
                validateUrl: assertAllowedDraftAssetUrl,
                maxBytes: maxFileBytes,
              }),
            ),
          {
            onRetry: (error, attempt) => {
              log.info(
                `下载重试(${attempt}/${MAX_DOWNLOAD_ATTEMPTS})：${entry.fileName} — ${error.message}`,
              );
            },
          },
        );
        budget.add(result.size);
      }

      tracker.recordSuccess();
      log.info(`已下载：${entry.parts.join("/")}`);
    } catch (error) {
      tracker.recordFailure();
      if (isPermissionError(error)) {
        permissionError = error;
        throw error;
      }
      log.warn(`文件下载失败：${entry.fileName} — ${error.message}`);
    }
  };

  // draft_info.json 延后到所有文件下载完再处理：此时 draft_content.json 已完成
  // 素材本地化与原子写入，可以直接复制，避免复制到半成品或重复下载素材。
  const infoEntries = entries.filter(
    (entry) => basename(entry.fileName) === "draft_info.json",
  );
  const regularEntries = entries.filter(
    (entry) => basename(entry.fileName) !== "draft_info.json",
  );

  try {
    await mapLimit(regularEntries, MAX_CONCURRENT_DOWNLOADS, downloadOne);
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    permissionError = error;
  }

  const downloadDeferredInfo = async (entry) => {
    if (permissionError) return;

    tracker.count("config");
    const targetPath = safeJoin(workDir, entry.parts.slice(1));
    try {
      await mkdir(dirname(targetPath), { recursive: true });
      const contentTarget = safeJoin(workDir, [
        ...entry.parts.slice(1, -1),
        "draft_content.json",
      ]);

      if (await pathExists(contentTarget)) {
        await copyFileAtomic(contentTarget, targetPath);
      } else {
        await downloadAndPatchJson({
          entry,
          targetPath,
          draftDir: workDir,
          finalDir,
          draftId,
          context: materialContext,
          withSlot,
        });
      }
      tracker.recordSuccess();
      log.info(`已生成：${entry.parts.join("/")}`);
    } catch (error) {
      tracker.recordFailure();
      if (isPermissionError(error)) {
        permissionError = error;
        throw error;
      }
      log.warn(`文件下载失败：${entry.fileName} — ${error.message}`);
    }
  };

  if (!permissionError && infoEntries.length > 0) {
    try {
      await mapLimit(infoEntries, MAX_CONCURRENT_DOWNLOADS, downloadDeferredInfo);
    } catch (error) {
      if (!isPermissionError(error)) throw error;
      permissionError = error;
    }
  }

  // 附带提示文件（参考 desktop-client/nodeapi/draftReadme.js）：用户直接打开草稿
  // 文件夹时，一眼知道这是剪映草稿、不是可直接播放的成片。提示文件不是草稿本体，
  // 写失败只记日志，不影响草稿安装。macOS/Linux 写在暂存目录，随原子改名一起发布。
  if (!permissionError && tracker.failureCount === 0) {
    try {
      const readmePath = await writeDraftReadmeFile(workDir);
      log.info(`已写入草稿提示文件：${readmePath}`);
    } catch (error) {
      log.warn(`写入草稿提示文件失败：${error.message}`);
    }
  }

  let published = false;
  let leftoverBackupDir = null;
  let publishError = null;

  if (!permissionError) {
    if (useStaging) {
      // 只有全部文件成功才发布：剪映只收录一次新目录，半成品发布后再补齐
      // 也不会被重新索引；失败时保留暂存目录，重新下载续传补齐后再发布。
      const readyToPublish =
        tracker.failureCount === 0 && (await pathExists(workDir));
      if (readyToPublish) {
        try {
          const publishResult = await publishStagedDraft(workDir, finalDir);
          leftoverBackupDir = publishResult.leftoverBackupDir;
          published = true;
          log.always(`已发布草稿：${finalDir}`);
        } catch (error) {
          publishError = error;
          log.warn(`发布草稿失败：${error.message}`);
        }
      } else {
        log.warn(
          `草稿未完整下载（${tracker.failureCount} 个文件失败），已保留在暂存目录：${workDir}`,
        );
      }
    } else {
      // Windows：保持官方客户端流程（直接写正式目录 + robocopy 触发扫描）。
      published = true;
      await ensureWindowsDraftFilesWritable(workDir);
      await triggerDirectoryScan(workDir);
      if (backupDir && tracker.failureCount === 0) {
        leftoverBackupDir = await removeBackupDraft(backupDir);
        backupDir = leftoverBackupDir;
      }
    }
  }

  if (permissionError) {
    const message = formatRootPermissionError(root, {
      permissionDenied: isPermissionError(permissionError),
      message: permissionError.message,
    });
    log.warn(`${message}（${permissionError.message}）`);
  }

  let discovery = null;
  if (published) {
    try {
      discovery = await waitForDraftDiscovery(finalDir, {
        draftRootDir: root,
        draftId,
        timeoutMs: discoveryTimeoutNumber,
      });
    } catch (error) {
      discovery = {
        discovered: false,
        reason: "error",
        elapsedMs: 0,
        error: String(error?.message || error),
      };
    }

    if (discovery.discovered) {
      log.always(
        `剪映已发现草稿 ${draftId}（${(discovery.elapsedMs / 1000).toFixed(1)}s）`,
      );
    } else {
      const warning = discoveryWarning(discovery);
      if (warning) log.warn(warning);
    }
  }

  const failureCount = tracker.failureCount;
  const summary = tracker.buildSummaryMessage();
  let message;
  if (permissionError) {
    message = `安装中止：${permissionError.message}`;
  } else if (publishError) {
    message =
      `草稿 ${draftId} 已下载完整，但发布到 ${finalDir} 失败：${publishError.message}；` +
      `文件已保留在暂存目录 ${workDir}，可重新运行同一命令重试发布。`;
  } else if (published) {
    message =
      failureCount === 0
        ? `草稿 ${draftId} 已安装到 ${finalDir}。${summary}`
        : `草稿 ${draftId} 已写入 ${finalDir}，但有 ${failureCount} 个文件失败。${summary}`;
  } else {
    message =
      `草稿 ${draftId} 未完整下载（${failureCount} 个文件失败），` +
      `已保留在暂存目录 ${workDir}；重新运行同一命令会续传未完成的文件。`;
  }

  const result = {
    installed: published && !permissionError,
    draftRoot: root,
    draftId,
    platform: process.platform,
    published,
    files: {
      total: tracker.totalCount,
      ...tracker.stats,
    },
    downloadedBytes: budget.bytes,
    jianyingDiscovered: discovery ? Boolean(discovery.discovered) : null,
    discoveryReason: discovery?.reason ?? null,
    message,
  };

  if (published) {
    result.draftDirectory = finalDir;
  } else {
    result.stagingDirectory = workDir;
  }
  if (leftoverBackupDir || backupDir) {
    result.backupDirectory = leftoverBackupDir || backupDir;
  }
  if (permissionError) {
    result.error = permissionError.message;
  } else if (publishError) {
    result.error = publishError.message;
  }

  return result;
}

function parseArgs(args) {
  const options = {};
  const valued = [
    "--draft-url",
    "--draft-root",
    "--file-base",
    "--work-dir",
    "--max-file-mb",
    "--max-total-mb",
    "--discovery-timeout",
  ];
  const flags = ["--replace", "--verbose"];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (flags.includes(argument)) {
      options[argument.slice(2)] = true;
      continue;
    }
    if (valued.includes(argument)) {
      const value = args[index + 1];
      if (!value) throw new Error(`${argument}缺少参数`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`未知参数：${argument}`);
  }
  return options;
}

function usage() {
  return [
    "剪映小助手草稿下载器（简创AIGC 版）",
    "",
    "用法：",
    "  node scripts/download-draft.mjs --draft-url <草稿下载链接>",
    "  node scripts/download-draft.mjs --draft-url <草稿下载链接> --draft-root <剪映草稿目录>",
    "",
    "可选：",
    "  --draft-root <目录>        指定剪映草稿根目录（也可用 JIANYING_DRAFT_ROOT）",
    "  --file-base <URL>          get_draft 返回裸文件名时，指定文件下载基地址",
    "  --replace                  允许覆盖同名草稿（默认拒绝）",
    "  --max-file-mb <MB>         单文件大小上限，默认 2048",
    "  --max-total-mb <MB>        总下载量上限，默认 8192",
    "  --discovery-timeout <毫秒> 等待剪映收录草稿的时间，默认 8000",
    "  --verbose                  输出逐文件下载进度",
    "",
    "下载流程：并发下载 → 本地化远程素材 → 归一化占位符路径 →",
    "暂存目录原子发布（macOS/Linux）或 robocopy 触发扫描（Windows）→",
    "轮询 root_meta_info.json 确认剪映已发现草稿。",
    "",
    "完全开源免费 · 后端 CapCut Mate：https://github.com/Hommy-master/capcut-mate",
  ].join("\n");
}

/**
 * 命令行入口；供 install-draft.mjs 兼容调用。
 */
export async function runDownloadCli(
  args = process.argv.slice(2),
  { stdout = process.stdout, stderr = process.stderr } = {},
) {
  const options = parseArgs(args);
  if (options.help) {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (!options["draft-url"]) throw new Error("必须提供--draft-url");
  if (options["work-dir"]) {
    stderr.write(
      "提示：--work-dir 已不再使用；下载器直接在草稿根目录的隐藏暂存目录中续传。\n",
    );
  }

  const result = await downloadDraft({
    draftUrl: options["draft-url"],
    draftRoot: options["draft-root"],
    fileBase: options["file-base"],
    replace: Boolean(options.replace),
    verbose: Boolean(options.verbose),
    maxFileMb: options["max-file-mb"]
      ? Number(options["max-file-mb"])
      : undefined,
    maxTotalMb: options["max-total-mb"]
      ? Number(options["max-total-mb"])
      : undefined,
    discoveryTimeoutMs: options["discovery-timeout"]
      ? Number(options["discovery-timeout"])
      : undefined,
  });

  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.installed || result.files.failure > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDownloadCli().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}

export const __testing = {
  classifyDraftFile,
  inferExtFromContentType,
  buildMaterialFilename,
  createDownloadProgressTracker,
  isInside,
  safeJoin,
};
