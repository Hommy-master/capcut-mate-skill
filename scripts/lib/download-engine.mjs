/**
 * 草稿文件下载引擎：并发限流、重试、断点续传与劣化看门狗。
 *
 * 移植自 capcut-mate/desktop-client/nodeapi：
 * - resumableDownload.js（Range 续传、HEAD/Range 探测、空闲超时）
 * - downloadSpeedGuard.js（快升慢降的相对劣化判定）
 * - download.js 中的重试与并发策略
 *
 * 仅依赖 Node.js 内置模块（fetch / fs / stream），无第三方依赖。
 * 所有网络请求都可注入 `validateUrl`，用于把草稿文件的每一跳重定向
 * 限制在允许的主机内；素材下载不限制主机（素材 URL 来自草稿本身）。
 */

import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { isPermissionError } from "./file-permission.mjs";

/** 等待响应头的时间；10s 没有响应头就中断，交由上层按 Range 续传重试 */
const HEADER_TIMEOUT_MS = 10_000;
/** 传输过程中 10s 无数据则中断，便于上层重试续传；不限制总下载时长 */
const STREAM_IDLE_TIMEOUT_MS = 10_000;
/** 相对劣化看门狗采样窗口 */
const SPEED_WINDOW_MS = 5_000;
/** 小于该尺寸的半成品不值得发 Range，按整文件重下 */
const MIN_PARTIAL_SIZE = 1024;

/** 标准 Chrome 120 (Windows) 请求头指纹，降低 CDN 按 UA/客户端提示限流的概率。 */
const CHROME_BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  // 禁用压缩：Range 偏移必须对应原始字节，且 Content-Length 校验才准确。
  "Accept-Encoding": "identity",
  "Cache-Control": "no-cache",
  "sec-ch-ua":
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
};

/** 网关/限流等暂时不可用，退避重试有效；500 多为 OSS/Nginx 的瞬时内部错误 */
const RETRYABLE_TRANSIENT_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
/** 限流/网关错误退避：1s 起指数增长，上限 30s */
const TRANSIENT_HTTP_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
const TRANSIENT_HTTP_BACKOFF_MAX_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 1000;
/** DNS 解析小预算；域名真不可达时不该耗满整个重试预算 */
const DNS_RETRY_BUDGET = 3;
/** 单个文件首次尝试 + 最多 10 次重试（与服务端客户端的语义一致） */
export const MAX_DOWNLOAD_RETRIES = 10;
export const MAX_DOWNLOAD_ATTEMPTS = MAX_DOWNLOAD_RETRIES + 1;
/** 单次网络请求的最大重定向跳数 */
const MAX_REDIRECTS = 5;

export class DownloadError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "DownloadError";
    if (options.code) this.code = options.code;
    if (options.status != null) this.status = options.status;
    if (options.retryAfterMs != null) this.retryAfterMs = options.retryAfterMs;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRequestHeaders(extra = {}) {
  return {
    ...CHROME_BROWSER_HEADERS,
    ...extra,
    Accept: extra.Accept ?? "*/*",
    "Accept-Encoding": "identity",
    "Cache-Control": "no-cache",
  };
}

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const key = name.toLowerCase();
  for (const candidate of Object.keys(headers)) {
    if (candidate.toLowerCase() === key) return headers[candidate];
  }
  return null;
}

export function parseContentRange(contentRange) {
  if (!contentRange) return { start: null, end: null, total: null };
  const match = /^bytes\s+(?:(\d+)-(\d+)|\*)\/(\d+|\*)$/i.exec(
    String(contentRange).trim(),
  );
  if (!match) return { start: null, end: null, total: null };
  return {
    start: match[1] != null ? Number(match[1]) : null,
    end: match[2] != null ? Number(match[2]) : null,
    total: match[3] === "*" ? null : Number(match[3]),
  };
}

export function parseContentLength(headers) {
  const raw = headerValue(headers, "content-length");
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function contentRangeTotal(headers) {
  return parseContentRange(headerValue(headers, "content-range")).total;
}

function contentRangeStart(headers) {
  return parseContentRange(headerValue(headers, "content-range")).start;
}

/** 解析 Retry-After（秒或 HTTP 日期），返回毫秒；无法解析时返回 null */
function parseRetryAfterMs(headers) {
  const raw = headerValue(headers, "retry-after");
  if (raw == null || raw === "") return null;

  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, TRANSIENT_HTTP_BACKOFF_MAX_MS);
  }

  const retryAt = Date.parse(String(raw));
  if (Number.isFinite(retryAt)) {
    return Math.min(
      Math.max(0, retryAt - Date.now()),
      TRANSIENT_HTTP_BACKOFF_MAX_MS,
    );
  }
  return null;
}

