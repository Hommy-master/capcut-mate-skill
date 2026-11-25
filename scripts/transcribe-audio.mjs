#!/usr/bin/env node

import * as fs from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 语音识别网关调用器。
 *
 * 独立网关：https://api.jcaigc.cn/v1
 * 鉴权：Authorization: Bearer <apiKey>
 * 接口：POST /audio/transcriptions（/audio/translations 行为相同，不做翻译）
 *
 * 默认模型：volc.bigasr.auc_turbo（0.00022 元/秒，收本地文件或公网地址）。
 */

export const DEFAULT_BASE_URL = "https://api.jcaigc.cn/v1";
export const DEFAULT_MODEL = "volc.bigasr.auc_turbo";

const MODEL_INFO = {
  "volc.bigasr.auc_turbo": {
    price: 0.00022,
    input: "both",
    maxFileMb: 100,
    note: "豆包极速版，收文件或公网地址，≤100MB / ≤2 小时",
  },
  "volc.seedasr.auc": {
    price: 0.00025,
    input: "url",
    note: "豆包标准版，只收公网地址，效果最好，最多等 10 分钟",
  },
  "qwen3-asr-flash": {
    price: 0.00022,
    input: "file",
    maxFileMb: 7.5,
    note: "阿里，只能上传文件，原始文件约 <7.5MB",
  },
  "fun-asr": {
    price: 0.00022,
    input: "file",
    maxFileMb: 7.5,
    note: "阿里，与 qwen3-asr-flash 同链路同价",
  },
};

export const BASE_URL = DEFAULT_BASE_URL;

const MIME_TYPES = {
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  amr: "audio/amr",
  webm: "audio/webm",
  wma: "audio/x-ms-wma",
};

function usage() {
  return [
    "简创AIGC 语音识别网关调用器",
    "",
    "用法：",
    "  node scripts/transcribe-audio.mjs --api-key <uuid> --file ./audio.mp3",
    "  node scripts/transcribe-audio.mjs --api-key <uuid> --file-url https://example.com/a.mp3",
    "  node scripts/transcribe-audio.mjs --api-key <uuid> --file ./audio.mp3 --response-format verbose_json",
    "",
    `默认模型：${DEFAULT_MODEL}（0.00022 元/秒，收文件或公网地址）。`,
    "可选模型：qwen3-asr-flash / fun-asr（只收文件）、volc.seedasr.auc（只收公网地址）。",
    "",
    "apiKey 也可放在环境变量 JCAIGC_API_KEY。",
    `基地址：${BASE_URL}`,
  ].join("\n");
}

function parseArgs(args) {
  const options = {};
  const valued = [
    "--api-key",
    "--file",
    "--file-url",
    "--model",
    "--response-format",
    "--language",
    "--timestamps",
    "--timeout",
  ];
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

function mimeTypeFor(filePath) {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

async function blobFor(filePath) {
  try {
    if (typeof fs.openAsBlob === "function") {
      return await fs.openAsBlob(filePath, { type: mimeTypeFor(filePath) });
    }
    return new Blob([await readFile(filePath)], { type: mimeTypeFor(filePath) });
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`找不到音频文件：${filePath}`);
    }
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const apiKey = requireApiKey(options);

  const model = options.model || DEFAULT_MODEL;
  const modelInfo = MODEL_INFO[model];
  if (!modelInfo) {
    throw new Error(
      `不支持的识别模型：${model}；可选：${Object.keys(MODEL_INFO).join(" / ")}`,
    );
  }
  if (!options.file && !options["file-url"]) {
    throw new Error("必须提供 --file 或 --file-url");
  }
  if (options.file && options["file-url"]) {
    throw new Error("--file 与 --file-url 只能二选一");
  }
  if (modelInfo.input === "url" && options.file) {
    throw new Error(`${model} 只接受公网地址，请改用 --file-url`);
  }
  if (modelInfo.input === "file" && options["file-url"]) {
    throw new Error(`${model} 只接受上传文件，请改用 --file`);
  }
  if (options.file) {
    const info = await stat(options.file).catch(() => null);
    if (!info) throw new Error(`找不到音频文件：${options.file}`);
    const sizeMb = info.size / (1024 * 1024);
    if (modelInfo.maxFileMb && sizeMb > modelInfo.maxFileMb) {
      throw new Error(
        `${model} 的文件上限约 ${modelInfo.maxFileMb}MB；当前 ${sizeMb.toFixed(2)}MB`,
      );
    }
  }

  const responseFormat = options["response-format"] || "json";
  if (!["json", "verbose_json", "text"].includes(responseFormat)) {
    throw new Error("--response-format 只能是 json / verbose_json / text");
  }

  process.stderr.write(
    `模型：${model}${model === DEFAULT_MODEL ? "（默认）" : ""}\n` +
      `计费：${modelInfo.price} 元/秒（按音频时长，识别成功后扣费）\n` +
      `可换其它识别模型；完整说明见 references/voice-transcribe.md。\n`,
  );

  const form = new FormData();
  if (options.file) {
    form.append("file", await blobFor(options.file), basename(options.file));
  } else {
    form.append("file_url", options["file-url"]);
  }
  form.append("model", model);
  form.append("response_format", responseFormat);
  if (options.language) form.append("language", options.language);
  if (options.timestamps) {
    if (options.timestamps !== "word") {
      throw new Error("--timestamps 目前只支持 word");
    }
    if (!model.startsWith("volc.")) {
      process.stderr.write("提示：逐词时间线仅豆包链路支持，当前模型可能忽略该参数。\n");
    }
    form.append("timestamp_granularities[]", "word");
  }

  const timeoutMs = options.timeout ? Number(options.timeout) : 600_000;
  const response = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!response.ok || contentType.includes("application/json")) {
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`接口返回的不是JSON（HTTP ${response.status}）`);
    }
    if (!response.ok) {
      throw new Error(extractError(result, response.status));
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (typeof result.duration === "number" && result.duration > 0) {
      process.stderr.write(
        `实际音频时长 ${result.duration.toFixed(2)} 秒，费用约 ${(
          result.duration * modelInfo.price
        ).toFixed(4)} 元\n`,
      );
    }
    return;
  }

  // response_format=text 时是纯文本
  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
