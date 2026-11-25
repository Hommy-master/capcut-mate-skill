#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 图像生成网关调用器。
 *
 * 独立网关：https://api.jcaigc.cn/v1
 * 鉴权：Authorization: Bearer <apiKey>（也接受 x-api-key）
 * 文生图：POST /images/generations，同步返回图片 URL。
 *
 * 默认模型：doubao-seedream-5-0-flash（0.12 元/张）。
 * 按张计费，调用前请确认 apiKey 与预算。
 */

export const DEFAULT_BASE_URL = "https://api.jcaigc.cn/v1";

/** 默认图像生成模型：最便宜、速度最快，适合大多数配图。 */
export const DEFAULT_MODEL = "doubao-seedream-5-0-flash";

/** 网关价目表（元/张）；Gemini 两条按 1K/2K/4K 分档。 */
const IMAGE_PRICES = {
  "doubao-seedream-5-0-flash": { fixed: 0.12 },
  "qwen-image-3.0": { fixed: 0.2 },
  "wan2.7-image-pro": { fixed: 0.2 },
  "doubao-seedream-5-0-pro": { fixed: 0.3 },
  "qwen-image-3.0-pro": { fixed: 0.5 },
  "wan2.7-image": { fixed: 0.5 },
  "gemini-3.1-flash-lite-image": {
    tiers: { "1K": 0.252, "2K": 0.302, "4K": 0.363 },
  },
  "gemini-3.1-flash-image": {
    tiers: { "1K": 0.5, "2K": 0.75, "4K": 1.12 },
  },
};

/** 实际基地址。 */
export const BASE_URL = DEFAULT_BASE_URL;

function usage() {
  return [
    "简创AIGC 图像生成网关调用器",
    "",
    "用法：",
    "  node scripts/generate-image.mjs --api-key <uuid> --prompt '<提示词>'",
    "  node scripts/generate-image.mjs --api-key <uuid> --data '<JSON>'",
    "  node scripts/generate-image.mjs --api-key <uuid> --data-file <JSON文件>",
    "  node scripts/generate-image.mjs --api-key <uuid> --prompt '<提示词>' --output ./images",
    "  node scripts/generate-image.mjs --api-key <uuid> --models",
    "",
    `默认模型：${DEFAULT_MODEL}（0.12 元/张）。`,
    "素材比例跟随草稿：1080×1920 草稿用 --size 1080x1920（Gemini 可用 --aspect-ratio 9:16）；",
    "1920×1080 草稿用 --size 1920x1080（Gemini 用 --aspect-ratio 16:9）。",
    "",
    "示例：",
    `  node scripts/generate-image.mjs --api-key <uuid> --prompt '窗台上的橘猫，晨光，浅景深'`,
    `  node scripts/generate-image.mjs --api-key <uuid> --model qwen-image-3.0-pro --prompt '...' --n 3`,
    `  node scripts/generate-image.mjs --api-key <uuid> --prompt '...' --size 1080x1920`,
    `  node scripts/generate-image.mjs --api-key <uuid> --model gemini-3.1-flash-image --prompt '改成海边日落' --aspect-ratio 9:16`,
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
    "--size",
    "--aspect-ratio",
    "--n",
    "--data",
    "--data-file",
    "--output",
    "--prefix",
    "--timeout",
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
      const code = error.code ? ` ${error.code}` : error.type ? ` ${error.type}` : "";
      return `HTTP ${status}${code ? ` [${code.trim()}]` : ""}：${message}`;
    }
    const message = result.message ?? result.detail;
    if (typeof message === "string" && message.length > 0) {
      return `HTTP ${status}：${message}`;
    }
  }
  return `HTTP ${status}`;
}

