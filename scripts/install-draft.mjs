#!/usr/bin/env node

/**
 * 兼容入口：旧版安装器已并入 download-draft.mjs。
 *
 * 旧参数仍然可用：--draft-url、--draft-root、--file-base。
 * --work-dir 会被忽略（新下载器直接在草稿根目录的隐藏暂存目录中续传）。
 *
 * 新文档见 references/download-draft.md。
 */

import { pathToFileURL } from "node:url";

import { downloadDraft, runDownloadCli } from "./download-draft.mjs";

export { downloadDraft };
export {
  parseDraftUrl,
  resolveFileEntry,
  extractFileList,
  discoverDraftRoots,
  isOfficialHost,
} from "./download-draft.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDownloadCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
