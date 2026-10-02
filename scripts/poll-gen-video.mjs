#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { callApi } from "./call-api.mjs";

/**
 * gen_video 异步导出：提交任务并轮询 gen_video_status。
 * 依据官方文档 https://docs.jcaigc.cn/docs/gen_video_status.zh.html 实现。
 */

export const TERMINAL_STATUSES = new Set(["completed", "failed"]);

/**
 * 轮询直到终态。
 * @param {string} draftUrl
 * @param {object} options
 */
export async function pollGenVideo(draftUrl, options = {}) {
  const {
    intervalMs = 4_000,
    timeoutMs = 600_000,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onProgress = () => {},
    call = callApi,
    now = () => Date.now(),
  } = options;

  if (typeof draftUrl !== "string" || draftUrl.length === 0) {
    throw new Error("缺少 draft_url");
  }

  const deadline = now() + timeoutMs;
  let attempts = 0;

  for (;;) {
    attempts += 1;
    const status = await call("gen_video_status", { draft_url: draftUrl });
    onProgress(status, attempts);

    const state = status?.status;
    if (TERMINAL_STATUSES.has(state)) {
      return { ...status, attempts };
    }
    if (now() + intervalMs > deadline) {
      throw new Error(
        `轮询超时（已尝试 ${attempts} 次，最后状态：${state ?? "未知"}）。任务可能仍在处理中。`,
      );
    }
    await sleep(intervalMs);
  }
}

function parseArgs(args) {
  const options = {};
  const valued = ["--draft-url", "--api-key", "--interval", "--timeout"];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--submit") {
      options.submit = true;
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
    "剪映小助手 · 视频导出轮询器（gen_video + gen_video_status）",
    "",
    "用法：",
    "  # 只轮询已有任务",
    "  node scripts/poll-gen-video.mjs --draft-url <draft_url>",
    "",
    "  # 先提交导出（收费，需 apiKey），再轮询",
    "  node scripts/poll-gen-video.mjs --draft-url <draft_url> --submit --api-key <UUID>",
    "",
    "可选：",
    "  --interval <毫秒>   轮询间隔，默认 4000（官方建议 3–5 秒）",
    "  --timeout <毫秒>    总超时，默认 600000（10 分钟）",
    "",
    "注意：gen_video 按 0.3 元/分钟计费（SVIP 0.18 元/分钟）。",
  ].join("\n");
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  if (argv.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const draftUrl = argv["draft-url"];
  if (!draftUrl) throw new Error("必须提供--draft-url");

  if (argv.submit) {
    const payload = { draft_url: draftUrl };
    const apiKey = process.env.CAPCUT_MATE_API_KEY || argv["api-key"];
    if (argv["api-key"]) {
      process.stderr.write(
        "警告：--api-key 会暴露在进程列表与命令历史中，请改用环境变量 CAPCUT_MATE_API_KEY。\n",
      );
    }
    if (apiKey) payload.apiKey = apiKey;
    process.stderr.write("正在提交导出任务（gen_video，收费）…\n");
    const submitted = await callApi("gen_video", payload);
    process.stderr.write(`${JSON.stringify(submitted)}\n`);
  }

  const intervalMs = argv.interval ? Number(argv.interval) : 4_000;
  const timeoutMs = argv.timeout ? Number(argv.timeout) : 600_000;

  const result = await pollGenVideo(draftUrl, {
    intervalMs,
    timeoutMs,
    onProgress: (status, attempts) => {
      const pct = typeof status?.progress === "number" ? `${status.progress}%` : "-";
      process.stderr.write(
        `[${attempts}] status=${status?.status ?? "未知"} progress=${pct}\n`,
      );
    },
  });

  if (result.status === "failed") {
    process.stderr.write(
      `导出失败：${result.error_message || "（无错误信息）"}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
