#!/usr/bin/env node

import { constants } from "node:fs";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import {
  basename,
  dirname,
  join,
  posix,
  resolve,
  sep,
  win32,
} from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 剪映小助手草稿安装器。
 * 域名白名单与响应结构与官方文档 https://docs.jcaigc.cn 对齐。
 *
 * 本技能完全开源免费，后端为开源项目 CapCut Mate（Apache-2.0）：
 *   https://github.com/Hommy-master/capcut-mate
 * 自部署实例的草稿 URL 不在官方域名族下，需显式声明允许的主机（逗号分隔）：
 *   CAPCUT_MATE_EXTRA_HOSTS=localhost,my-host.example.com node scripts/install-draft.mjs ...
 */

/** 官方域名族（含 capcut-mate.jcaigc.cn、cm.jcaigc.cn 等）。 */
const OFFICIAL_DOMAIN = "jcaigc.cn";

/** 用户显式声明的自部署主机白名单（精确匹配，不做后缀匹配，避免被绕过）。 */
const EXTRA_HOSTS = new Set(
  String(process.env.CAPCUT_MATE_EXTRA_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

/** 官方文档中出现过的两种 get_draft 路径。 */
const OFFICIAL_DRAFT_PATHS = new Set([
  "/openapi/capcut-mate/v1/get_draft",
  "/openapi/v1/get_draft",
]);

const DRAFT_ID_PATTERN = /^[A-Za-z0-9._-]{20,32}$/u;
const MAX_FILE_COUNT = 500;
const MAX_LIST_BYTES = 5 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

function isInside(root, target) {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(target);
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${sep}`)
  );
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

/** 判断主机是否属于官方域名族，或用户显式声明的自部署实例。 */
export function isOfficialHost(hostname) {
  const host = String(hostname).toLowerCase();
  if (host === OFFICIAL_DOMAIN || host.endsWith(`.${OFFICIAL_DOMAIN}`)) {
    return true;
  }
  // 自部署主机必须精确匹配，不接受子域名后缀，防止 CAPCUT_MATE_EXTRA_HOSTS=evil.com 被绕过。
  return EXTRA_HOSTS.has(host);
}

function requireOfficialUrl(raw, expectedPaths) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`无效链接：${raw}`);
  }
  if (url.protocol !== "https:" || !isOfficialHost(url.hostname)) {
    throw new Error(`仅允许下载 https://${OFFICIAL_DOMAIN} 域名族提供的草稿文件`);
  }
  if (expectedPaths && !expectedPaths.has(url.pathname)) {
    throw new Error(`草稿链接路径不受支持：${url.pathname}`);
  }
  return url;
}

export function parseOfficialDraftUrl(raw) {
  const url = requireOfficialUrl(raw, OFFICIAL_DRAFT_PATHS);
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

export function relativeDraftPath(fileUrl, draftId) {
  let rawDecoded;
  try {
    rawDecoded = decodeURIComponent(fileUrl).replaceAll("\\", "/");
  } catch {
    throw new Error(`无效链接：${fileUrl}`);
  }
  if (rawDecoded.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`检测到草稿路径穿越：${fileUrl}`);
  }
  const url = requireOfficialUrl(fileUrl);
  const decoded = decodeURIComponent(url.pathname).replaceAll("\\", "/");
  const parts = decoded.split("/").filter(Boolean);
  const index = parts.indexOf(draftId);
  if (index < 0) {
    throw new Error(`文件链接不属于草稿${draftId}`);
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

function safeJoin(root, parts) {
  const target = resolve(root, ...parts);
  if (!isInside(root, target)) {
    throw new Error(`检测到草稿路径穿越：${target}`);
  }
  return target;
}

export function discoverDraftRoots(
  platform = process.platform,
  homeDirectory = homedir(),
  environment = process.env,
) {
  const candidates = [
    environment.JIANYING_DRAFT_ROOT,
    environment.CAPCUT_DRAFT_ROOT,
  ];
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

function rewritePaths(value, sourceRoot, targetRoot) {
  if (Array.isArray(value)) {
    for (const item of value) rewritePaths(item, sourceRoot, targetRoot);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const key of ["path", "media_path"]) {
    const candidate = value[key];
    if (typeof candidate !== "string") continue;
    if (candidate.toLowerCase().startsWith(sourceRoot.toLowerCase())) {
      const relative = candidate
        .slice(sourceRoot.length)
        .replace(/^[\\/]+/u, "");
      value[key] = join(targetRoot, relative);
    }
  }
  for (const child of Object.values(value)) {
    rewritePaths(child, sourceRoot, targetRoot);
  }
}

async function patchInstalledDraft(directory, sourceRoot, targetRoot, draftRoot) {
  const contentPath = join(directory, "draft_content.json");
  if (await pathExists(contentPath)) {
    const content = JSON.parse(await readFile(contentPath, "utf8"));
    rewritePaths(content, sourceRoot, targetRoot);
    await writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  }

  const metaPath = join(directory, "draft_meta_info.json");
  if (await pathExists(metaPath)) {
    const meta = JSON.parse(await readFile(metaPath, "utf8"));
    meta.draft_name = basename(targetRoot);
    meta.draft_fold_path = targetRoot;
    meta.draft_root_path = draftRoot;
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  }
}

export async function installDraftDirectory(sourceDirectory, draftRoot) {
  const source = resolve(sourceDirectory);
  const sourceInfo = await stat(source);
  if (!sourceInfo.isDirectory()) throw new Error("下载结果不是草稿目录");

  const root = resolve(draftRoot);
  const rootInfo = await stat(root);
  if (!rootInfo.isDirectory()) throw new Error("剪映草稿路径不是目录");
  await access(root, constants.W_OK);

  const draftId = basename(source);
  if (!DRAFT_ID_PATTERN.test(draftId)) throw new Error("草稿目录名不是有效draft_id");
  const target = join(root, draftId);
  if (!isInside(root, target)) throw new Error("目标草稿路径越界");
  if (await pathExists(target)) throw new Error(`同名草稿已经存在：${target}`);

  const temporary = join(
    root,
    `.${draftId}.installing-${process.pid}-${Date.now()}`,
  );
  if (!isInside(root, temporary)) throw new Error("临时安装路径越界");
  try {
    await cp(source, temporary, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    await patchInstalledDraft(temporary, source, target, root);
    await rename(temporary, target);
    return target;
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

async function fetchBytes(
  url,
  fetchImpl = fetch,
  maxBytes = MAX_SINGLE_FILE_BYTES,
) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { accept: "application/json, application/octet-stream" },
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (response.url) requireOfficialUrl(response.url);
      const declaredSize = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
        throw new Error(`文件超过大小限制：${declaredSize} bytes`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > maxBytes) {
        throw new Error(`文件超过大小限制：${bytes.length} bytes`);
      }
      return bytes;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `下载失败：${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function rewriteHostedPaths(value, jsonDirectory, draftId) {
  if (Array.isArray(value)) {
    for (const item of value) rewriteHostedPaths(item, jsonDirectory, draftId);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const key of ["path", "media_path"]) {
    const candidate = value[key];
    if (typeof candidate !== "string") continue;
    const parts = candidate.replaceAll("\\", "/").split("/").filter(Boolean);
    const index = parts.indexOf(draftId);
    if (index >= 0 && parts.length > index + 1) {
      value[key] = join(jsonDirectory, ...parts.slice(index + 1));
    }
  }
  for (const child of Object.values(value)) {
    rewriteHostedPaths(child, jsonDirectory, draftId);
  }
}

/** 兼容官方两种可能的返回包装：{files} 与 {code,data:{files}}。 */
export function extractFileList(response) {
  if (!response || typeof response !== "object") {
    throw new Error("草稿文件列表响应格式不正确");
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

/**
 * 把一个列表项解析成 {downloadUrl, parts}。
 * 支持完整 URL 与裸文件名两种情况。
 */
export function resolveFileEntry(entry, draftId, fileBase) {
  if (typeof entry !== "string" || entry.length === 0) {
    throw new Error("草稿文件列表包含非字符串链接");
  }
  if (/^https?:\/\//iu.test(entry)) {
    return { downloadUrl: entry, parts: relativeDraftPath(entry, draftId) };
  }
  if (!fileBase) {
    throw new Error(
      `服务返回的是裸文件名（${entry}），需要 --file-base 指定文件下载基地址。`,
    );
  }
  const name = entry.replaceAll("\\", "/");
  if (name.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`检测到草稿路径穿越：${entry}`);
  }
  const base = fileBase.endsWith("/") ? fileBase : `${fileBase}/`;
  const downloadUrl = new URL(name, base).toString();
  return { downloadUrl, parts: [draftId, ...name.split("/").filter(Boolean)] };
}

export async function downloadDraft(
  draftUrl,
  outputDirectory,
  { fetchImpl = fetch, fileBase } = {},
) {
  const { draftId } = parseOfficialDraftUrl(draftUrl);
  const rawList = await fetchBytes(draftUrl, fetchImpl, MAX_LIST_BYTES);
  let response;
  try {
    response = JSON.parse(rawList.toString("utf8"));
  } catch {
    throw new Error("草稿文件列表不是有效JSON");
  }
  const files = extractFileList(response);
  if (files.length === 0 || files.length > MAX_FILE_COUNT) {
    throw new Error(`草稿文件数量必须在1到${MAX_FILE_COUNT}之间`);
  }

  const entries = [];
  const normalizedTargets = new Set();
  for (const fileEntry of files) {
    const { downloadUrl, parts } = resolveFileEntry(fileEntry, draftId, fileBase);
    const normalized = parts.join("/").toLowerCase();
    if (normalizedTargets.has(normalized)) {
      throw new Error(`草稿文件存在重复目标路径：${parts.join("/")}`);
    }
    normalizedTargets.add(normalized);
    entries.push({ downloadUrl, parts });
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

  const outputRoot = resolve(outputDirectory);
  await mkdir(outputRoot, { recursive: true });
  const temporary = safeJoin(outputRoot, [`.download-${draftId}`]);
  const finalDirectory = safeJoin(outputRoot, [draftId]);
  if (await pathExists(finalDirectory)) {
    throw new Error(`下载目录已经存在：${finalDirectory}`);
  }
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: false });

  try {
    let totalBytes = 0;
    for (const { downloadUrl, parts } of entries) {
      const target = safeJoin(temporary, parts);
      const finalTarget = safeJoin(outputRoot, parts);
      const raw = await fetchBytes(downloadUrl, fetchImpl);
      totalBytes += raw.length;
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new Error("草稿下载总大小超过1GB限制");
      }
      await mkdir(dirname(target), { recursive: true });
      if (target.toLowerCase().endsWith(".json")) {
        try {
          const data = JSON.parse(raw.toString("utf8"));
          rewriteHostedPaths(data, dirname(finalTarget), draftId);
          await writeFile(target, `${JSON.stringify(data, null, 2)}\n`, "utf8");
        } catch (error) {
          if (error instanceof SyntaxError) await writeFile(target, raw);
          else throw error;
        }
      } else {
        await writeFile(target, raw);
      }
    }
    const downloaded = join(temporary, draftId);
    if (!(await pathExists(downloaded))) throw new Error("草稿文件列表为空");
    await rename(downloaded, finalDirectory);
    return finalDirectory;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function findWritableDraftRoot(candidates) {
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (!info.isDirectory()) continue;
      await access(candidate, constants.W_OK);
      return candidate;
    } catch {
      // 继续检查下一个候选目录。
    }
  }
  return undefined;
}

function parseArgs(args) {
  const options = {};
  const valued = ["--draft-url", "--draft-root", "--work-dir", "--file-base"];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
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
    "剪映小助手草稿安装器（简创AIGC 版）",
    "",
    "用法：",
    "  node scripts/install-draft.mjs --draft-url <草稿下载链接>",
    "  node scripts/install-draft.mjs --draft-url <草稿下载链接> --draft-root <剪映草稿目录>",
    "",
    "可选：",
    "  --file-base <URL>   当 get_draft 返回裸文件名时，指定文件下载基地址",
    "  --work-dir <目录>    指定下载中转目录",
    "",
    "也可设置环境变量 JIANYING_DRAFT_ROOT 指定剪映草稿目录。",
    "安装器不会覆盖同名草稿。",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!options["draft-url"]) throw new Error("必须提供--draft-url");

  const draftRoot =
    options["draft-root"] ??
    (await findWritableDraftRoot(discoverDraftRoots()));
  if (!draftRoot) {
    throw new Error(
      "未找到可写的剪映草稿目录，请使用--draft-root或JIANYING_DRAFT_ROOT指定",
    );
  }
  const workRoot = options["work-dir"]
    ? resolve(options["work-dir"])
    : await mkdtemp(join(tmpdir(), "jianying-assistant-"));
  const removeWorkRoot = !options["work-dir"];

  try {
    const downloaded = await downloadDraft(options["draft-url"], workRoot, {
      fileBase: options["file-base"],
    });
    const installed = await installDraftDirectory(downloaded, draftRoot);
    process.stdout.write(
      `${JSON.stringify({ installed: true, draftDirectory: installed }, null, 2)}\n`,
    );
  } finally {
    if (removeWorkRoot) {
      await rm(workRoot, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
