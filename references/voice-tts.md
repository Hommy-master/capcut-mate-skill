# voice_tts（语音合成）

```
POST https://api.jcaigc.cn/v1/audio/speech
```

> 依据官方文档 https://docs.jcaigc.cn/voice/tts.md 整理。
> **这是独立的语音网关**：基地址 `https://api.jcaigc.cn/v1`，鉴权用
> `Authorization: Bearer <apiKey>`（也接受 `x-api-key`）。

## 默认模型与音色

**用户没有指定时，默认使用 `seed-tts-2.0`（2.8 元/万字符）**，
默认音色 **`zh_female_vv_uranus_bigtts`（Vivi，通用女声）**。
如果用户改用 `qwen3-tts-flash` 且未指定音色，默认用 `Cherry`；
`cosyvoice-v3.5-*` 与 `seed-icl-2.0` 没有系统音色，必须显式提供复刻音色 ID。

调用前必须告知用户：

1. 本次使用的模型与音色（默认 `seed-tts-2.0` / Vivi）；
2. 要朗读的字符数与预计费用（按字符计费）；
3. 用户可以换其它合成模型和音色，但**音色必须与模型配套**。

用户明确指定其它模型/音色时，按用户选择执行，不要擅自改回默认。

## 支持的模型与音色配对

| 模型 | 单价 | 可用的音色 |
|------|------|-----------|
| `seed-tts-2.0` | **2.8 元/万字符** | 豆包语音 2.0 预设音色，ID 以 `_uranus_bigtts` 结尾 |
| `qwen3-tts-flash` | **0.8 元/万字符** | 千问 48 条内置音色，如 `Cherry` / `Serena` / `Ethan` / `Chelsie`；不支持复刻 |
| `cosyvoice-v3.5-plus` | **1.5 元/万字符** | **没有系统音色**，只能用复刻/设计音色（ID 形如 `cosyvoice-v3.5-plus-…`） |
| `cosyvoice-v3.5-flash` | **0.8 元/万字符** | 同上，复刻音色必须用 `-flash-` 创建 |
| `seed-icl-2.0` | **2.8 元/万字符** | 豆包复刻音色，ID 形如 `S_…` 或自定义代号 |

**音色不能跨家/跨代/跨模型使用**：

- `seed-tts-2.0` 只能配豆包 `*_uranus_bigtts`；填千问的 `Cherry` 会得到
  **HTTP 200 + 空音频**（看着像成功但没声音）。
- `qwen3-tts-flash` 只能配千问内置音色；填豆包音色会被网关拒绝。
- `cosyvoice-v3.5-*` 没有系统音色；`longanyang` / `longanhuan` 属于上一代，填给 3.5 会报 418。
- 复刻音色与创建时使用的模型绑定：`-plus` 创建的音色只能配 `cosyvoice-v3.5-plus` 合成。

完整音色 ID 见 [音色库](voice-voices.md)。

## 请求参数

请求体是 JSON：

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 合成模型；本技能默认 `seed-tts-2.0` |
| `input` | 是 | 要合成的文本 |
| `voice` | 是 | 音色 ID（不是中文名）；本技能默认 `zh_female_vv_uranus_bigtts` |
| `response_format` | 否 | `mp3`（默认）、`wav`、`pcm`、`opus` |
| `speed` | 否 | 语速倍率 `0.5` ~ `2.0`，默认 `1.0`；`qwen3-tts-flash` 会忽略此参数 |

- `aac` / `flac` 不支持。
- 两家都按 24 kHz、单声道输出。
- 长文本请按句子分段合成再拼接，避免超过上游单次长度限制。

## 请求示例

```bash
curl -X POST https://api.jcaigc.cn/v1/audio/speech \
  -H "Authorization: Bearer 123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seed-tts-2.0",
    "voice": "zh_female_vv_uranus_bigtts",
    "input": "欢迎使用简创 AIGC 的语音合成能力。",
    "response_format": "mp3"
  }' \
  --output welcome.mp3
```

### 本技能脚本

```bash
node scripts/generate-speech.mjs --api-key <uuid> --text '欢迎使用语音合成' --output welcome.mp3
node scripts/generate-speech.mjs --api-key <uuid> --text '...' \
  --model qwen3-tts-flash --voice Cherry --output welcome.mp3
```

## 响应

成功时响应体是**音频二进制**，`Content-Type` 随 `response_format` 变化
（`audio/mpeg`、`audio/wav` 等），直接写文件即可。

失败时返回 JSON 错误体：

```json
{
  "error": {
    "message": "音色不存在或与模型不匹配",
    "type": "invalid_request_error",
    "code": "invalid_request"
  }
}
```

## 计费

按**要朗读的文本字符数**计费，首尾空白不计；中英文都按字符数（一个字母算一个字符）：

| 模型 | 单价 |
|------|------|
| `qwen3-tts-flash` / `cosyvoice-v3.5-flash` | 0.8 元/万字符 |
| `cosyvoice-v3.5-plus` | 1.5 元/万字符 |
| `seed-tts-2.0` / `seed-icl-2.0` | 2.8 元/万字符 |

示例：1000 个字符用 `seed-tts-2.0` 约 0.28 元；用 `qwen3-tts-flash` 约 0.08 元。
失败请求不计费；复刻音色的创建/查询不产生合成费用（创建另收 9.9 元/个）。

## 注意事项

1. **默认**：`seed-tts-2.0` + `zh_female_vv_uranus_bigtts`（2.8 元/万字符）；
   调用前告知模型、音色、字符数与预计费用，并说明可换其它模型/音色。
2. **音色配对**：千问、豆包、CosyVoice 不能交叉；`seed-tts-2.0` 配千问音色会得到空音频。
3. **CosyVoice 3.5 没有系统音色**：先用 [声音复刻](voice-clone.md) 创建专属音色。
4. **语速**：仅支持 0.5~2.0；超出会被夹到边界，`qwen3-tts-flash` 忽略 `speed`。
5. **与草稿配合**：合成结果是音频文件，先保存到本地；要放进剪映草稿需再用
   [upload_file](upload-file.md) 上传成公网 URL，然后交给 `add_audios`。

## 相关接口

* [音色库](voice-voices.md)
* [声音复刻](voice-clone.md)
* [语音识别](voice-transcribe.md)
* [上传文件](upload-file.md)
* [添加音频](add-audios.md)
