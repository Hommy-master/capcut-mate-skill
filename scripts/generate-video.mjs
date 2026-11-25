#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 视频生成网关调用器。
 *
 * 独立网关：https://api.jcaigc.cn/v1
 * 鉴权：Authorization: Bearer <apiKey>（也接受 x-api-key）
 * 提交：POST /video/generations；轮询：GET /video/generations/{task_id}
 *
 * 默认模型：doubao-seedance-2.0 + 480P（0.45 元/秒）。
 * 按秒计费，调用前请确认 apiKey、时长与预算。
 */

export const DEFAULT_BASE_URL = "https://api.jcaigc.cn/v1";
export const DEFAULT_MODEL = "doubao-seedance-2.0";
export const DEFAULT_RESOLUTION = "480P";

/** 视频模型信息与出厂价目表（元/秒）。 */
const MODEL_INFO = {
  "doubao-seedance-2.0": {
    mode: "both",
    defaultResolution: "480P",
    tiers: { "480P": 0.45, "720P": 1, "1080P": 2.5, "4K": 5 },
  },
  "doubao-seedance-2.0-fast": {
    mode: "both",
    defaultResolution: "480P",
    tiers: { "480P": 0.36, "720P": 0.8 },
  },
  "doubao-seedance-2.0-mini": {
    mode: "both",
    defaultResolution: "480P",
    tiers: { "480P": 0.22, "720P": 0.5 },
  },
  "doubao-seedance-2.5": {
    mode: "both",
    defaultResolution: "720P",
    tiers: { "720P": 1.6, "1080P": 3.8 },
  },
  "wan3.0-video": {
    mode: "both",
    defaultResolution: "480P",
    tiers: { "480P": 0.3, "720P": 0.6, "1080P": 1.2 },
  },
  "happyhorse-1.1-t2v": {
    mode: "t2v",
    defaultResolution: "480P",
    tiers: { "480P": 0.45, "720P": 0.9, "1080P": 1.2 },
  },
  "happyhorse-1.1-i2v": {
    mode: "i2v",
    defaultResolution: "480P",
    tiers: { "480P": 0.45, "720P": 0.9, "1080P": 1.2 },
  },
  "veo-3.1": {
    mode: "both",
    defaultResolution: "720P",
    tiers: { "720P": 1.5, "1080P": 1.5, "2K": 2.25, "4K": 3 },
    audioTiers: { "720P": 3, "1080P": 3, "2K": 3.75, "4K": 4.5 },
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ["16:9", "9:16"],
    veo: true,
  },
  "veo-3.1-fast": {
    mode: "both",
    defaultResolution: "720P",
    tiers: { "720P": 0.75, "1080P": 0.75, "2K": 1.5, "4K": 2.25 },
    audioTiers: { "720P": 1.125, "1080P": 1.125, "2K": 1.875, "4K": 2.625 },
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ["16:9", "9:16"],
    veo: true,
  },
  "veo-3.1-lite": {
    mode: "both",
    defaultResolution: "720P",
    tiers: { "720P": 0.225, "1080P": 0.375, "2K": 0.6, "4K": 0.75 },
    audioTiers: { "720P": 0.375, "1080P": 0.6, "2K": 0.9, "4K": 1.125 },
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ["16:9", "9:16"],
    veo: true,
  },
};

/** 实际基地址。 */
export const BASE_URL = DEFAULT_BASE_URL;

