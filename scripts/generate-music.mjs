#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 音乐生成网关调用器。
 *
 * 独立网关：https://api.jcaigc.cn/v1
 * 鉴权：Authorization: Bearer <apiKey>
 * 提交：POST /music/generations；轮询：GET /music/generations/{task_id}
 *
 * 默认模型：minimax-music-2.0（0.25 元/次）。
 * 按次计费，调用前请确认 apiKey 与任务数量。
 */

export const DEFAULT_BASE_URL = "https://api.jcaigc.cn/v1";
export const DEFAULT_MODEL = "minimax-music-2.0";

const MODEL_PRICES = {
  "minimax-music-2.0": 0.25,
  "minimax-music-3.0": 1,
};

export const BASE_URL = DEFAULT_BASE_URL;

function usage() {
  return [
    "简创AIGC 音乐生成网关调用器",
    "",
    "用法：",
    "  node scripts/generate-music.mjs --api-key <uuid> --prompt '<风格提示词>'",
    "  node scripts/generate-music.mjs --api-key <uuid> --prompt '...' --lyrics '<歌词>' --output song.mp3",
    "  node scripts/generate-music.mjs --api-key <uuid> --model minimax-music-3.0 --prompt '...'",
    "",
    `默认模型：${DEFAULT_MODEL}（0.25 元/次）。`,
    "可选 minimax-music-3.0（1 元/次，支持 sample_rate / bitrate）。",
    "一次任务生成一首完整的歌；失败全额退还，expired 不退预扣费用。",
    "",
    "apiKey 也可放在环境变量 JCAIGC_API_KEY。",
    `基地址：${BASE_URL}`,
  ].join("\n");
}

function parseArgs(args) {
  const options = {};
  const valued = [
    "--api-key",
    "--model",
    "--prompt",
    "--lyrics",
    "--format",
    "--output-format",
    "--sample-rate",
    "--bitrate",
    "--data",
    "--data-file",
    "--output",
    "--timeout",
    "--interval",
  ];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--models") {
      options.models = true;
      continue;
    }
    if (argument === "--submit-only") {
      options["submit-only"] = true;
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

function requireApiKey(options) {
  const apiKey = options["api-key"] || process.env.JCAIGC_API_KEY;
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("需要 --api-key 或环境变量 JCAIGC_API_KEY");
  }
  return apiKey;
}

function extractError(result, status) {
  if (result && typeof result === "object") {
    const error = result.error;
    if (error && typeof error === "object") {
      const message = error.message ?? error.type ?? JSON.stringify(error);
      const code = error.code ? ` [${error.code}]` : "";
      return `HTTP ${status}${code}：${message}`;
    }
    const message = result.message ?? result.detail;
    if (typeof message === "string" && message.length > 0) {
      return `HTTP ${status}：${message}`;
    }
  }
  return `HTTP ${status}`;
}

async function requestJson(path, apiKey, init = {}, timeoutMs = 60_000) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`接口返回的不是JSON（HTTP ${response.status}）`);
  }
  if (!response.ok) {
    throw new Error(extractError(result, response.status));
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollTask(taskId, apiKey, timeoutMs, intervalMs) {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < timeoutMs) {
    await sleep(intervalMs);
    const result = await requestJson(
      `/music/generations/${encodeURIComponent(taskId)}`,
      apiKey,
      { method: "GET" },
    );
    const status = result.status ?? "unknown";
    const progress = result.progress ?? 0;
    const label = `${status} ${progress}%`;
    if (label !== lastStatus) {
      process.stderr.write(`任务状态：${label}\n`);
      lastStatus = label;
    }
    if (status === "succeeded") return result;
    if (status === "failed") {
      const message = result.error?.message ?? result.error_message ?? "未知错误";
      throw new Error(`音乐生成失败：${message}`);
    }
    if (status === "expired") {
      throw new Error("任务已过期（30 分钟内未取走结果），预扣费用不退还");
    }
  }
  throw new Error(
    `等待超时（${Math.round(timeoutMs / 1000)} 秒）。任务可能仍在后台，可稍后用 task_id 继续查询；` +
      "超过 30 分钟会变成 expired 且不退预扣费用",
  );
}

