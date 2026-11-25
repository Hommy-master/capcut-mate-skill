#!/usr/bin/env node

import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 账户余额查询。
 *
 * 余额接口由简创开放平台（jcaigc.cn）直接提供，不走剪映小助手基地址：
 *   GET https://jcaigc.cn/openapi/v1/user/points?apiKey=<uuid>
 *
 * 免费，不扣费。与 gen_video、upload_file 以及各生成网关共用同一份充值余额。
 */

export const POINTS_URL = "https://jcaigc.cn/openapi/v1/user/points";

function usage() {
  return [
    "简创AIGC 账户余额查询",
    "",
    "用法：",
    "  node scripts/get-points.mjs --api-key <uuid>",
    "  node scripts/get-points.mjs --api-key <uuid> --raw",
    "",
    "默认输出：{\"points\":12.34,\"unit\":\"CNY\"}",
    "  --raw               输出接口完整 JSON（含 message / traceid）",
    "  --timeout <毫秒>    请求超时，默认 30000",
    "",
    "apiKey 也可放在环境变量 JCAIGC_API_KEY。",
    `地址：${POINTS_URL}`,
  ].join("\n");
}

function parseArgs(args) {
  const options = {};
  const valued = ["--api-key", "--timeout"];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--raw") {
      options.raw = true;
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
    const message = result.message ?? result.msg ?? result.detail;
    if (typeof message === "string" && message.length > 0) {
      const traceId = result.traceid ? `（traceid=${result.traceid}）` : "";
      return `HTTP ${status}：${message}${traceId}`;
    }
  }
  return `HTTP ${status}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const apiKey = requireApiKey(options);
  const timeoutMs = options.timeout ? Number(options.timeout) : 30_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("--timeout 必须是正数（毫秒）");
  }

  const url = new URL(POINTS_URL);
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
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
    throw new Error(`接口调用失败：${extractError(result, response.status)}`);
  }
  if (typeof result.code === "number" && result.code !== 0 && result.code !== 200) {
    throw new Error(
      `接口业务失败（code=${result.code}）：${extractError(result, 200)}`,
    );
  }

  const points = result?.data?.points;
  if (typeof points !== "number" || !Number.isFinite(points)) {
    throw new Error("接口未返回有效的 data.points");
  }

  if (options.raw) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({ points, unit: "CNY" })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
