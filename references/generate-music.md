# generate_music（音乐生成）

```
POST https://api.jcaigc.cn/v1/music/generations
GET  https://api.jcaigc.cn/v1/music/generations/{task_id}
```

> 依据官方文档 https://docs.jcaigc.cn/music/ 整理。
> **这是独立的音乐生成网关**：基地址 `https://api.jcaigc.cn/v1`，鉴权用
> `Authorization: Bearer <apiKey>`（也接受 `x-api-key`）。

## 功能描述

用一段风格提示词加一段歌词，生成一首完整的歌。提交是**异步**的：先拿任务号，再轮询取结果。
一次任务生成一首完整的歌；音频时长与歌词长度都不影响计费。

## 默认模型与选择

**用户没有指定时，默认使用 `minimax-music-2.0`（0.25 元/次）**。
调用前必须告知用户：所选模型、单次价格与任务数量，并说明可以换其它模型。

| 模型 | 说明 | 单价 |
|------|------|------|
| `minimax-music-2.0` | MiniMax Music 2.0，成本更低的一档 | **0.25 元/次（默认）** |
| `minimax-music-3.0` | MiniMax Music 3.0，更新的编曲与演唱效果，支持采样率与码率设置 | **1 元/次** |

- 两款模型都由 MiniMaxMusic 承接；`GET /v1/models` 可查当前账号可用清单。
- 价目表没有的模型会返回 HTTP 503 `model_not_priced`。

## 请求参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 模型名；本技能默认 `minimax-music-2.0` |
| `prompt` | 是 | 风格提示词，描述曲风、乐器、人声音色与情绪 |
| `lyrics` | 否 | 歌词；可用 `[Verse]` / `[Chorus]` 标注段落，留空由模型按风格发挥 |
| `output_format` | 否 | `mp3`（默认）/ `wav` / `flac`；别名 `format` 同样接受 |
| `sample_rate` | 否 | 采样率（Hz），**仅 `minimax-music-3.0`** |
| `bitrate` | 否 | 码率（bps），**仅 `minimax-music-3.0`** |

## 提交示例

```bash
curl -X POST https://api.jcaigc.cn/v1/music/generations \
  -H "Authorization: Bearer 123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "minimax-music-2.0",
    "prompt": "轻快的民谣流行歌曲，温暖的木吉他扫弦，钢琴点缀，男声温柔治愈，节奏舒缓",
    "lyrics": "[Verse]\n晨光落在安静的窗台\n风把昨天轻轻吹开\n\n[Chorus]\n就让阳光铺满肩膀\n让脚步跟着节拍摇晃",
    "output_format": "mp3"
  }'
```

### 提交响应

```json
{
  "id": "task_...",
  "task_id": "task_...",
  "object": "music.generation",
  "created": 1699999999,
  "model": "minimax-music-2.0",
  "status": "queued",
  "progress": 0
}
```

`id` 与 `task_id` 是同一个值的两个别名。

## 轮询

```bash
curl https://api.jcaigc.cn/v1/music/generations/task_你的任务号 \
  -H "Authorization: Bearer 123e4567-e89b-12d3-a456-426614174000"
```

```json
{
  "id": "task_...",
  "status": "succeeded",
  "progress": 100,
  "data": [{ "url": "https://..." }],
  "audio_url": "https://..."
}
```

| `status` | 含义 | 下一步 |
|----------|------|--------|
| `queued` | 排队中 | 继续轮询 |
| `processing` | 生成中 | 继续轮询 |
| `succeeded` | 已完成 | 读 `audio_url` 或 `data[0].url` |
| `failed` | 失败 | 读 `error.message`，停止 |
| `expired` | 超时未取走结果 | 停止；预扣费用**不退还** |

轮询规则：

- 轮询**不计费**；网关对上游最多每 2 秒查询一次，更密请求返回缓存状态。
- 建议每 3–5 秒轮询一次；任务超过 **30 分钟**没有取到终态会变成 `expired`。
- 必须用**提交任务时的同一把 apiKey** 轮询，换 key/账号会返回 `404 task_not_found`。
- `failed` 任务全额退还；`expired` 不退还。

## 计费

**按次计费**：一次任务固定收一次价，音频时长与歌词长度都不影响金额。

| 模型 | 单价 |
|------|------|
| `minimax-music-2.0` | **0.25 元/次** |
| `minimax-music-3.0` | **1 元/次** |

- 提交时按所选模型的一次价预扣，任务完成结算时金额不变，不产生时长或字符数补差。
- 失败任务全额退还；`expired` 不退还。
- 上表是网关出厂价目表，线上实际单价以控制台「模型与定价」为准。

## 注意事项

1. **默认模型**：用户未指定时用 `minimax-music-2.0`（0.25 元/次）；调用前告知模型、
   单次价格与任务数量，并说明可换 `minimax-music-3.0`（1 元/次）。
2. **一次任务一首歌**：按次计费，与时长、歌词长度无关；多首需多次提交。
3. **采样率/码率**：只有 `minimax-music-3.0` 支持；给 2.0 传会被上游忽略或拒绝。
4. **音频地址 7 天有效**：生成结果保存在临时存储，需要长期保存请及时下载。
5. **及时轮询**：30 分钟不取结果会 `expired` 且不退预扣费用。
6. **与草稿配合**：拿到 `audio_url` 后可直接作为 `add_audios` 的 `audio_infos[].audio_url`。

## 相关接口

* [添加音频](add-audios.md)
* [语音合成](voice-tts.md)
* [账户余额](get-points.md)
* [音乐生成文档](https://docs.jcaigc.cn/music/)
