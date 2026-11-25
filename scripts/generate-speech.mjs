#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 语音合成网关调用器。
 *
 * 独立网关：https://api.jcaigc.cn/v1
 * 鉴权：Authorization: Bearer <apiKey>
 * 接口：POST /audio/speech，成功时返回音频二进制。
 *
 * 默认模型：seed-tts-2.0（2.8 元/万字符）
 * 默认音色：zh_female_vv_uranus_bigtts（Vivi，通用女声）
 */

export const DEFAULT_BASE_URL = "https://api.jcaigc.cn/v1";
export const DEFAULT_MODEL = "seed-tts-2.0";
export const DEFAULT_VOICE = "zh_female_vv_uranus_bigtts";

/** 合成模型单价（元/万字符）。 */
const MODEL_PRICES = {
  "seed-tts-2.0": 2.8,
  "seed-icl-2.0": 2.8,
  "qwen3-tts-flash": 0.8,
  "cosyvoice-v3.5-plus": 1.5,
  "cosyvoice-v3.5-flash": 0.8,
};

export const BASE_URL = DEFAULT_BASE_URL;

function usage() {
  return [
    "简创AIGC 语音合成网关调用器",
    "",
    "用法：",
    "  node scripts/generate-speech.mjs --api-key <uuid> --text '要合成的文字' --output speech.mp3",
    "  node scripts/generate-speech.mjs --api-key <uuid> --text '...' --model qwen3-tts-flash --voice Cherry",
    "",
    `默认模型：${DEFAULT_MODEL}（2.8 元/万字符）`,
    `默认音色：${DEFAULT_VOICE}（Vivi）`,
    "用户可换其它模型/音色，但音色必须与模型配套。",
    "",
    "apiKey 也可放在环境变量 JCAIGC_API_KEY。",
    `基地址：${BASE_URL}`,
  ].join("\n");
}

function parseArgs(args) {
  const options = {};
  const valued = [
    "--api-key",
    "--text",
    "--input",
    "--model",
    "--voice",
    "--format",
    "--response-format",
    "--speed",
    "--output",
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

function validateVoice(model, voice) {
  if (model === "seed-tts-2.0") {
    if (!voice.endsWith("_uranus_bigtts")) {
      throw new Error(
        `seed-tts-2.0 只能配豆包 2.0 音色（ID 以 _uranus_bigtts 结尾）；` +
          `收到 ${voice}。千问音色会导致空音频，请改用豆包音色或换模型。`,
      );
    }
    return;
  }
  if (model === "seed-icl-2.0") {
    if (voice.endsWith("_uranus_bigtts")) {
      throw new Error(
        "seed-icl-2.0 用于豆包复刻音色（S_… 或自定义代号），不能直接配预设音色；" +
          "预设音色请用 seed-tts-2.0。",
      );
    }
    return;
  }
  if (model === "qwen3-tts-flash") {
    if (voice.endsWith("_uranus_bigtts") || voice.startsWith("cosyvoice-")) {
      throw new Error(
        `qwen3-tts-flash 只能配千问内置音色（如 Cherry / Serena / Ethan / Chelsie）；` +
          `收到 ${voice}。`,
      );
    }
    return;
  }
  if (model === "cosyvoice-v3.5-plus" || model === "cosyvoice-v3.5-flash") {
    const prefix = `${model}-`;
    if (!voice.startsWith(prefix)) {
      throw new Error(
        `${model} 没有系统音色，只能配本模型复刻/设计的音色（ID 以 ${prefix} 开头）；` +
          `收到 ${voice}。请先用 clone-voice 创建音色。`,
      );
    }
  }
}

function normalizeSpeed(value) {
  if (value == null) return null;
  const speed = Number(value);
  if (!Number.isFinite(speed)) throw new Error("--speed 必须是数字");
  const clamped = Math.min(2, Math.max(0.5, speed));
  if (clamped !== speed) {
    process.stderr.write(`语速 ${speed} 超出 0.5~2.0，已夹到 ${clamped}\n`);
  }
  return clamped;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const apiKey = requireApiKey(options);

  const text = options.text ?? options.input;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error("必须提供 --text（要合成的文字）");
  }
  const model = options.model || DEFAULT_MODEL;
  const price = MODEL_PRICES[model];
  if (price == null) {
    throw new Error(
      `不支持的合成模型：${model}；可选：${Object.keys(MODEL_PRICES).join(" / ")}`,
    );
  }
  let voice = options.voice;
  if (!voice) {
    if (model === "seed-tts-2.0") {
      voice = DEFAULT_VOICE;
    } else if (model === "qwen3-tts-flash") {
      voice = "Cherry";
    } else if (model === "seed-icl-2.0") {
      throw new Error("seed-icl-2.0 需要 --voice <豆包复刻音色 ID>");
    } else {
      throw new Error(
        `${model} 没有系统音色，需要 --voice <复刻音色 ID>；请先用 clone-voice 创建音色`,
      );
    }
  }
  validateVoice(model, voice);

  const format = options["format"] || options["response-format"] || "mp3";
  if (!["mp3", "wav", "pcm", "opus"].includes(format)) {
    throw new Error("--format 只能是 mp3 / wav / pcm / opus");
  }
  const speed = normalizeSpeed(options.speed);
  if (speed != null && model === "qwen3-tts-flash") {
    process.stderr.write("提示：qwen3-tts-flash 不支持 speed，该参数会被忽略。\n");
  }

  const chars = [...text.trim()].length;
  const estimated = (chars / 10_000) * price;
  process.stderr.write(
    `模型：${model}${model === DEFAULT_MODEL ? "（默认）" : ""}\n` +
      `音色：${voice}${voice === DEFAULT_VOICE ? "（默认）" : ""}\n` +
      `计费：${price} 元/万字符 × ${chars} 字符 ≈ ${estimated.toFixed(4)} 元；失败请求不计费\n` +
      `可换其它模型/音色，但音色必须与模型配套；完整价目见 references/voice-tts.md。\n`,
  );

  const payload = {
    model,
    input: text,
    voice,
    response_format: format,
  };
  if (speed != null) payload.speed = speed;

  const timeoutMs = options.timeout ? Number(options.timeout) : 120_000;
  const response = await fetch(`${BASE_URL}/audio/speech`, {
    method: "POST",
    headers: {
      accept: "audio/*, application/json",
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("application/json")) {
    const textBody = await response.text();
    let result;
    try {
      result = JSON.parse(textBody);
    } catch {
      throw new Error(`接口返回的不是JSON（HTTP ${response.status}）`);
    }
    throw new Error(extractError(result, response.status));
  }

  const output = options.output || `speech.${format}`;
  await mkdir(dirname(output), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(output, buffer);
  process.stdout.write(`已保存音频：${output}\n`);
  process.stderr.write(`字符数 ${chars}，预计费用约 ${estimated.toFixed(4)} 元。\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
