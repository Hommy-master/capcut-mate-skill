#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 数字人网关调用器。
 *
 * 数字人没有单独端点，复用视频接口：
 *   POST /video/generations；GET /video/generations/{task_id}
 *
 * 方案由入参决定：
 *   视频 + 音频 → videoretalk（视频对口型，0.08 元/秒）
 *   图片 + 音频 → wan2.2-s2v（图片说话，480P 0.5 / 720P 0.9 元/秒）
 *
 * 基地址：https://api.jcaigc.cn/v1
 * 鉴权：Authorization: Bearer <apiKey>
 */

export const DEFAULT_BASE_URL = "https://api.jcaigc.cn/v1";

const VIDEO_MODEL = "videoretalk";
const IMAGE_MODEL = "wan2.2-s2v";
const VIDEO_PRICE = 0.08;
const IMAGE_PRICES = { "480P": 0.5, "720P": 0.9 };
const VIDEO_MAX_SECONDS = 120;
const IMAGE_MAX_SECONDS = 20;

export const BASE_URL = DEFAULT_BASE_URL;

function usage() {
  return [
    "简创AIGC 数字人网关调用器",
    "",
    "用法：",
    "  # 视频对口型（videoretalk，0.08 元/秒）",
    "  node scripts/generate-digital-human.mjs --api-key <uuid> --video-url <视频> --audio-url <音频>",
    "",
    "  # 图片说话（wan2.2-s2v，默认 480P 0.5 元/秒）",
    "  node scripts/generate-digital-human.mjs --api-key <uuid> --image-url <人像图> --audio-url <音频>",
    "",
    "常用参数：",
    "  --resolution 480P/720P  仅图片说话；默认 480P",
    "  --ref-image-url <图>     仅视频对口型；多人画面指定参考人脸",
    "  --video-extension        仅视频对口型；音频更长时延长画面",
    "  --face-threshold <120-200> 仅视频对口型且给了参考图",
    "  --estimate-duration <秒> 仅用于费用估算，不随请求发送",
    "  --submit-only            只提交任务，不轮询",
    "  --output <文件>          完成后下载视频",
    "",
    "图片说话音频上限 20 秒；视频对口型音频可到 120 秒。",
    "素材方向跟随草稿：1080×1920 用竖屏人像/视频，1920×1080 用横屏素材。",
    "失败任务全额退还；30 分钟未取结果会 expired 且不退预扣费用。",
    "",
    "apiKey 也可放在环境变量 JCAIGC_API_KEY。",
    `基地址：${BASE_URL}`,
  ].join("\n");
}