async function requestJson(path, apiKey, init = {}, timeoutMs = 30_000) {
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

function tierForSize(size) {
  if (typeof size !== "string") return "1K";
  const match = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return "1K";
  const longest = Math.max(Number(match[1]), Number(match[2]));
  if (longest >= 4096) return "4K";
  if (longest >= 2048) return "2K";
  return "1K";
}

/** 生成给用户看的计费说明；未知模型只提示按网关价目表计费。 */
function formatBilling(model, size, n) {
  const lines = [];
  const defaultTag = model === DEFAULT_MODEL ? "（默认）" : "";
  lines.push(`模型：${model}${defaultTag}`);

  const price = IMAGE_PRICES[model];
  if (price?.fixed != null) {
    lines.push(`计费：${price.fixed} 元/张 × ${n} 张 = ${(price.fixed * n).toFixed(2)} 元`);
  } else if (price?.tiers) {
    const tier = tierForSize(size);
    const unit = price.tiers[tier];
    lines.push(
      `计费：${tier} 档 ${unit} 元/张 × ${n} 张 = ${(unit * n).toFixed(2)} 元` +
        (n > 1 ? `（注意：Gemini 每条每次只生成 1 张，建议 n=1 或拆成多次请求）` : ""),
    );
  } else {
    lines.push(`计费：按网关价目表计费（${n} 张），具体单价以控制台为准`);
  }
  lines.push("可换其它模型；完整价目见 references/generate-image.md。");
  return lines.join("\n");
}

function extensionFor(url, contentType) {
  const fromUrl = extname(new URL(url).pathname).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(fromUrl)) return fromUrl;
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return ".jpg";
  if (contentType?.includes("webp")) return ".webp";
  return ".png";
}

async function downloadImages(urls, outputDir, prefix) {
  await mkdir(outputDir, { recursive: true });
  const saved = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) {
      throw new Error(`下载生成图片失败（HTTP ${response.status}）：${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = extensionFor(url, response.headers.get("content-type"));
    const target = join(outputDir, `${prefix}-${index + 1}${extension}`);
    await writeFile(target, buffer);
    saved.push(target);
  }
  return saved;
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

  // 显式 --model 优先；否则沿用 --data 里的 model；都没有时用默认模型。
  if (options.model) payload.model = options.model;
  if (!payload.model) payload.model = DEFAULT_MODEL;
  if (typeof payload.model !== "string" || payload.model.length === 0) {
    throw new Error("model 必须是非空字符串");
  }
  if (options.prompt) payload.prompt = options.prompt;
  if (options.size) payload.size = options.size;
  if (options["aspect-ratio"]) {
    if (payload.model.startsWith("gemini-")) {
      payload.aspect_ratio = options["aspect-ratio"];
    } else {
      process.stderr.write(
        "提示：aspect_ratio 仅 Gemini 两条支持，已忽略；非 Gemini 请用 --size 指定 9:16/16:9 尺寸。\n",
      );
    }
  }
  if (options.n != null) payload.n = Number(options.n);

  const isGemini = payload.model.startsWith("gemini-");
  if (!isGemini && !payload.prompt) {
    throw new Error("缺少提示词：请提供 --prompt 或 --data 中的 prompt");
  }
  if (payload.n != null && (!Number.isInteger(payload.n) || payload.n < 1)) {
    throw new Error("--n 必须是大于等于 1 的整数");
  }

  const n = payload.n ?? 1;
  process.stderr.write(`${formatBilling(payload.model, payload.size, n)}\n`);

  const timeoutMs = options.timeout ? Number(options.timeout) : 600_000;
  const result = await requestJson(
    "/images/generations",
    apiKey,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    timeoutMs,
  );

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (options.output) {
    const urls = Array.isArray(result.data)
      ? result.data.map((item) => item?.url).filter((url) => typeof url === "string")
      : [];
    if (urls.length > 0) {
      const saved = await downloadImages(
        urls,
        options.output,
        options.prefix || "image",
      );
      process.stderr.write(`已保存 ${saved.length} 张：\n${saved.join("\n")}\n`);
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
