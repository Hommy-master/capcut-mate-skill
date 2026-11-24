# asr_text_align（文本对齐时间线）

```
POST https://autosubrt.jcaigc.cn/openapi/autosubrt/v1/asr/text/align
```

> 依据官方接口文档 https://docs.jcaigc.cn/capcut-mate/ 整理。
> **这是独立的语音识别服务**：基地址 `https://autosubrt.jcaigc.cn`，路径前缀 `/openapi/autosubrt/v1/`。

## 功能描述

把**你提供的文本**按音频的时间轴对齐：服务端先识别音频，再把文本切成一行行字幕，
给出每行的起止时间，同时返回音频里每个字的时间线。适合「文案已经写好，只需要卡时间」的场景。
识别结果本身就是你要的文案时，用 [asr](asr.md) 更省事。

## 请求参数

```json
{
  "audio_url": "https://example.com/audio.mp3",
  "text": "多谢，请入席吧。",
  "max_chars_per_line": 15,
  "apiKey": "123e4567-e89b-12d3-a456-426614174000"
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| audio_url | string | ✅ | - | 音频文件 URL，需可被服务端直接下载 |
| text | string | ✅ | - | 与该音频对应的字幕文本 |
| max_chars_per_line | int | ❌ | 15 | 每行最大字数，超过则拆成多条字幕 |
| apiKey | string | 开启计费时必填 | - | 合法 UUID；可登录 <https://jcaigc.cn> 获取 |

`text` 先按标点切句（`。！？，；.!?,;:` 与换行都会切开），**切分后标点被去掉**；
超过 `max_chars_per_line` 的句子会再平均拆成多行。

## 响应格式

### 成功响应 (200)

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "texts": ["多谢", "请入席吧"],
    "timelines": [
      { "start": 2810000, "end": 3330000 },
      { "start": 4889000, "end": 6009000 }
    ],
    "words": ["多", "谢", "请", "入", "席", "吧"],
    "words_timelines": [
      { "start": 2810000, "end": 3070000 },
      { "start": 3070000, "end": 3330000 },
      { "start": 4889000, "end": 5320000 },
      { "start": 5320000, "end": 5620000 },
      { "start": 5620000, "end": 5860000 },
      { "start": 5860000, "end": 6009000 }
    ]
  }
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| code | int | 0 表示成功 |
| message | string | 提示信息 |
| data.texts | array | 对齐后的字幕文本列表，每行一条，**不含标点** |
| data.timelines | array | 与 `texts` 一一对应的行级时间线，**单位微秒** |
| data.timelines[].start | int | 开始时间（微秒） |
| data.timelines[].end | int | 结束时间（微秒） |
| data.words | array | **音频识别出的字**（不是用户文本切出来的字） |
| data.words_timelines | array | 与 `words` 一一对应的字级时间线，**单位微秒** |

### 错误响应

```json
{
  "code": 2003,
  "message": "下载文件失败"
}
```

错误体**不包含** `data` 字段；所有错误都返回 HTTP 200，需按 `code` 判断。

## 使用示例

```bash
curl -X POST https://autosubrt.jcaigc.cn/openapi/autosubrt/v1/asr/text/align \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "https://example.com/audio.mp3",
    "text": "多谢，请入席吧。",
    "max_chars_per_line": 15,
    "apiKey": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

拿到结果后可直接拼成 `add_captions` 的 `captions`：

```json
[
  {"start": 2810000, "end": 3330000, "text": "多谢"},
  {"start": 4889000, "end": 6009000, "text": "请入席吧"}
]
```

## 计费

按**音频时长**扣费：**0.00022 元/秒**，音频下载并识别完成之后才扣费；
**没有识别到语音也会按实际时长扣费**。与剪映小助手共用充值余额。

## 错误码说明

与 [asr](asr.md) 相同的主要错误码：

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 1001 | 参数校验失败 | 缺少 audio_url 或 text，或 apiKey 非法 | 检查请求参数 |
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

1. **时间单位是微秒**（1 秒 = 1000000），与 [asr](asr.md)、[asr_srt](asr-srt.md) 的毫秒不同；
   返回的时间线可直接用于 `add_captions` 的 `start` / `end`。
2. **`texts` 不含标点**：切句时标点被去掉；需要带标点的文案请用 [asr](asr.md)。
3. **`words` 是音频识别出的字**，不是 `text` 切出来的字。
4. **文本与音频不一致时仍会返回结果**：对齐用编辑距离，时间线只能保证大致贴合。
5. **没有识别到语音**时返回 `texts = [原始文本]`、`timelines = [{start: 0, end: 30000000}]`
   （30 秒占位）、`words` 与 `words_timelines` 为空数组，调用方需自行判断。
6. **重复调用会重复扣费**，超时后请勿盲目重试。

## 相关接口

* [语音转文案](asr.md)
* [语音转文本](asr-text.md)
* [语音转 SRT 字幕](asr-srt.md)
* [添加字幕](add-captions.md)