/**
 * 逐跳跟随重定向，并在每一跳发起请求前校验 URL。
 * 这样被允许的草稿域名即使重定向也无法把请求带到未授权的主机。
 */
async function fetchFollowingRedirects(url, options = {}) {
  const {
    method = "GET",
    headers = {},
    validateUrl = null,
    signal,
    maxRedirects = MAX_REDIRECTS,
  } = options;

  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (validateUrl) validateUrl(current);

    const response = await fetch(current, {
      method,
      headers,
      redirect: "manual",
      signal,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!location) {
        throw new DownloadError(
          `服务器返回重定向但缺少 Location（HTTP ${response.status}）`,
          { status: response.status },
        );
      }
      current = new URL(location, current).toString();
      continue;
    }

    return { response, finalUrl: current };
  }

  throw new DownloadError(`重定向次数超过 ${maxRedirects} 次`);
}

function destroyStream(stream) {
  if (!stream) return;
  try {
    stream.destroy();
  } catch {
    // ignore
  }
}

async function getLocalFileSize(filePath) {
  if (!filePath) return 0;
  try {
    const info = await fs.stat(filePath);
    return info.isFile() ? info.size : 0;
  } catch {
    return 0;
  }
}

/**
 * 探测远端文件大小与响应头，用于判断本地半成品是否已经完整。
 *
 * 优先 HEAD；部分 CDN 不支持 HEAD，退化为 Range: bytes=0-0（只读响应头，
 * 拿到 Content-Range 后立即断开）。探测失败返回 null。
 */