function usage() {
  return [
    "简创AIGC 视频生成网关调用器",
    "",
    "用法：",
    "  node scripts/generate-video.mjs --api-key <uuid> --prompt '<提示词>'",
    "  node scripts/generate-video.mjs --api-key <uuid> --prompt '<提示词>' --duration 5 --aspect-ratio 9:16",
    "  node scripts/generate-video.mjs --api-key <uuid> --image-url '<首帧图>' --prompt '<提示词>'",
    "  node scripts/generate-video.mjs --api-key <uuid> --data '<JSON>'",
    "  node scripts/generate-video.mjs --api-key <uuid> --models",
    "",
    `默认：${DEFAULT_MODEL} + ${DEFAULT_RESOLUTION}（0.45 元/秒）。`,
    "未指定 duration 时按 5 秒估算（Veo 按 8 秒），实际以任务真实时长结算。",
    "",
    "常用参数：",
    "  --model <模型>          切换模型，如 wan3.0-video、doubao-seedance-2.0-mini",
    "  --resolution <档位>     480P / 720P / 1080P / 4K / 2K（取决于模型）",
    "  --duration <秒>         视频时长；Veo 只接受 4 / 6 / 8",
    "  --image-url <URL>       首帧图，走图生视频",
    "  --aspect-ratio <比例>   9:16（1080×1920 草稿）/ 16:9（1920×1080 草稿）；Veo 只支持这两个",
    "  --audio                 仅 Veo：生成原生音频（按有声档计价）",
    "  --submit-only           只提交任务，不轮询",
    "  --output <文件>         完成后下载视频到本地",
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
    "--resolution",
    "--duration",
    "--prompt",
    "--image-url",
    "--image",
    "--aspect-ratio",
    "--negative-prompt",
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
    if (argument === "--audio") {
      options.audio = true;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeResolution(value) {
  if (typeof value !== "string") return value;
  const text = value.trim().toUpperCase();
  if (["480P", "720P", "1080P", "2K", "4K"].includes(text)) return text;
  const match = text.match(/(\d+)\s*[X×]\s*(\d+)/);
  if (!match) return value;
  const longest = Math.max(Number(match[1]), Number(match[2]));
  if (longest >= 3840) return "4K";
  if (longest >= 2560) return "2K";
  if (longest >= 1920) return "1080P";
  if (longest >= 1280) return "720P";
  return "480P";
}

function chooseResolution(model, modelInfo, requested) {
  const allowed = Object.keys(modelInfo.tiers);
  if (requested) {
    const normalized = normalizeResolution(requested);
    if (!allowed.includes(normalized)) {
      throw new Error(
        `模型 ${model} 不支持分辨率 ${requested}；可选：${allowed.join(" / ")}`,
      );
    }
    return normalized;
  }
  return modelInfo.defaultResolution;
}

function estimateBilling(payload, modelInfo, resolution) {
  const hasDuration = payload.duration != null;
  const seconds = hasDuration
    ? Number(payload.duration)
    : (modelInfo.defaultDuration ?? 5);
  const audioEnabled =
    modelInfo.veo &&
    (payload.audio_generation === true ||
      payload.audio_generation === "enabled" ||
      payload.audio_generation === "true");
  const table = audioEnabled ? modelInfo.audioTiers : modelInfo.tiers;
  const unit = table?.[resolution];
  const total = unit != null ? unit * seconds : null;

  const lines = [];
  lines.push(`模型：${payload.model}${payload.model === DEFAULT_MODEL ? "（默认）" : ""}`);
  lines.push(`分辨率：${resolution}`);
  lines.push(
    hasDuration
      ? `时长：${seconds} 秒`
      : `时长：未指定，按 ${seconds} 秒估算（实际以任务真实时长结算）`,
  );
  if (modelInfo.veo) {
    lines.push(`音频：${audioEnabled ? "有声" : "无声"}`);
  }
  if (unit != null) {
    lines.push(
      `计费：${unit} 元/秒 × ${seconds} 秒 ≈ ${total.toFixed(2)} 元；失败任务全额退还，expired 不退还`,
    );
  } else {
    lines.push("计费：按网关价目表计费，具体单价以控制台为准");
  }
  lines.push("可换其它模型/分辨率；完整价目见 references/generate-video.md。");
  return lines.join("\n");
}

async function pollTask(taskId, apiKey, timeoutMs, intervalMs) {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < timeoutMs) {
    await sleep(intervalMs);
    const result = await requestJson(
      `/video/generations/${encodeURIComponent(taskId)}`,
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
      throw new Error(`视频生成失败：${message}`);
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

async function downloadVideo(url, outputPath) {
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok) {
    throw new Error(`下载视频失败（HTTP ${response.status}）：${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  let target = outputPath;
  const info = await stat(outputPath).catch(() => null);
  if (info?.isDirectory() || outputPath.endsWith("/")) {
    await mkdir(outputPath, { recursive: true });
    target = join(outputPath, `video-${Date.now()}.mp4`);
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
  const modelInfo = MODEL_INFO[payload.model];
  if (!modelInfo) {
    throw new Error(
      `不支持的视频模型：${payload.model}；可选：${Object.keys(MODEL_INFO).join(" / ")}`,
    );
  }

  if (options.prompt) payload.prompt = options.prompt;
  if (options["negative-prompt"]) payload.negative_prompt = options["negative-prompt"];
  const imageUrl = options["image-url"] || options.image;
  if (imageUrl) payload.image_url = imageUrl;
  if (options["aspect-ratio"]) payload.aspect_ratio = options["aspect-ratio"];
  if (options.duration) payload.duration = Number(options.duration);
  if (options.audio) payload.audio_generation = "enabled";

  if (payload.audio_url || payload.video_url) {
    throw new Error(
      "audio_url / video_url 属于数字人能力；请改用 scripts/generate-digital-human.mjs",
    );
  }
  if (!modelInfo.veo && (payload.last_frame_url || payload.reference_images)) {
    throw new Error("last_frame_url / reference_images 仅 Veo 模型支持");
  }
  if (!modelInfo.veo && payload.audio_generation != null) {
    throw new Error("audio_generation 仅 Veo 模型支持");
  }
  if (modelInfo.veo) {
    if (payload.last_frame_url && !payload.image_url) {
      throw new Error("last_frame_url 必须同时提供首帧 image_url");
    }
    if (payload.reference_images) {
      if (payload.image_url || payload.last_frame_url) {
        throw new Error("reference_images 不能与首帧/尾帧同时使用");
      }
      if (!Array.isArray(payload.reference_images) || payload.reference_images.length > 3) {
        throw new Error("reference_images 必须是数组，且最多 3 张");
      }
    }
    if (payload.aspect_ratio && !modelInfo.aspectRatios.includes(payload.aspect_ratio)) {
      throw new Error(
        `Veo 只支持宽高比 ${modelInfo.aspectRatios.join(" / ")}；收到 ${payload.aspect_ratio}`,
      );
    }
  }
  if (payload.duration != null) {
    const seconds = Number(payload.duration);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error("duration 必须是正数（秒）");
    }
    if (modelInfo.veo && !modelInfo.durations.includes(seconds)) {
      throw new Error(
        `Veo 只支持时长 ${modelInfo.durations.join(" / ")} 秒；收到 ${payload.duration}`,
      );
    }
    payload.duration = seconds;
  }

  const hasImage = Boolean(payload.image_url);
  if (modelInfo.mode === "t2v" && hasImage) {
    throw new Error(`模型 ${payload.model} 只支持文生视频，不要传 image_url`);
  }
  if (modelInfo.mode === "i2v" && !hasImage) {
    throw new Error(`模型 ${payload.model} 是图生视频模型，必须提供 image_url`);
  }
  if (!hasImage && !payload.prompt) {
    throw new Error("文生视频需要提供 --prompt 或 --data 中的 prompt");
  }

  const resolution = chooseResolution(
    payload.model,
    modelInfo,
    options.resolution || payload.resolution || payload.size,
  );
  payload.resolution = resolution;

  process.stderr.write(`${estimateBilling(payload, modelInfo, resolution)}\n`);

  const submit = await requestJson(
    "/video/generations",
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

  if (options.output) {
    const videoUrl = final.video_url || final.data?.[0]?.url;
    if (!videoUrl) {
      throw new Error("任务成功但响应中没有 video_url / data[0].url");
    }
    const saved = await downloadVideo(videoUrl, options.output);
    process.stderr.write(`视频已保存：${saved}\n`);
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