async function downloadMusic(url, outputPath, format) {
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok) {
    throw new Error(`下载音乐失败（HTTP ${response.status}）：${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  let target = outputPath;
  const info = await stat(outputPath).catch(() => null);
  if (info?.isDirectory() || outputPath.endsWith("/")) {
    await mkdir(outputPath, { recursive: true });
    target = join(outputPath, `music-${Date.now()}.${format}`);
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
  }
  await writeFile(target, buffer);
  return target;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const apiKey = requireApiKey(options);

  if (options.models) {
    const result = await requestJson("/models", apiKey);
    const models = Array.isArray(result.data) ? result.data : [];
    for (const model of models) {
      process.stdout.write(`${model.id ?? JSON.stringify(model)}\n`);
    }
    return;
  }

  if (options.data && options["data-file"]) {
    throw new Error("--data和--data-file不能同时使用");
  }
  let payload = {};
  if (options.data || options["data-file"]) {
    const raw = options["data-file"]
      ? await readFile(options["data-file"], "utf8")
      : options.data;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error("请求数据不是有效JSON");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("请求数据必须是JSON对象");
    }
  }

  if (options.model) payload.model = options.model;
  if (!payload.model) payload.model = DEFAULT_MODEL;
  if (typeof payload.model !== "string" || payload.model.length === 0) {
    throw new Error("model 必须是非空字符串");
  }
  const price = MODEL_PRICES[payload.model];
  if (price == null) {
    throw new Error(
      `不支持的音乐模型：${payload.model}；可选：${Object.keys(MODEL_PRICES).join(" / ")}`,
    );
  }

  if (options.prompt) payload.prompt = options.prompt;
  if (options.lyrics) payload.lyrics = options.lyrics;
  const format =
    options.format ||
    options["output-format"] ||
    payload.output_format ||
    payload.format ||
    "mp3";
  if (!["mp3", "wav", "flac"].includes(format)) {
    throw new Error("--format 只能是 mp3 / wav / flac");
  }
  payload.output_format = format;

  if (options["sample-rate"]) payload.sample_rate = Number(options["sample-rate"]);
  if (options.bitrate) payload.bitrate = Number(options.bitrate);
  if (payload.sample_rate != null) payload.sample_rate = Number(payload.sample_rate);
  if (payload.bitrate != null) payload.bitrate = Number(payload.bitrate);
  if (
    payload.model !== "minimax-music-3.0" &&
    (payload.sample_rate != null || payload.bitrate != null)
  ) {
    throw new Error("sample_rate / bitrate 仅 minimax-music-3.0 支持");
  }
  if (!payload.prompt) {
    throw new Error("缺少风格提示词：请提供 --prompt 或 --data 中的 prompt");
  }

  process.stderr.write(
    `模型：${payload.model}${payload.model === DEFAULT_MODEL ? "（默认）" : ""}\n` +
      `计费：${price} 元/次（一次任务一首歌；失败全额退还，expired 不退预扣费用）\n` +
      `可换其它模型；完整说明见 references/generate-music.md。\n`,
  );

  const submit = await requestJson(
    "/music/generations",
    apiKey,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    120_000,
  );
  const taskId = submit.task_id || submit.id;
  if (!taskId) {
    throw new Error(`提交成功但响应中没有 task_id/id：${JSON.stringify(submit)}`);
  }
  process.stderr.write(
    `任务已提交：${taskId}（status=${submit.status ?? "unknown"}）\n`,
  );

  if (options["submit-only"]) {
    process.stdout.write(`${JSON.stringify(submit, null, 2)}\n`);
    return;
  }

  const timeoutMs = options.timeout ? Number(options.timeout) : 1_800_000;
  const intervalMs = options.interval ? Number(options.interval) : 3_000;
  const final = await pollTask(taskId, apiKey, timeoutMs, intervalMs);
  process.stdout.write(`${JSON.stringify(final, null, 2)}\n`);
  process.stderr.write("提示：结果音频地址默认 7 天有效，需要长期保存请及时下载。\n");

  if (options.output) {
    const audioUrl = final.audio_url || final.data?.[0]?.url;
    if (!audioUrl) {
      throw new Error("任务成功但响应中没有 audio_url / data[0].url");
    }
    const saved = await downloadMusic(audioUrl, options.output, format);
    process.stderr.write(`音乐已保存：${saved}\n`);
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