export async function probeRemoteFile(fileUrl, requestHeaders = {}, options = {}) {
  const { validateUrl = null } = options;
  const headers = createRequestHeaders(requestHeaders);
  delete headers.Range;

  try {
    const { response } = await fetchFollowingRedirects(fileUrl, {
      method: "HEAD",
      headers,
      validateUrl,
      signal: AbortSignal.timeout(HEADER_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => {});
    if (response.status >= 200 && response.status < 400) {
      const size =
        contentRangeTotal(response.headers) ?? parseContentLength(response.headers);
      if (size != null) return { size, headers: response.headers };
    }
  } catch {
    // HEAD 不被支持或失败，继续尝试 1 字节 Range 探测
  }

  const controller = new AbortController();
  const headerTimer = setTimeout(() => controller.abort(), HEADER_TIMEOUT_MS);
  try {
    const { response } = await fetchFollowingRedirects(fileUrl, {
      headers: { ...headers, Range: "bytes=0-0" },
      validateUrl,
      signal: controller.signal,
    });
    const size =
      contentRangeTotal(response.headers) ?? parseContentLength(response.headers);
    await response.body?.cancel().catch(() => {});
    if (
      (response.status === 200 || response.status === 206) &&
      size != null
    ) {
      return { size, headers: response.headers };
    }
  } catch {
    // 探测失败，保持原有续传逻辑
  } finally {
    clearTimeout(headerTimer);
  }

  return null;
}

async function requestDownloadStream(fileUrl, headers, validateUrl) {
  const controller = new AbortController();
  const headerTimer = setTimeout(() => controller.abort(), HEADER_TIMEOUT_MS);
  try {
    const { response } = await fetchFollowingRedirects(fileUrl, {
      headers,
      validateUrl,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (
      error?.name === "AbortError" ||
      error?.name === "TimeoutError" ||
      error?.code === "ABORT_ERR"
    ) {
      throw new DownloadError("[error] download stream error: header timeout", {
        code: "ETIMEDOUT",
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(headerTimer);
  }
}

function createDegradeDetector() {
  const DEGRADE_RATIO = 0.2;
  const DEGRADE_CONSECUTIVE_WINDOWS = 2;
  const DEGRADE_MIN_BASELINE_BYTES_PER_SEC = 256 * 1024;
  const DEGRADE_MAX_CURRENT_BYTES_PER_SEC = 256 * 1024;
  const BASELINE_DECAY_PER_WINDOW = 0.98;

  let speedWindowIndex = 0;
  let baselineSpeed = 0;
  let slowWindows = 0;

  return function observe(speed) {
    speedWindowIndex += 1;
    let degraded = false;
    let updateBaseline = true;

    if (
      speedWindowIndex > 1 &&
      baselineSpeed >= DEGRADE_MIN_BASELINE_BYTES_PER_SEC
    ) {
      if (
        speed < baselineSpeed * DEGRADE_RATIO &&
        speed < DEGRADE_MAX_CURRENT_BYTES_PER_SEC
      ) {
        slowWindows += 1;
        updateBaseline = false;
        degraded = slowWindows >= DEGRADE_CONSECUTIVE_WINDOWS;
      } else {
        slowWindows = 0;
      }
    } else {
      slowWindows = 0;
    }

    if (updateBaseline) {
      baselineSpeed =
        speed > baselineSpeed
          ? speed
          : Math.max(speed, baselineSpeed * BASELINE_DECAY_PER_WINDOW);
    }

    return { degraded, baseline: baselineSpeed };
  };
}

function writeStreamToFile(
  readable,
  filePath,
  { flags, startSize, expectedSize, maxBytes = Infinity },
) {
  return new Promise((resolve, reject) => {
    const writer = createWriteStream(filePath, { flags, mode: 0o666 });
    let received = startSize;
    let settled = false;
    let idleTimer;
    let windowStart = Date.now();
    let windowStartSize = startSize;
    const detectDegrade = createDegradeDetector();

    const cleanup = () => clearTimeout(idleTimer);

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      destroyStream(readable);
      writer.destroy();
      reject(error);
    };

    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        fail(new DownloadError("[error] download stream error: idle timeout"));
      }, STREAM_IDLE_TIMEOUT_MS);
    };

    resetIdle();

    readable.on("data", (chunk) => {
      received += chunk.length;
      resetIdle();

      if (received > maxBytes) {
        fail(
          new DownloadError(
            `文件超过大小限制：${received} bytes（上限 ${maxBytes} bytes）`,
          ),
        );
        return;
      }

      const now = Date.now();
      if (now - windowStart >= SPEED_WINDOW_MS) {
        const elapsed = Math.max(now - windowStart, 1);
        const speed = ((received - windowStartSize) * 1000) / elapsed;
        const verdict = detectDegrade(speed);

        if (verdict.degraded) {
          fail(
            new DownloadError(
              "[error] download stream error: degraded below 20% of baseline " +
                `(${(speed / 1024).toFixed(1)}KB/s vs ${(verdict.baseline / 1024).toFixed(1)}KB/s)`,
            ),
          );
          return;
        }

        windowStart = now;
        windowStartSize = received;
      }
    });

    writer.on("close", () => {
      if (settled) return;
      cleanup();
      if (expectedSize != null && received !== expectedSize) {
        settled = true;
        reject(
          new DownloadError(
            `[error] download stream error: incomplete file ${received}/${expectedSize}`,
          ),
        );
        return;
      }
      settled = true;
      resolve(received);
    });

    writer.on("error", (error) => {
      fail(new DownloadError(`[error] write file failed: ${error.message}`));
    });

    readable.on("error", (error) => {
      fail(new DownloadError(`[error] download stream error: ${error.message}`));
    });

    readable.pipe(writer);
  });
}

async function moveIfNeeded(fromPath, toPath) {
  if (!toPath || path.normalize(fromPath) === path.normalize(toPath)) {
    return fromPath;
  }
  await fs.mkdir(path.dirname(toPath), { recursive: true });
  await fs.unlink(toPath).catch(() => {});
  await fs.rename(fromPath, toPath);
  return toPath;
}

async function finalizeDestPath(filePath, responseHeaders, resolveDestPath) {
  if (typeof resolveDestPath !== "function") return filePath;
  const finalPath = resolveDestPath(responseHeaders);
  if (!finalPath) return filePath;
  return moveIfNeeded(filePath, finalPath);
}

/**
 * 下载二进制资源：有半成品且服务端返回 206 时断点续传；
 * 服务端忽略 Range 返回 200 时回退为整文件覆盖。
 * 中断时保留半成品，供上层重试接着下。
 *
 * @param {string} fileUrl
 * @param {{
 *   destPath: string,
 *   resolveDestPath?: (headers: Headers) => string,
 *   requestHeaders?: object,
 *   validateUrl?: ((url: string) => void)|null,
 *   maxBytes?: number,
 * }} options
 * @returns {Promise<{path: string, size: number, headers: Headers|null}>}
 */
export async function downloadBinaryToFile(fileUrl, options = {}) {
  const {
    destPath,
    resolveDestPath = null,
    requestHeaders = {},
    validateUrl = null,
    maxBytes = Infinity,
  } = options;
  if (!destPath) {
    throw new DownloadError("[error] download dest path is required");
  }

  const targetPath = destPath;
  const existingSize = await getLocalFileSize(targetPath);
  let canResume = existingSize >= MIN_PARTIAL_SIZE;

  if (existingSize > maxBytes) {
    throw new DownloadError(
      `本地半成品超过大小限制：${existingSize} bytes（上限 ${maxBytes} bytes）`,
    );
  }

  const headers = createRequestHeaders(requestHeaders);

  // 先确认本地文件是否其实已经完整。部分 CDN 对「从 EOF 开始」的 Range
  // 返回 500 而不是标准 416，若直接续传会重试一个永远失败的请求。
  if (canResume) {
    const remote = await probeRemoteFile(fileUrl, requestHeaders, {
      validateUrl,
    });
    if (remote) {
      if (existingSize === remote.size) {
        const finalPath = await finalizeDestPath(
          targetPath,
          remote.headers,
          resolveDestPath,
        );
        return {
          path: finalPath,
          size: await getLocalFileSize(finalPath),
          headers: remote.headers,
        };
      }
      if (existingSize > remote.size) {
        await fs.unlink(targetPath).catch(() => {});
        canResume = false;
      }
    }
  }

  if (canResume) {
    headers.Range = `bytes=${existingSize}-`;
  }

  let response;
  try {
    response = await requestDownloadStream(fileUrl, headers, validateUrl);
  } catch (error) {
    // 个别 CDN 对 EOF Range 返回 500 或直接挂住连接（不是 416）。
    // 若本地文件其实已经完整，这里直接判定成功，避免外层重试同一个必败请求。
    if (canResume) {
      const remote = await probeRemoteFile(fileUrl, requestHeaders, {
        validateUrl,
      });
      if (remote && existingSize === remote.size) {
        const finalPath = await finalizeDestPath(
          targetPath,
          remote.headers,
          resolveDestPath,
        );
        return {
          path: finalPath,
          size: await getLocalFileSize(finalPath),
          headers: remote.headers,
        };
      }
      if (remote && existingSize > remote.size) {
        await fs.unlink(targetPath).catch(() => {});
      }
    }
    throw error;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  if (response.status === 416) {
    const total = contentRangeTotal(response.headers);
    await response.body?.cancel().catch(() => {});
    const size = await getLocalFileSize(targetPath);
    if (total != null && size === total) {
      const finalPath = await finalizeDestPath(
        targetPath,
        response.headers,
        resolveDestPath,
      );
      return {
        path: finalPath,
        size: await getLocalFileSize(finalPath),
        headers: response.headers,
      };
    }
    await fs.unlink(targetPath).catch(() => {});
    // 不带 status：半成品已删除，这一轮应当按整文件重下重试。
    throw new DownloadError(
      "[error] download stream error: range not satisfiable, will restart",
    );
  }

  if (response.status !== 200 && response.status !== 206) {
    await response.body?.cancel().catch(() => {});
    throw new DownloadError(
      `[error] [stream] request failed, status code: ${response.status}`,
      {
        status: response.status,
        retryAfterMs: parseRetryAfterMs(response.headers),
      },
    );
  }

  if (!response.body) {
    throw new DownloadError(
      "[error] [stream] response has no body",
      { status: response.status },
    );
  }

  const rangeStart = contentRangeStart(response.headers);
  const contentLength = parseContentLength(response.headers);
  const rangeMatches = rangeStart == null || rangeStart === existingSize;

  let flags = "w";
  let startSize = 0;
  let expectedSize = contentLength;

  if (response.status === 206 && canResume && rangeMatches) {
    flags = "a";
    startSize = existingSize;
    expectedSize = contentRangeTotal(response.headers);
  } else if (
    response.status === 206 &&
    !canResume &&
    (rangeStart == null || rangeStart === 0)
  ) {
    expectedSize = contentRangeTotal(response.headers) ?? contentLength;
  } else if (response.status === 206) {
    await response.body?.cancel().catch(() => {});
    await fs.unlink(targetPath).catch(() => {});
    // 不带 status：偏移不匹配时整文件重下才是有效重试。
    throw new DownloadError(
      "[error] download stream error: resume offset mismatch, will restart",
    );
  } else {
    expectedSize = contentLength;
  }

  const readable = Readable.fromWeb(response.body);
  await writeStreamToFile(readable, targetPath, {
    flags,
    startSize,
    expectedSize,
    maxBytes,
  });

  const finalPath = await finalizeDestPath(
    targetPath,
    response.headers,
    resolveDestPath,
  );
  return {
    path: finalPath,
    size: await getLocalFileSize(finalPath),
    headers: response.headers,
  };
}

function getErrorCode(error) {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current.code) return String(current.code);
    current = current.cause;
  }
  return null;
}

function getHttpStatusFromError(error) {
  if (error?.status != null) return Number(error.status);
  if (error?.response?.status != null) return Number(error.response.status);
  const match = /status code:\s*(\d+)/i.exec(String(error?.message || ""));
  return match ? Number.parseInt(match[1], 10) : null;
}

function isTimeoutError(error) {
  if (
    error?.code === "ECONNABORTED" ||
    error?.code === "ETIMEDOUT" ||
    error?.name === "TimeoutError" ||
    error?.name === "AbortError"
  ) {
    return true;
  }
  return /timeout|timed out|idle timeout/i.test(String(error?.message || ""));
}

/**
 * 判断下载错误是否值得重试。
 * - HTTP：408 / 429 / 500 / 502 / 503 / 504 可重试；404 等 4xx 不重试
 * - 网络：连接拒绝不重试；DNS（ENOTFOUND）按小预算重试；超时/重置可重试
 * - 流写入/读取中断、空闲超时、劣化看门狗中断可重试
 */
export function isRetryableDownloadError(error, attempt = 1) {
  if (!error) return false;

  // 权限错误重试多少次都不会成功，反而会拖慢失败反馈
  if (isPermissionError(error)) return false;

  const status = getHttpStatusFromError(error);
  if (status !== null) {
    return RETRYABLE_TRANSIENT_HTTP_STATUSES.has(status);
  }

  if (isTimeoutError(error)) return true;

  const code = getErrorCode(error);
  if (code === "ECONNREFUSED") return false;
  if (code === "ENOTFOUND") return attempt <= DNS_RETRY_BUDGET;
  if (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN" ||
    code === "UND_ERR_SOCKET" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT"
  ) {
    return true;
  }

  const message = String(error.message || "");
  if (
    /write file failed|download stream error|idle timeout|degraded|fetch failed/i.test(
      message,
    )
  ) {
    return true;
  }

  if (!error.response && code) return true;

  return false;
}

/** 计算下次重试前的等待时间。 */
export function getRetryDelayMs(error, failedAttempt) {
  if (error?.retryAfterMs != null) {
    return Math.min(error.retryAfterMs, TRANSIENT_HTTP_BACKOFF_MAX_MS);
  }

  const status = getHttpStatusFromError(error);
  if (status !== null && RETRYABLE_TRANSIENT_HTTP_STATUSES.has(status)) {
    const index = Math.min(
      Math.max(failedAttempt - 1, 0),
      TRANSIENT_HTTP_BACKOFF_MS.length - 1,
    );
    return Math.min(
      TRANSIENT_HTTP_BACKOFF_MS[index] ?? TRANSIENT_HTTP_BACKOFF_MS.at(-1),
      TRANSIENT_HTTP_BACKOFF_MAX_MS,
    );
  }

  return DEFAULT_RETRY_DELAY_MS;
}

export async function retryDownloadTask(task, options = {}) {
  const {
    maxAttempts = MAX_DOWNLOAD_ATTEMPTS,
    retryDelayMs = null,
    isRetryableError = isRetryableDownloadError,
    onAttempt = null,
    onRetry = null,
    onExhausted = null,
  } = options;

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (typeof onAttempt === "function") {
        await onAttempt(attempt, maxAttempts);
      }
      return await task(attempt, maxAttempts);
    } catch (error) {
      lastError = error;
      const hasNextAttempt = attempt < maxAttempts;
      const canRetry = hasNextAttempt && isRetryableError(error, attempt);

      if (!canRetry) {
        if (!hasNextAttempt && typeof onExhausted === "function") {
          await onExhausted(error, attempt, maxAttempts);
        }
        throw error;
      }

      const delayMs =
        retryDelayMs != null ? retryDelayMs : getRetryDelayMs(error, attempt);

      if (typeof onRetry === "function") {
        await onRetry(error, attempt, maxAttempts, delayMs);
      }
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  throw lastError || new DownloadError("retryDownloadTask failed without error");
}

/**
 * 简单并发限流器：任务只有在拿到槽位后才开始。
 * 用于把「文件列表下载」和「草稿内远程素材下载」统一限制在固定路数以内。
 */
export function createConcurrencyLimiter(limit) {
  let active = 0;
  const queue = [];

  const pump = () => {
    while (active < limit && queue.length > 0) {
      const job = queue.shift();
      active += 1;
      Promise.resolve()
        .then(job.task)
        .then(job.resolve, job.reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  };

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      pump();
    });
}

/**
 * 并发执行 worker，最多 limit 个同时运行；任一项抛错后不再启动新任务，
 * 等在跑的任务结束后抛出第一个错误（用于权限错误时快速中止整批下载）。
 */
export async function mapLimit(items, limit, worker) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let nextIndex = 0;
  let stopped = false;
  let firstError = null;

  async function runner() {
    while (!stopped) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        stopped = true;
        if (firstError == null) firstError = error;
        return;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runner()),
  );
  if (firstError != null) throw firstError;
  return results;
}

