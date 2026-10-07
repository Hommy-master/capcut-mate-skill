#!/usr/bin/env node

import * as fs from "node:fs";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 剪映小助手 API 通用调用器。
 * 基地址与接口清单依据官方文档 https://docs.jcaigc.cn 重构。
 *
 * 本技能完全开源免费，后端为开源项目 CapCut Mate（Apache-2.0）：
 *   https://github.com/Hommy-master/capcut-mate
 * 自部署后可用环境变量 CAPCUT_MATE_BASE_URL 覆盖基地址，例如：
 *   CAPCUT_MATE_BASE_URL=http://localhost:30000/openapi/capcut-mate/v1 node scripts/call-api.mjs --endpoint create_draft
 */

/** 托管版默认基地址。 */
export const DEFAULT_BASE_URL =
  "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1";

/** 实际使用的基地址：优先取 CAPCUT_MATE_BASE_URL（自部署实例）。 */
export const BASE_URL = (
  process.env.CAPCUT_MATE_BASE_URL || DEFAULT_BASE_URL
).replace(/\/+$/, "");

/** 官方文档收录的全部接口。 */
export const ENDPOINTS = new Set([
  // 素材上传
  "upload_file",
  // 草稿生命周期
  "create_draft",
  "get_draft",
  "save_draft",
  "easy_create_material",
  // 素材编排
  "add_videos",
  "add_images",
  "add_audios",
  "add_captions",
  // 效果增强
  "add_effects",
  "add_filters",
  "add_keyframes",
  "add_masks",
  "add_mask_keyframes",
  "add_beauty",
  "add_sticker",
  "add_text_style",
  // 输出导出
  "gen_video",
  "gen_video_status",
  // 数据生成
  "timelines",
  "audio_timelines",
  "video_infos",
  "audio_infos",
  "imgs_infos",
  "caption_infos",
  "effect_infos",
  "filter_infos",
  "keyframes_infos",
  // 查询辅助
  "get_audio_duration",
  "get_image_animations",
  "get_text_animations",
  "get_text_effects",
  "search_sticker",
  "get_url",
  // 格式转换
  "str_to_list",
  "str_list_to_objs",
  "objs_to_str_list",
]);

/** 唯一使用 GET 的接口。 */
export const GET_ENDPOINTS = new Set(["get_draft"]);

/** 使用 multipart/form-data 的接口（文件走 --file，其余字段作为附加表单字段）。 */
export const MULTIPART_ENDPOINTS = new Set(["upload_file"]);

/** 原生 function calling 不建议主动调用的辅助接口（给扣子/n8n 拼字符串用）。 */
export const AUXILIARY_ENDPOINTS = new Set([
  "timelines",
  "audio_timelines",
  "video_infos",
  "audio_infos",
  "imgs_infos",
  "caption_infos",
  "effect_infos",
  "filter_infos",
  "keyframes_infos",
  "str_to_list",
  "str_list_to_objs",
  "objs_to_str_list",
]);

/** 收费接口。 */
export const PAID_ENDPOINTS = new Set(["gen_video", "upload_file"]);

/** 收费接口的调用前提示。 */
const PAID_HINTS = {
  gen_video: "提示：gen_video 为收费接口（0.3 元/分钟），线上导出需要 apiKey。\n",
  upload_file:
    "提示：upload_file 为收费接口（0.0005 元/MB），托管版上传需要 apiKey。\n",
};

/** 上传文件的 MIME 类型（服务端按扩展名校验，这里只为请求头更准确）。 */
const MIME_TYPES = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  flv: "video/x-flv",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  ogg: "audio/ogg",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

function requirePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("请求数据必须是JSON对象");
  }
  return payload;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`缺少必填参数：${label}`);
  }
  return value;
}

export function endpointUrl(endpoint) {
  if (!ENDPOINTS.has(endpoint)) {
    throw new Error(`不允许调用的接口：${endpoint}`);
  }
  return `${BASE_URL}/${endpoint}`;
}

export function createRequestConfig(endpoint, payload = {}) {
  if (!ENDPOINTS.has(endpoint)) {
    throw new Error(`不允许调用的接口：${endpoint}`);
  }
  if (MULTIPART_ENDPOINTS.has(endpoint)) {
    throw new Error(`${endpoint} 需要上传本地文件，请用 --file 指定文件路径`);
  }
  const data = requirePayload(payload);
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
  };

  if (GET_ENDPOINTS.has(endpoint)) {
    const draftId = requireNonEmptyString(data.draft_id, "draft_id");
    const query = new URLSearchParams({ draft_id: draftId });
    return {
      url: `${BASE_URL}/${endpoint}?${query.toString()}`,
      init: { method: "GET", headers },
    };
  }

  return {
    url: `${BASE_URL}/${endpoint}`,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    },
  };
}

