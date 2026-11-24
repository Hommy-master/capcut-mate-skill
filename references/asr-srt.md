# asr_srt（语音转 SRT 字幕）

```
POST https://autosubrt.jcaigc.cn/openapi/autosubrt/v1/asr/srt
```

> 依据官方接口文档 https://docs.jcaigc.cn/capcut-mate/ 整理。
> **这是独立的语音识别服务**：基地址 `https://autosubrt.jcaigc.cn`，路径前缀 `/openapi/autosubrt/v1/`。

## 功能描述

把音频识别成 **SRT 字幕文件**，并把**文件本体**直接返回（`Content-Disposition: attachment`），
服务端不落盘、不返回下载链接。需要文案或时间线数据用 [asr](asr.md)。

## 请求参数

```json
{
  "audio_url": "https://example.com/audio.mp3",
  "apiKey": "123e4567-e89b-12d3-a456-426614174000"
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| audio_url | string | ✅ | - | 音频文件 URL，需可被服务端直接下载，且必须是合法的 http/https 地址 |
| apiKey | string | 开启计费时必填 | - | 合法 UUID；可登录 <https://jcaigc.cn> 获取 |

单文件最大 100MB，支持常见音视频格式。

## 响应格式

成功时**不是 JSON**，响应体就是 SRT 文件内容：

```
HTTP/1.1 200 OK
Content-Type: application/x-subrip; charset=utf-8
Content-Disposition: attachment; filename="subtitle.srt"

1
00:00:02,810 --> 00:00:03,330
多谢

2
00:00:04,889 --> 00:00:06,009
请入席吧
```

### 响应头说明

| 响应头 | 值 | 说明 |
|--------|-----|------|
| Content-Type | `application/x-subrip; charset=utf-8` | 字幕文件；错误时是 `application/json` |
| Content-Disposition | `attachment; filename="subtitle.srt"` | 固定文件名 `subtitle.srt` |

### 错误响应

失败时返回 JSON 错误体（HTTP 仍是 200），**按 `Content-Type` 区分**：

```json
{
  "code": 2003,
  "message": "下载文件失败"
}
```

## 使用示例

```bash
curl -X POST https://autosubrt.jcaigc.cn/openapi/autosubrt/v1/asr/srt \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "https://example.com/audio.mp3",
    "apiKey": "123e4567-e89b-12d3-a456-426614174000"
  }' \
  -o subtitle.srt
```

### 本技能脚本

```bash
node scripts/call-asr.mjs --endpoint asr_srt \
  --data '{"audio_url":"https://example.com/audio.mp3","apiKey":"<uuid>"}' \
  --output subtitle.srt
```

## 计费

按**音频时长**扣费：**0.00022 元/秒**，识别成功后才扣费；与剪映小助手共用充值余额。

## 错误码说明

与 [asr](asr.md) 相同的主要错误码：

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 1001 | 参数校验失败 | 缺少 audio_url、不是合法 http/https 地址，或 apiKey 非法 | 检查请求参数 |
| 2001 | 识别音频失败 | 音频无法解码或地址不可访问 | 换可访问的直链或可播放文件 |
| 2002 | 文件大小超出限制 | 音频超过 100MB | 压缩或截取后再试 |
| 2003 | 下载文件失败 | 下载过程中网络或服务端错误 | 确认是公网可直链下载的地址 |
| 2005 | 下载文件超时 | 下载整体超时 | 换更快的源或更小的文件 |
| 2035 | 充值余额不足 | 余额不足 | 充值后重试 |
| 2036 | 无效的 apiKey | 计费开启时未传 apiKey | 登录 <https://jcaigc.cn> 获取 |
| 9997 | 服务器忙 | 并发已达上限 | 稍后重试 |
| 9998 | 系统内部错误 | 未预期的内部异常 | 联系技术支持 |
| 9999 | 未知异常 | 计费服务不可用等 | 稍后重试 |

## 注意事项

1. **响应体是文件本身**，不是 `{code, message, data}`；消费方需按 `Content-Type` 分流。
2. **文件编码为 UTF-8，行尾为 `\n`**，序号从 1 开始，时间戳格式为 `时:分:秒,毫秒`。
3. **断句依据是静音**：相邻两字间隔超过 250 毫秒就断开一条字幕，整段无法分割时合成一条。
4. **SRT 文本不经标点模型**：内容直接来自识别结果，通常不带标点。
5. **完全没识别到语音**时会返回一条 0 秒 → 30 秒的空字幕。
6. **重复调用会重复扣费**，超时后请勿盲目重试。

## 相关接口

* [语音转文案](asr.md)
* [语音转文本](asr-text.md)
* [文本对齐时间线](asr-text-align.md)