/**
 * 一次性拉取小型 JSON（get_draft 列表、draft_content.json 等），带重试。
 *
 * @param {string} url
 * @param {{
 *   validateUrl?: ((url: string) => void)|null,
 *   maxBytes?: number,
 *   maxAttempts?: number,
 *   timeoutMs?: number,
 *   deadlineMs?: number,
 *   withSlot?: (task: () => Promise<any>) => Promise<any>,
 * }} options
 * @returns {Promise<Buffer>}
 */
export async function fetchBytesWithRetry(url, options = {}) {
  const {
    validateUrl = null,
    maxBytes = Infinity,
    maxAttempts = 3,
    timeoutMs = 15_000,
    deadlineMs = 30_000,
    withSlot = (task) => task(),
  } = options;

  const deadline = Date.now() + deadlineMs;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timeLeft = deadline - Date.now();
    if (timeLeft <= 0) break;

    if (attempt > 1) {
      const planned = getRetryDelayMs(lastError, attempt - 1);
      const wait = Math.min(planned, Math.max(0, timeLeft - 1));
      if (wait > 0) await sleep(wait);
      if (deadline - Date.now() <= 0) break;
    }

    try {
      return await withSlot(async () => {
        const { response } = await fetchFollowingRedirects(url, {
          headers: createRequestHeaders({
            Accept: "application/json, application/octet-stream",
          }),
          validateUrl,
          signal: AbortSignal.timeout(
            Math.max(1, Math.min(timeoutMs, deadline - Date.now())),
          ),
        });

        if (!response.ok) {
          const retryAfterMs = parseRetryAfterMs(response.headers);
          await response.body?.cancel().catch(() => {});
          throw new DownloadError(`HTTP ${response.status}`, {
            status: response.status,
            retryAfterMs,
          });
        }

        const declaredSize = parseContentLength(response.headers);
        if (declaredSize != null && declaredSize > maxBytes) {
          await response.body?.cancel().catch(() => {});
          throw new DownloadError(`文件超过大小限制：${declaredSize} bytes`);
        }

        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > maxBytes) {
          throw new DownloadError(`文件超过大小限制：${bytes.length} bytes`);
        }
        return bytes;
      });
    } catch (error) {
      lastError = error;
      const willRetry =
        attempt < maxAttempts &&
        Date.now() < deadline &&
        isRetryableDownloadError(error, attempt);
      if (!willRetry) throw error;
    }
  }

  throw lastError || new DownloadError("请求超时");
}

export const __testing = {
  createDegradeDetector,
  parseRetryAfterMs,
  getHttpStatusFromError,
  getErrorCode,
  fetchFollowingRedirects,
  writeStreamToFile,
};
