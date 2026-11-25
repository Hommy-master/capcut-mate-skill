#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 字幕/时间线 ASR（autosubrt）调用器。
 *
 * ASR 是独立服务，基地址与剪映小助手不同：
 *   https://autosubrt.jcaigc.cn/openapi/autosubrt/v1
 *
 * 适合 SRT 字幕、逐字时间线和文本对齐；普通「音频转文字」用
 * scripts/transcribe-audio.mjs（网关，默认 volc.bigasr.auc_turbo）。
 *
 * 按音频时长计费（0.00022 元/秒，识别成功后扣费），需要 apiKey。
 */

/** 线上服务基地址。 */
export const DEFAULT_BASE_URL =
  "https://autosubrt.jcaigc.cn/openapi/autosubrt/v1";

/** 实际使用的基地址。 */
export const BASE_URL = DEFAULT_BASE_URL;

/** 官方文档收录的 ASR 接口：接口名 → 真实路径。 */
export const ENDPOINTS = new Map([
  ["asr", "asr"],
  ["asr_text", "asr/text"],
  ["asr_srt", "asr/srt"],
  ["asr_text_align", "asr/text/align"],
]);

/** 返回文件本体的接口（不是 JSON）。 */
export const BINARY_ENDPOINTS = new Set(["asr_srt"]);

const ASR_HINT =
  "提示：ASR 为收费接口（0.00022 元/秒，识别成功后扣费），需要 apiKey；" +
  "这是独立服务 autosubrt.jcaigc.cn，不是剪映小助手。\n";

function usage() {
  return [
    "简创AIGC 语音识别（ASR）调用器",
    "",
    "用法：",
    "  node scripts/call-asr.mjs --endpoint <接口名> --data '<JSON>'",
    "  node scripts/call-asr.mjs --endpoint <接口名> --data-file <JSON文件>",
    "  node scripts/call-asr.mjs --endpoint asr_srt --data '<JSON>' --output subtitle.srt",
    "",
    "示例：",
    '  node scripts/call-asr.mjs --endpoint asr --data \'{"audio_url":"https://example.com/a.mp3","apiKey":"<uuid>"}\'',
    '  node scripts/call-asr.mjs --endpoint asr_text_align --data \'{"audio_url":"...","text":"你好。","apiKey":"<uuid>"}\'',
    '  node scripts/call-asr.mjs --endpoint asr_srt --data \'{...}\' --output subtitle.srt',
    "",
    `基地址：${BASE_URL}`,
    "",
    `可用接口（${ENDPOINTS.size} 个）：${[...ENDPOINTS.keys()].join("、")}`,
  ].join("\n");
}

function parseArgs(args) {
  const options = {};
  const valued = ["--endpoint", "--data", "--data-file", "--output", "--timeout"];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--list") {
      options.list = true;
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

function extractErrorDetail(result, status) {
  if (!result || typeof result !== "object") return `HTTP ${status}`;
  const detail = result.detail ?? result.message ?? result.msg;
  if (typeof detail === "string" && detail.length > 0) return detail;
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return `HTTP ${status}`;
}

function assertBusinessOk(result) {
  if (result && typeof result === "object" && typeof result.code === "number") {
    if (result.code !== 0 && result.code !== 200) {
      throw new Error(
        `接口业务失败（code=${result.code}）：${extractErrorDetail(result, 200)}`,
      );
    }
  }
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (options.list) {
    process.stdout.write(
      `${[...ENDPOINTS.entries()].map(([name, path]) => `${name}\t/${path}`).join("\n")}\n`,
    );
    return;
  }
  if (!options.endpoint) throw new Error("必须提供--endpoint");
  if (!ENDPOINTS.has(options.endpoint)) {
    throw new Error(`不允许调用的接口：${options.endpoint}`);
  }
  const endpointPath = ENDPOINTS.get(options.endpoint);
  if (options.data && options["data-file"]) {
    throw new Error("--data和--data-file不能同时使用");
  }

  const raw = options["data-file"]
    ? await readFile(options["data-file"], "utf8")
    : (options.data ?? "{}");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("请求数据不是有效JSON");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("请求数据必须是JSON对象");
  }

  process.stderr.write(ASR_HINT);
  const timeoutMs = options.timeout ? Number(options.timeout) : 600_000;
  const response = await fetch(`${BASE_URL}/${endpointPath}`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (BINARY_ENDPOINTS.has(options.endpoint)) {
    // asr_srt：成功时是字幕文件本体，失败时是 JSON 错误体。
    if (contentType.includes("application/json")) {
      const result = JSON.parse(await response.text());
      throw new Error(
        `接口业务失败（code=${result.code}）：${extractErrorDetail(result, response.status)}`,
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      throw new Error(`接口调用失败：HTTP ${response.status}`);
    }
    if (options.output) {
      await writeFile(options.output, buffer);
      process.stderr.write(`SRT 已写入：${options.output}\n`);
    } else {
      process.stdout.write(buffer);
    }
    return;
  }

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`接口返回的不是JSON（HTTP ${response.status}）`);
  }
  if (!response.ok) {
    throw new Error(`接口调用失败：${extractErrorDetail(result, response.status)}`);
  }
  process.stdout.write(`${JSON.stringify(assertBusinessOk(result), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