/** 按扩展名推断 MIME 类型，未知扩展名回落到二进制流。 */
export function mimeTypeFor(filePath) {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

/** 读取本地文件为 Blob；Node 19.8+ 走 openAsBlob，避免大文件占满内存。 */
async function readFileAsBlob(filePath) {
  const type = mimeTypeFor(filePath);
  try {
    if (typeof fs.openAsBlob === "function") {
      return await fs.openAsBlob(filePath, { type });
    }
    return new Blob([await readFile(filePath)], { type });
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`找不到要上传的文件：${filePath}`);
    }
    throw error;
  }
}

/**
 * 构造 multipart/form-data 请求（当前仅 upload_file）。
 * 文件走 `filePath`，其余字段作为附加表单字段提交（如 apiKey）。
 */
export async function createMultipartRequestConfig(
  endpoint,
  payload = {},
  filePath,
) {
  if (!MULTIPART_ENDPOINTS.has(endpoint)) {
    throw new Error(`该接口不支持文件上传：${endpoint}`);
  }
  const data = requirePayload(payload);
  requireNonEmptyString(filePath, "--file");

  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (key === "file") {
      throw new Error("file 字段由 --file 指定，不要在 --data 中重复传入");
    }
    form.append(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  form.append("file", await readFileAsBlob(filePath), basename(filePath));

  return {
    url: `${BASE_URL}/${endpoint}`,
    init: { method: "POST", headers: { accept: "application/json" }, body: form },
  };
}

/** 从响应体中提取人类可读的错误信息。 */
export function extractErrorDetail(result, status) {
  if (!result || typeof result !== "object") return `HTTP ${status}`;
  const detail = result.detail ?? result.message ?? result.msg;
  if (typeof detail === "string" && detail.length > 0) return detail;
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return `HTTP ${status}`;
}

/** 业务层错误：code 存在且不是 0/200 时视为失败。 */
export function assertBusinessOk(result) {
  if (result && typeof result === "object" && typeof result.code === "number") {
    if (result.code !== 0 && result.code !== 200) {
      throw new Error(
        `接口业务失败（code=${result.code}）：${extractErrorDetail(result, 200)}`,
      );
    }
  }
  return result;
}

export async function callApi(endpoint, payload, options = {}) {
  const { fetchImpl = fetch, timeoutMs = 30_000, filePath } = options;
  const request = filePath
    ? await createMultipartRequestConfig(endpoint, payload, filePath)
    : createRequestConfig(endpoint, payload);
  const response = await fetchImpl(request.url, {
    ...request.init,
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
    throw new Error(`接口调用失败：${extractErrorDetail(result, response.status)}`);
  }
  return assertBusinessOk(result);
}

function usage() {
  return [
    "剪映小助手通用接口调用器（简创AIGC 版）",
    "",
    "用法：",
    "  node scripts/call-api.mjs --endpoint <接口名> --data '<JSON>'",
    "  node scripts/call-api.mjs --endpoint <接口名> --data-file <JSON文件>",
    "  node scripts/call-api.mjs --endpoint upload_file --file <本地文件> --data '<附加字段JSON>'",
    "",
    "示例：",
    '  node scripts/call-api.mjs --endpoint create_draft --data \'{"width":1080,"height":1920}\'',
    '  node scripts/call-api.mjs --endpoint get_draft --data \'{"draft_id":"2025092811473036584258"}\'',
    '  node scripts/call-api.mjs --endpoint upload_file --file ./demo.mp4 --data \'{"apiKey":"<uuid>"}\'',
    "",
    `基地址：${BASE_URL}`,
    BASE_URL === DEFAULT_BASE_URL
      ? "  （自部署可设 CAPCUT_MATE_BASE_URL 覆盖，例如 http://localhost:30000/openapi/capcut-mate/v1）"
      : "  （已由 CAPCUT_MATE_BASE_URL 覆盖为自部署实例）",
    "",
    "完全开源免费 · 后端 CapCut Mate：https://github.com/Hommy-master/capcut-mate",
    `可用接口（${ENDPOINTS.size} 个）：${[...ENDPOINTS].join("、")}`,
  ].join("\n");
}

function parseArgs(args) {
  const options = {};
  const valued = ["--endpoint", "--data", "--data-file", "--file", "--timeout"];
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (options.list) {
    process.stdout.write(`${[...ENDPOINTS].join("\n")}\n`);
    return;
  }
  if (!options.endpoint) throw new Error("必须提供--endpoint");
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
  if (options.file && !MULTIPART_ENDPOINTS.has(options.endpoint)) {
    throw new Error(`--file 只适用于：${[...MULTIPART_ENDPOINTS].join("、")}`);
  }
  if (PAID_ENDPOINTS.has(options.endpoint)) {
    process.stderr.write(PAID_HINTS[options.endpoint]);
  }
  const defaultTimeoutMs = MULTIPART_ENDPOINTS.has(options.endpoint)
    ? 600_000
    : 30_000;
  const timeoutMs = options.timeout ? Number(options.timeout) : defaultTimeoutMs;
  const result = await callApi(options.endpoint, payload, {
    timeoutMs,
    filePath: options.file,
  });
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
