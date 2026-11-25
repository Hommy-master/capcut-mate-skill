# voice_transcribe（语音识别，网关）

```
POST https://api.jcaigc.cn/v1/audio/transcriptions
POST https://api.jcaigc.cn/v1/audio/translations
```

> 依据官方文档 https://docs.jcaigc.cn/voice/transcriptions.md 整理。
> **这是独立的语音网关**：基地址 `https://api.jcaigc.cn/v1`，鉴权用
> `Authorization: Bearer <apiKey>`（也接受 `x-api-key`）。

## 默认模型与选择

**用户没有指定时，默认使用 `volc.bigasr.auc_turbo`（豆包极速版，0.00022 元/秒）**。
调用前必须告知用户模型、单价与预计费用，并说明可以换其它识别模型。

| 模型 | 单价 | 音频怎么给 | 说明 |
|------|------|-----------|------|
| `volc.bigasr.auc_turbo` | **0.00022 元/秒** | **上传文件或公网地址** | **默认**；极速版，同步返回；单文件 ≤ 100MB、≤ 2 小时 |
| `qwen3-asr-flash` | 0.00022 元/秒 | 只能上传文件 | 阿里，响应快，适合短音频；约 < 7.5MB |
| `fun-asr` | 0.00022 元/秒 | 只能上传文件 | 与 `qwen3-asr-flash` 同链路同价 |
| `volc.seedasr.auc` | 0.00025 元/秒 | **只能给公网地址** | 豆包标准版，识别效果最好；网关内部轮询，最多等 10 分钟 |

选择建议：要传本地文件用默认极速版；音频已在公网、追求识别质量用 `volc.seedasr.auc`；
短音频用阿里两条。拿本地文件打 `volc.seedasr.auc` 会被拒绝。

## 请求参数

请求体是 `multipart/form-data`：

| 参数 | 必填 | 说明 |
|------|------|------|
| `file` | 二选一 | 音频文件本体 |
| `file_url` | 二选一 | 公网可访问的音频地址 |
| `model` | 是 | 识别模型；本技能默认 `volc.bigasr.auc_turbo` |
| `response_format` | 否 | `json`（默认）、`verbose_json` 或 `text` |
| `language` | 否 | 语种提示，如 `zh`、`en` |
| `timestamp_granularities[]` | 否 | 传 `word` 时，`verbose_json` 的分句里额外返回逐词时间线 `words`（豆包链路） |

### 音频格式与上限

| 上游 | 支持格式 |
|------|----------|
| 豆包语音 | `wav`、`mp3`、`ogg`、`aac`、`m4a`、`mp4`、`spx`、`amr`、`opus`（`flac` / `webm` / `wma` 不支持） |
| 阿里云百炼 | `mp3`、`mpeg`、`mp4`、`m4a`、`wav`、`aac`、`flac`、`ogg`、`opus`、`amr`、`webm`、`wma` |

- 豆包极速版：单文件 ≤ 100MB，时长 ≤ 2 小时。
- 阿里两条：原始文件需小于约 7.5MB，超长音频先切片。
- 豆包标准版：只给公网地址，不受文件体积限制，但最多等 10 分钟。

## 请求示例

```bash
# 上传本地文件（默认模型，收文件）
curl -X POST https://api.jcaigc.cn/v1/audio/transcriptions \
  -H "Authorization: Bearer 123e4567-e89b-12d3-a456-426614174000" \
  -F "file=@./audio.mp3" \
  -F "model=volc.bigasr.auc_turbo" \
  -F "language=zh" \
  -F "response_format=verbose_json"

# 音频已在公网：给地址
curl -X POST https://api.jcaigc.cn/v1/audio/transcriptions \
  -H "Authorization: Bearer <apiKey>" \
  -F "file_url=https://example.com/audio.mp3" \
  -F "model=volc.seedasr.auc" \
  -F "language=zh"
```

### 本技能脚本

```bash
node scripts/transcribe-audio.mjs --api-key <uuid> --file ./audio.mp3
node scripts/transcribe-audio.mjs --api-key <uuid> --file-url https://example.com/a.mp3 \
  --model volc.seedasr.auc --response-format verbose_json
```

## 响应

`json`（默认）与 `verbose_json` 返回 JSON；`text` 直接返回纯文本（`Content-Type: text/plain`）。

```json
{
  "text": "把音频变成文字，再交给下游使用。"
}
```

`verbose_json` 在识别出时长时额外带 `duration`（秒）与 `segments`（分句时间线，秒）：

```json
{
  "task": "transcribe",
  "text": "把音频变成文字，再交给下游使用。",
  "duration": 12.34,
  "segments": [
    { "id": 0, "start": 0, "end": 2.16, "text": "把音频变成文字，" },
    { "id": 1, "start": 2.16, "end": 5.02, "text": "再交给下游使用。" }
  ]
}
```

传 `timestamp_granularities[]=word` 时，每个分句还会带 `words`（逐词时间线，秒）。
词粒度由上游决定（中文通常逐字），没有有效时间的空格/占位词会被过滤。

## 计费

按**音频时长**计费，识别成功之后扣费，失败请求不计费：

| 模型 | 单价 | 备注 |
|------|------|------|
| `volc.bigasr.auc_turbo` | **0.00022 元/秒** | 折合 0.0132 元/分钟，1 小时约 0.79 元 |
| `qwen3-asr-flash` / `fun-asr` | 0.00022 元/秒 | 同上 |
| `volc.seedasr.auc` | 0.00025 元/秒 | 1 小时约 0.9 元 |

时长以上游返回为准；上游没返回时长时按 60 秒估算。

## 注意事项

1. **默认模型**：用户未指定时用 `volc.bigasr.auc_turbo`（0.00022 元/秒）；调用前告知模型、
   单价与预计费用，并说明可换其它模型。
2. **本地文件与公网地址**：豆包标准版只收公网地址；阿里两条只收上传文件；默认极速版两者都收。
3. **`/audio/translations` 不做翻译**：行为与转写完全一致，需要译文请把结果交给大语言模型。
4. **静音不算失败**：没有人声时返回空 `text`，不是报错。
5. **与 autosubrt 的区别**：网关转写不直接产出 SRT；需要 SRT 字幕或文本对齐时间线时，
   用剪映小助手侧的 [autosubrt](asr.md)。
6. **与草稿配合**：识别出的文本可直接构造 `add_captions` 的 `captions`；
   若需要精确时间轴，用 [asr_text_align](asr-text-align.md) 对齐后再交给 `add_captions`。

## 相关接口

* [语音合成](voice-tts.md)
* [声音复刻](voice-clone.md)
* [音色库](voice-voices.md)
* [autosubrt 字幕/时间线](asr.md)
* [添加字幕](add-captions.md)
