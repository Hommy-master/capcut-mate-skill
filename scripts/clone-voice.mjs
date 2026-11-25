#!/usr/bin/env node

import * as fs from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 声音复刻网关调用器。
 *
 * 独立网关：https://api.jcaigc.cn/v1
 * 鉴权：Authorization: Bearer <apiKey>
 * 接口：
 *   POST   /audio/voices            创建音色
 *   GET    /audio/voices            列出音色
 *   GET    /audio/voices/{voice_id} 查询音色
 *   DELETE /audio/voices/{voice_id} 删除音色
 *
 * 默认复刻模型：cosyvoice-v3.5-plus（9.9 元/个）
 */

export const DEFAULT_BASE_URL = "https://api.jcaigc.cn/v1";
export const DEFAULT_MODEL = "cosyvoice-v3.5-plus";
const CLONE_FEE = 9.9;
const ALLOWED_MODELS = new Set(["cosyvoice-v3.5-plus", "cosyvoice-v3.5-flash"]);

export const BASE_URL = DEFAULT_BASE_URL;

const MIME_TYPES = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  flac: "audio/flac",
};

function usage() {
  return [
    "简创AIGC 声音复刻网关调用器",
    "",
    "用法：",
    "  node scripts/clone-voice.mjs --api-key <uuid> --create --file ./voice.mp3 --name myvoice",
    "  node scripts/clone-voice.mjs --api-key <uuid> --create --file ./voice.mp3 --wait",
    "  node scripts/clone-voice.mjs --api-key <uuid> --list",
    "  node scripts/clone-voice.mjs --api-key <uuid> --get <voice_id>",
    "  node scripts/clone-voice.mjs --api-key <uuid> --delete <voice_id>",
    "",
    `默认复刻模型：${DEFAULT_MODEL}（${CLONE_FEE} 元/个）。`,
    "可选：cosyvoice-v3.5-flash（同样 9.9 元/个，合成单价更低）。",
    "参考音频：3~30 秒、≤7.5MB，单人、无背景音乐、无混响。",
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
    "--model",
    "--name",
    "--get",
    "--delete",
    "--timeout",
    "--interval",
  ];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--create") {
      options.create = true;
      continue;
    }
    if (argument === "--list") {
      options.list = true;
      continue;
    }
    if (argument === "--wait") {
      options.wait = true;
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
      throw new Error(`找不到参考音频：${filePath}`);
    }
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVoice(voiceId, apiKey, timeoutMs, intervalMs) {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < timeoutMs) {
    await sleep(intervalMs);
    const result = await requestJson(
      `/audio/voices/${encodeURIComponent(voiceId)}`,
      apiKey,
      { method: "GET" },
    );
    const status = result.status ?? "unknown";
    if (status !== lastStatus) {
      process.stderr.write(`音色状态：${status}\n`);
      lastStatus = status;
    }
    if (status === "OK") return result;
    if (status === "UNDEPLOYED") {
      throw new Error("音色审核未通过（UNDEPLOYED），不自动退款，需要换参考音频重新创建");
    }
  }
  throw new Error("等待音色就绪超时，可稍后用 --get <voice_id> 继续查询");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const apiKey = requireApiKey(options);
  const actions = [
    options.create,
    options.list,
    options.get,
    options.delete,
  ].filter(Boolean);
  if (actions.length !== 1) {
    throw new Error("必须且只能指定 --create / --list / --get / --delete 之一");
  }

  if (options.list) {
    const result = await requestJson("/audio/voices", apiKey, { method: "GET" });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (options.get) {
    const result = await requestJson(
      `/audio/voices/${encodeURIComponent(options.get)}`,
      apiKey,
      { method: "GET" },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (options.delete) {
    const result = await requestJson(
      `/audio/voices/${encodeURIComponent(options.delete)}`,
      apiKey,
      { method: "DELETE" },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (!options.file) {
    throw new Error("创建音色需要 --file 参考音频");
  }
  const info = await stat(options.file).catch(() => null);
  if (!info) throw new Error(`找不到参考音频：${options.file}`);
  if (info.size > 7.5 * 1024 * 1024) {
    throw new Error(
      `参考音频约 ${(info.size / 1024 / 1024).toFixed(2)}MB，超过 7.5MB 上限`,
    );
  }
  const model = options.model || DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(model)) {
    throw new Error(
      `不支持的复刻模型：${model}；可选：${[...ALLOWED_MODELS].join(" / ")}。` +
        "豆包复刻不通过本接口创建。",
    );
  }

  process.stderr.write(
    `模型：${model}${model === DEFAULT_MODEL ? "（默认）" : ""}\n` +
      `计费：${CLONE_FEE} 元/个（创建成功即扣费；上游失败全额退还；审核不通过不退款）\n` +
      `参考音频：3~30 秒、≤7.5MB；可换 cosyvoice-v3.5-flash（同样 9.9 元/个）。\n`,
  );

  const form = new FormData();
  form.append("file", await blobFor(options.file), basename(options.file));
  form.append("model", model);
  if (options.name) form.append("name", options.name);

  const result = await requestJson(
    "/audio/voices",
    apiKey,
    { method: "POST", body: form },
    600_000,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (options.wait && result.voice_id) {
    const final = await waitForVoice(
      result.voice_id,
      apiKey,
      options.timeout ? Number(options.timeout) : 600_000,
      options.interval ? Number(options.interval) : 3_000,
    );
    process.stdout.write(`${JSON.stringify(final, null, 2)}\n`);
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
