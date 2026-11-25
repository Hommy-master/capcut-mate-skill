#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 简创AIGC 视频文案生成器（大语言模型网关）。
 *
 * 本技能只接入一个模型：gemini-3.5-flash-lite
 * 基地址：https://api.jcaigc.cn/v1
 * 接口：POST /chat/completions
 *
 * 计费：输入 2.25 元/百万 token，输出 18.75 元/百万 token。
 */

export const DEFAULT_BASE_URL = "https://api.jcaigc.cn/v1";
export const MODEL = "gemini-3.5-flash-lite";
export const INPUT_PRICE_PER_MILLION = 2.25;
export const OUTPUT_PRICE_PER_MILLION = 18.75;

export const BASE_URL = DEFAULT_BASE_URL;

const DEFAULT_SYSTEM_PROMPT = [
  "你是短视频口播文案编剧。请写中文口播文案。",
  "要求：",
  "1. 开头 1–2 句抓注意力，先给冲突、问题或结果，不要慢热。",
  "2. 口语化、短句，一句话一个意思，方便直接朗读；避免书面语和长从句。",
  "3. 按目标时长控制篇幅：中文口播大约每秒 4 个字。",
  "4. 结构完整：钩子 → 正文（2–4 个要点）→ 结尾行动号召。",
  "5. 不要编造事实或数据；不确定的内容用通用表述。",
  "6. 默认只输出文案正文，不要 Markdown 标题、表情符号、分镜表，除非用户明确要求。",
].join("\n");

function usage() {
  return [
    "简创AIGC 视频文案生成器（大语言模型）",
    "",
    "用法：",
    "  node scripts/generate-script.mjs --api-key <uuid> --topic '主题'",
    "  node scripts/generate-script.mjs --api-key <uuid> --topic '...' --duration 30 --tone '自然亲切'",
    "  node scripts/generate-script.mjs --api-key <uuid> --topic '...' --output script.txt",
    "",
    `模型：${MODEL}（唯一可用模型）`,
    `计费：输入 ${INPUT_PRICE_PER_MILLION} 元/百万 token，输出 ${OUTPUT_PRICE_PER_MILLION} 元/百万 token。`,
    "",
    "常用参数：",
    "  --duration <秒>    目标时长，默认 30",
    "  --audience <受众>  目标受众",
    "  --tone <语气>      语气风格，如 自然亲切 / 专业 / 幽默",
    "  --platform <平台>  发布平台，如 抖音 / 视频号",
    "  --system <提示词>  自定义系统提示词（覆盖默认口播写作规则）",
    "  --raw              输出完整 JSON（含 usage）",
    "",
    "apiKey 也可放在环境变量 JCAIGC_API_KEY。",
    `基地址：${BASE_URL}`,
  ].join("\n");
}

function parseArgs(args) {
  const options = {};
  const valued = [
    "--api-key",
    "--topic",
    "--prompt",
    "--audience",
    "--tone",
    "--duration",
    "--platform",
    "--system",
    "--temperature",
    "--max-tokens",
    "--output",
    "--timeout",
    "--model",
  ];
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

function buildUserMessage(options, duration) {
  const lines = [`主题：${options.topic}`];
  if (options.audience) lines.push(`目标受众：${options.audience}`);
  if (options.tone) lines.push(`语气风格：${options.tone}`);
  if (options.platform) lines.push(`发布平台：${options.platform}`);
  lines.push(`目标时长：约 ${duration} 秒（中文约 ${duration * 4} 字以内）`);
  lines.push("请只输出可直接朗读的文案正文。");
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const apiKey = requireApiKey(options);

  if (options.model && options.model !== MODEL) {
    throw new Error(
      `本技能只支持模型 ${MODEL}，不接入其它大语言模型；收到 ${options.model}`,
    );
  }
  const topic = options.topic || options.prompt;
  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    throw new Error("必须提供 --topic（视频主题/要写的内容）");
  }
  const duration = options.duration ? Number(options.duration) : 30;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("--duration 必须是正数（秒）");
  }
  const temperature = options.temperature ? Number(options.temperature) : 0.7;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error("--temperature 必须在 0–2 之间");
  }
  const maxTokens = options["max-tokens"] ? Number(options["max-tokens"]) : 2000;
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    throw new Error("--max-tokens 必须是正整数");
  }

  const systemPrompt = options.system || DEFAULT_SYSTEM_PROMPT;
  const userMessage = buildUserMessage(
    { ...options, topic: topic.trim() },
    duration,
  );

  process.stderr.write(
    `模型：${MODEL}（唯一可用模型）\n` +
      `计费：输入 ${INPUT_PRICE_PER_MILLION} 元/百万 token，输出 ${OUTPUT_PRICE_PER_MILLION} 元/百万 token；失败请求不计费\n` +
      `调用后按返回的 usage 计算本次费用。\n`,
  );

  const timeoutMs = options.timeout ? Number(options.timeout) : 300_000;
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: false,
      temperature,
      max_tokens: maxTokens,
    }),
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

  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("接口成功但没有返回文案内容");
  }

  if (options.output) {
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, `${content.trim()}\n`, "utf8");
    process.stdout.write(`文案已保存：${options.output}\n`);
  } else if (options.raw) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${content.trim()}\n`);
  }

  const promptTokens = result.usage?.prompt_tokens;
  const completionTokens = result.usage?.completion_tokens;
  if (Number.isFinite(promptTokens) && Number.isFinite(completionTokens)) {
    const cost =
      (promptTokens / 1_000_000) * INPUT_PRICE_PER_MILLION +
      (completionTokens / 1_000_000) * OUTPUT_PRICE_PER_MILLION;
    process.stderr.write(
      `用量：输入 ${promptTokens} token，输出 ${completionTokens} token；本次费用约 ${cost.toFixed(
        6,
      )} 元\n`,
    );
  } else {
    process.stderr.write("未返回 usage，费用以控制台账单为准。\n");
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
