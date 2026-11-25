# digital_human（数字人：视频对口型 / 图片说话）

```
POST https://api.jcaigc.cn/v1/video/generations
GET  https://api.jcaigc.cn/v1/video/generations/{task_id}
```

> 依据官方文档 https://docs.jcaigc.cn/avatar/ 整理。
> 数字人**没有单独端点**，复用视频生成接口；基地址 `https://api.jcaigc.cn/v1`，
> 鉴权用 `Authorization: Bearer <apiKey>`（也接受 `x-api-key`）。

## 两种方案

| 方案 | 入参 | 模型 | 效果 |
|------|------|------|------|
| 视频对口型 | `video_url` + `audio_url` | `videoretalk` | 只换口型，机位、动作、背景沿用原视频 |
| 图片说话 | `image_url` + `audio_url` | `wan2.2-s2v` | 让人像图按音频开口 |

**方案由入参决定**：传 `video_url` 走视频对口型，传 `image_url` 走图片说话。
模型名必须与方案匹配，错配会在上游报错。

- 已有拍好的人物视频、只想改人声/翻译/重录 → 视频对口型。
- 只有一张人像图 → 图片说话。
- 两者都有：优先按视频对口型处理；图片可作为 `ref_image_url` 指定画面中的哪张脸。

## 计费

按**生成视频的时长**（口型被驱动的时长）计费：

| 方案 | 模型 | 分辨率 | 单价 |
|------|------|--------|------|
| 视频对口型 | `videoretalk` | 不分档位 | **0.08 元/秒** |
| 图片说话 | `wan2.2-s2v` | 480P | **0.5 元/秒** |
| 图片说话 | `wan2.2-s2v` | 720P | **0.9 元/秒** |

- 提交时先预扣，任务终结后按真实时长结算差额。
- 无法判断时长时按上限预估：视频对口型 **120 秒**、图片说话 **20 秒**。
- 图片说话未指定分辨率时按 720P 预扣，结算时按真实分辨率退补；本技能默认用 **480P**。
- 失败任务全额退还；30 分钟未取到终态的 `expired` 任务不退还预扣费用。
- 线上实际单价以控制台「模型与定价」为准；价目表外的模型返回 503 `model_not_priced`。

## 方案一：视频对口型（videoretalk）

### 请求参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 固定 `videoretalk` |
| `video_url` | 是 | 人物视频地址 |
| `audio_url` | 是 | 驱动音频地址；别名 `audio` |
| `ref_image_url` | 否 | 参考人脸图；画面有多人时指定对哪张脸 |
| `video_extension` | 否 | 音频比视频长时是否延长画面，默认 `false` |
| `query_face_threshold` | 否 | 人脸匹配置信度 120–200，默认 170，**越小越宽松**；仅给了 `ref_image_url` 时生效 |

`resolution` / `size` 对该通道无意义，传了会被忽略。

### 输入要求

| 输入 | 要求 |
|------|------|
| 视频 | mp4 / avi / mov，2–120 秒，≤300MB，15–60fps，边长 640–2048；正面近景效果最好 |
| 音频 | wav / mp3 / aac，2–120 秒，≤30MB；干净人声，先去背景音乐与环境噪音 |
| 参考图 | jpeg/jpg/png/bmp/webp，≤10MB，长宽比 ≤2，最大边长 ≤4096；须是视频里出现过的清晰正脸 |

默认不延长画面：输出与输入视频等长，音频超出部分会被截断。需要画面跟音频走时传
`"video_extension": true`。

### 请求示例

```bash
curl -X POST https://api.jcaigc.cn/v1/video/generations \
  -H "Authorization: Bearer <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "videoretalk",
    "video_url": "https://example.com/speaker.mp4",
    "audio_url": "https://example.com/voice.mp3",
    "video_extension": true
  }'
```

## 方案二：图片说话（wan2.2-s2v）

### 请求参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 固定 `wan2.2-s2v` |
| `image_url` | 是 | 人像图地址；别名 `image`、`first_frame_image`、`img_url` |
| `audio_url` | 是 | 音频地址；别名 `audio` |
| `resolution` | 否 | `480P` / `720P`，同时决定计费档位；本技能默认 `480P` |

### 输入要求

- 图片与音频必须同时提供；只有音频会直接 400。
- 人像图建议正脸、光线均匀、肩部以上构图。
- **音频上限 20 秒**，超过会被上游拒绝；更长内容请拆成多段分别生成。

### 请求示例

```bash
curl -X POST https://api.jcaigc.cn/v1/video/generations \
  -H "Authorization: Bearer <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.2-s2v",
    "image_url": "https://example.com/portrait.jpg",
    "audio_url": "https://example.com/voice.mp3",
    "resolution": "480P"
  }'
```

## 响应与轮询

与视频生成完全一致：提交返回 `status: queued` 与 `task_id`；轮询到 `status: succeeded`
后读 `video_url` 或 `data[0].url`。

| `status` | 含义 |
|----------|------|
| `queued` | 排队中 |
| `processing` | 生成中 |
| `succeeded` | 已完成 |
| `failed` | 失败，读 `error.message` |
| `expired` | 超时未取走结果，预扣费用不退还 |

- 轮询不计费；建议每 3–5 秒一次；30 分钟未取结果会 `expired`。
- 必须用提交时的同一把 `apiKey` 轮询，换 key/账号返回 `404 task_not_found`。

## 本技能脚本

```bash
# 视频对口型
node scripts/generate-digital-human.mjs --api-key <uuid> \
  --video-url https://example.com/speaker.mp4 \
  --audio-url https://example.com/voice.mp3

# 图片说话（默认 480P）
node scripts/generate-digital-human.mjs --api-key <uuid> \
  --image-url https://example.com/portrait.jpg \
  --audio-url https://example.com/voice.mp3

# 720P + 下载成片
node scripts/generate-digital-human.mjs --api-key <uuid> \
  --image-url https://example.com/portrait.jpg \
  --audio-url https://example.com/voice.mp3 \
  --resolution 720P --output ./avatar.mp4
```

## 注意事项

1. **方案与模型匹配**：`video_url + audio_url` 用 `videoretalk`；
   `image_url + audio_url` 用 `wan2.2-s2v`。不要交叉。
2. **图片说话音频 ≤ 20 秒**：超过请拆段；视频对口型音频可到 120 秒。
3. **分辨率**：只有 `wan2.2-s2v` 有 480P/720P 档位；本技能默认 480P。
   视频对口型不分档位，传分辨率会被忽略。
4. **授权与隐私**：只处理用户本人或已获明确授权的人像/视频与音频；人脸、声音属于敏感数据。
5. **比例跟随草稿**：1080×1920 草稿选竖向人像图或竖屏人物视频；1920×1080 草稿选横屏素材。
   数字人没有 `aspect_ratio` 参数，输出方向跟随输入素材；用户指定方向时以用户为准。
6. **与草稿配合**：拿到 `video_url` 后可直接作为 `add_videos` 的 `video_infos[].video_url`。
7. **音频来源**：可先用 [语音合成](voice-tts.md) 生成配音，再喂给数字人。

## 相关接口

* [视频生成](generate-video.md)
* [语音合成](voice-tts.md)
* [添加视频](add-videos.md)
* [账户余额](get-points.md)
* [数字人文档](https://docs.jcaigc.cn/avatar/)
