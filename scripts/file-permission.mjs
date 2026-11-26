/**
 * 文件系统权限检测（macOS TCC / 通用 EPERM）。
 *
 * macOS 对「影片」「桌面」「文稿」「下载」等用户目录有 TCC 保护：
 * 未授权时真实写入会返回 EPERM / EACCES，但 `fs.access` 仍可能返回成功，
 * 因此这里用「创建临时目录 + 写探针文件」来判断目录是否真的可写。
 *
 * 移植自 capcut-mate/desktop-client/nodeapi/filePermission.js。
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PERMISSION_ERROR_CODES = new Set(["EPERM", "EACCES"]);

/** macOS TCC 保护的用户目录 → 中文名称 */
const MAC_PROTECTED_FOLDERS = {
  Desktop: "桌面",
  Documents: "文稿",
  Downloads: "下载",
  Movies: "影片",
  Music: "音乐",
  Pictures: "图片",
};

export function isPermissionError(error) {
  if (!error) return false;
  // 带 HTTP 响应的网络错误不是文件系统权限问题
  if (error.response) return false;
  const code = String(error.code || "");
  if (PERMISSION_ERROR_CODES.has(code)) return true;
  const message = String(error.message || "");
  return /operation not permitted|permission denied|access is denied/i.test(message);
}

/**
 * 判断目录是否位于 macOS 受保护的用户目录下，返回中文目录名（如「影片」）。
 * 不在受保护目录下时返回空字符串。
 */
export function getMacProtectedFolderName(targetDir, homeDir = os.homedir()) {
  if (!targetDir || typeof targetDir !== "string") return "";
  if (process.platform !== "darwin") return "";

  const relative = path.relative(homeDir, targetDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return "";
  }
  const topLevel = relative.split(path.sep)[0];
  return MAC_PROTECTED_FOLDERS[topLevel] || "";
}

/**
 * 通过真实写入验证目录可写。
 * 成功时返回 { ok: true }；失败时附带 permissionDenied / code / message。
 * @param {string} targetDir
 */
export async function probeWriteAccess(targetDir) {
  if (!targetDir || typeof targetDir !== "string") {
    return {
      ok: false,
      permissionDenied: false,
      code: "EINVAL",
      message: "目标目录为空",
      targetDirectory: targetDir || "",
    };
  }

  let probeDir = "";
  try {
    await fs.mkdir(targetDir, { recursive: true });
    probeDir = await fs.mkdtemp(path.join(targetDir, ".capcut-mate-perm-"));
    await fs.writeFile(path.join(probeDir, "probe"), "ok", {
      encoding: "utf8",
      mode: 0o600,
    });
    return {
      ok: true,
      permissionDenied: false,
      targetDirectory: targetDir,
    };
  } catch (error) {
    return {
      ok: false,
      permissionDenied: isPermissionError(error),
      code: error?.code || "UNKNOWN",
      message: error?.message || String(error),
      targetDirectory: targetDir,
    };
  } finally {
    if (probeDir) {
      try {
        await fs.rm(probeDir, { recursive: true, force: true });
      } catch {
        // 探针清理失败不影响检测结果
      }
    }
  }
}

/** macOS 授权引导文案，供命令行直接输出。 */
export function macPermissionHint(protectedFolder) {
  const folderText = protectedFolder ? `（位于 macOS「${protectedFolder}」）` : "";
  return (
    `无法写入剪映草稿目录${folderText}。\n` +
    "请在「系统设置 → 隐私与安全性 → 文件与文件夹」中允许当前终端或宿主应用访问该文件夹，" +
    "然后重新运行下载命令。"
  );
}