function parseArgs(args) {
  const options = {};
  const valued = [
    "--api-key",
    "--video-url",
    "--video",
    "--image-url",
    "--image",
    "--audio-url",
    "--audio",
    "--ref-image-url",
    "--resolution",
    "--face-threshold",
    "--model",
    "--estimate-duration",
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
    if (argument === "--video-extension") {
      options["video-extension"] = true;
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

function formatBilling(scenario, resolution, estimateSeconds) {
  if (scenario === "video") {
    const lines = [
      `方案：视频对口型（${VIDEO_MODEL}）`,
      `计费：${VIDEO_PRICE} 元/秒；按生成视频时长（口型驱动时长）计费`,
    ];
    if (estimateSeconds != null) {
      lines.push(
        `估算：按 ${estimateSeconds} 秒 ≈ ${(VIDEO_PRICE * estimateSeconds).toFixed(2)} 元（实际以任务结算为准）`,
      );
    } else {
      lines.push(
        `未提供估算时长；网关按 ${VIDEO_MAX_SECONDS} 秒上限预估预扣（最多 ${(
          VIDEO_PRICE * VIDEO_MAX_SECONDS
        ).toFixed(2)} 元）`,
      );
    }
    lines.push("失败全额退还；30 分钟未取结果会 expired 且不退预扣费用。");
    return lines.join("\n");
  }
  const unit = IMAGE_PRICES[resolution];
  const lines = [
    `方案：图片说话（${IMAGE_MODEL}，${resolution}）`,
    `计费：${unit} 元/秒；按生成视频时长（口型驱动时长）计费`,
  ];
  if (estimateSeconds != null) {
    lines.push(
      `估算：按 ${estimateSeconds} 秒 ≈ ${(unit * estimateSeconds).toFixed(2)} 元（实际以任务结算为准）`,
    );
  } else {
    lines.push(
      `未提供估算时长；音频上限 ${IMAGE_MAX_SECONDS} 秒，网关按上限预估预扣`,
    );
  }
  lines.push("失败全额退还；30 分钟未取结果会 expired 且不退预扣费用。");
  lines.push(
    resolution === "720P"
      ? "480P 为 0.5 元/秒；视频对口型为 0.08 元/秒。"
      : "可换 720P（0.9 元/秒）；视频对口型为 0.08 元/秒。",
  );
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
      throw new Error(`数字人生成失败：${message}`);
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
    throw new Error(`下载数字人视频失败（HTTP ${response.status}）：${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  let target = outputPath;
  const info = await stat(outputPath).catch(() => null);
  if (info?.isDirectory() || outputPath.endsWith("/")) {
    await mkdir(outputPath, { recursive: true });
    target = join(outputPath, `avatar-${Date.now()}.mp4`);
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

  const videoUrl = options["video-url"] || options.video || payload.video_url;
  const imageUrl = options["image-url"] || options.image || payload.image_url;
  const audioUrl = options["audio-url"] || options.audio || payload.audio_url;
  if (!audioUrl) {
    throw new Error("数字人需要音频：请提供 --audio-url 或 --data 中的 audio_url");
  }
  if (!videoUrl && !imageUrl) {
    throw new Error("需要 --video-url（视频对口型）或 --image-url（图片说话）");
  }
  payload.audio_url = audioUrl;

  const scenario = videoUrl ? "video" : "image";
  if (videoUrl) payload.video_url = videoUrl;
  if (imageUrl) payload.image_url = imageUrl;

  if (options["ref-image-url"]) payload.ref_image_url = options["ref-image-url"];
  if (options["video-extension"]) payload.video_extension = true;
  if (options["face-threshold"]) {
    const threshold = Number(options["face-threshold"]);
    if (!Number.isFinite(threshold) || threshold < 120 || threshold > 200) {
      throw new Error("--face-threshold 必须是 120–200 的数字");
    }
    payload.query_face_threshold = threshold;
  }

  if (scenario === "video") {
    if (options.resolution) {
      process.stderr.write("提示：视频对口型不分分辨率，已忽略 --resolution。\n");
    }
    // 视频对口型：image_url 会被当作参考人脸图。
    if (payload.image_url && !payload.ref_image_url) {
      payload.ref_image_url = payload.image_url;
    }
    delete payload.image_url;
    delete payload.resolution;
    delete payload.size;
    if (payload.video_extension == null && options["video-extension"]) {
      payload.video_extension = true;
    }
    if (payload.query_face_threshold != null) {
      const threshold = Number(payload.query_face_threshold);
      if (!Number.isFinite(threshold) || threshold < 120 || threshold > 200) {
        throw new Error("query_face_threshold 必须是 120–200 的数字");
      }
      payload.query_face_threshold = threshold;
    }
  } else {
    if (payload.ref_image_url || payload.video_extension) {
      throw new Error("ref_image_url / video_extension 仅视频对口型支持");
    }
    if (payload.query_face_threshold != null) {
      throw new Error("query_face_threshold 仅视频对口型支持");
    }
    let resolution = options.resolution || payload.resolution || payload.size || "480P";
    resolution = String(resolution).toUpperCase();
    if (![ "480P", "720P" ].includes(resolution)) {
      throw new Error("图片说话分辨率只能是 480P / 720P");
    }
    payload.resolution = resolution;
    delete payload.size;
  }

  if (options.model) payload.model = options.model;
  if (!payload.model) payload.model = scenario === "video" ? VIDEO_MODEL : IMAGE_MODEL;
  const expected = scenario === "video" ? VIDEO_MODEL : IMAGE_MODEL;
  if (payload.model !== expected) {
    throw new Error(
      scenario === "video"
        ? `video_url 必须配 ${VIDEO_MODEL}；收到 ${payload.model}`
        : `image_url 必须配 ${IMAGE_MODEL}；收到 ${payload.model}`,
    );
  }

  const estimateSeconds = options["estimate-duration"]
    ? Number(options["estimate-duration"])
    : null;
  if (
    estimateSeconds != null &&
    (!Number.isFinite(estimateSeconds) || estimateSeconds <= 0)
  ) {
    throw new Error("--estimate-duration 必须是正数（秒）");
  }
  const maxSeconds = scenario === "video" ? VIDEO_MAX_SECONDS : IMAGE_MAX_SECONDS;
  if (estimateSeconds != null && estimateSeconds > maxSeconds) {
    throw new Error(
      scenario === "video"
        ? `视频对口型音频上限 ${VIDEO_MAX_SECONDS} 秒；收到 ${estimateSeconds} 秒`
        : `图片说话音频上限 ${IMAGE_MAX_SECONDS} 秒；收到 ${estimateSeconds} 秒，请拆段`,
    );
  }

  process.stderr.write(
    `${formatBilling(
      scenario,
      scenario === "image" ? payload.resolution : null,
      estimateSeconds,
    )}\n`,
  );

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
    const videoResultUrl = final.video_url || final.data?.[0]?.url;
    if (!videoResultUrl) {
      throw new Error("任务成功但响应中没有 video_url / data[0].url");
    }
    const saved = await downloadVideo(videoResultUrl, options.output);
    process.stderr.write(`数字人视频已保存：${saved}\n`);
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
