/**
 * 草稿暂存与发布。
 *
 * 剪映的目录监听只收录「一次出现就完整」的新草稿目录：边下载边往正式目录写，
 * 剪映会在文件尚未就绪时跳过该目录，之后只能重启客户端重新索引。
 * 因此在 macOS/Linux 上，下载全程写入草稿根目录下的隐藏暂存目录，全部文件
 * 就绪后再原子改名成正式目录，剪映看到的是一个从第一刻起就完整的草稿。
 *
 * Windows 仍按官方客户端的做法直接写正式目录，并用 robocopy 触发
 * ReadDirectoryChangesW，让剪映无需重启即可感知新草稿（见下载主脚本）。
 *
 * 移植自 capcut-mate/desktop-client/nodeapi/draftStaging.js。
 */

import fs from "node:fs/promises";
import path from "node:path";

/** 暂存根目录名：位于草稿根目录下，以 . 开头，剪映不会把它当作草稿收录。 */
export const STAGING_DIR_NAME = ".capcut-mate-staging";

/** 草稿根目录下的暂存根目录（<草稿根目录>/.capcut-mate-staging） */
export function getStagingRootDir(draftRootDir) {
  return path.join(draftRootDir, STAGING_DIR_NAME);
}

/** 单个草稿的暂存目录（<草稿根目录>/.capcut-mate-staging/<draft_id>） */
export function getStagingDraftDir(draftRootDir, draftId) {
  return path.join(getStagingRootDir(draftRootDir), draftId);
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 把完整就绪的暂存目录原子改名到正式草稿目录。
 *
 * 正式目录已存在（重复下载，或旧版本直接写在正式目录留下的半成品）时，
 * 先把它移到暂存根目录下，发布成功后再删除；改名失败则把原目录放回，
 * 避免用户连旧草稿都丢掉。
 *
 * 暂存目录与正式目录同属草稿根目录，改名在同一文件系统内完成，是原子操作。
 *
 * @param {string} stagingDir 已下载完整的暂存草稿目录
 * @param {string} finalDir 正式草稿目录
 * @returns {Promise<{replacedExisting: boolean, leftoverBackupDir: string|null}>}
 *   leftoverBackupDir 非空表示旧目录没能删除，只留在隐藏目录里，不影响本次发布。
 */
export async function publishStagedDraft(stagingDir, finalDir) {
  const stagingRootDir = path.dirname(stagingDir);
  let backupDir = null;

  if (await pathExists(finalDir)) {
    backupDir = path.join(
      stagingRootDir,
      `${path.basename(finalDir)}.old-${Date.now()}`,
    );
    await fs.rename(finalDir, backupDir);
  }

  try {
    await fs.rename(stagingDir, finalDir);
  } catch (error) {
    // 正式目录已经让位但暂存目录改名失败：把旧草稿放回去，保持可用状态。
    if (backupDir) {
      await fs.rename(backupDir, finalDir).catch(() => {});
    }
    await fs.rmdir(stagingRootDir).catch(() => {});
    throw error;
  }

  let leftoverBackupDir = null;
  if (backupDir) {
    try {
      await fs.rm(backupDir, { recursive: true, force: true });
    } catch {
      leftoverBackupDir = backupDir;
    }
  }

  // 暂存根目录为空时一并清掉；仍有其它草稿在下载时保持不动。
  await fs.rmdir(stagingRootDir).catch(() => {});

  return { replacedExisting: backupDir !== null, leftoverBackupDir };
}

/**
 * Windows 直接写正式目录时，覆盖同名草稿前的备份动作。
 * 备份放在隐藏暂存目录里；下载成功后再删除，失败时保留供用户找回旧草稿。
 */
export async function backupExistingDraft(finalDir, draftRootDir) {
  if (!(await pathExists(finalDir))) return null;
  const stagingRootDir = getStagingRootDir(draftRootDir);
  await fs.mkdir(stagingRootDir, { recursive: true });
  const backupDir = path.join(
    stagingRootDir,
    `${path.basename(finalDir)}.old-${Date.now()}`,
  );
  await fs.rename(finalDir, backupDir);
  return backupDir;
}

/** 删除备份目录；失败时返回备份路径，交由调用方报告。 */
export async function removeBackupDraft(backupDir) {
  if (!backupDir) return null;
  try {
    await fs.rm(backupDir, { recursive: true, force: true });
  } catch {
    return backupDir;
  }
  await fs.rmdir(path.dirname(backupDir)).catch(() => {});
  return null;
}
