# generate_video（文生视频 / 图生视频）

```
POST https://api.jcaigc.cn/v1/video/generations
GET  https://api.jcaigc.cn/v1/video/generations/{task_id}
```

> 依据官方文档 https://docs.jcaigc.cn/video/ 整理。
> **这是独立的视频生成网关**：基地址 `https://api.jcaigc.cn/v1`，鉴权用
> `Authorization: Bearer <apiKey>`（也接受 `x-api-key`），与剪映小助手、ASR 不是同一个服务。

## 功能描述

用一段提示词（文生视频），或用一张首帧图加提示词（图生视频），生成一段短视频。
提交是**异步**的：先拿任务号，再轮询取结果。走文生还是图生**由入参决定**：带 `image_url`
走图生视频，否则走文生视频。

## 默认模型与选择

**用户没有指定时，默认使用 `doubao-seedance-2.0` + `480P`**：0.45 元/秒。

调用前必须向用户说明：

1. 本次使用的模型与分辨率（默认 `doubao-seedance-2.0` / `480P`）；
2. 预计时长与费用（按秒计费；未指定时长时按 5 秒估算，实际以任务结算为准）；
3. 用户可以换其它模型和分辨率，列出候选与单价让用户选择。

用户明确指定其它模型或分辨率时，按用户选择执行，不要擅自改回默认值。

## 按草稿画布选择宽高比

生成视频前先看草稿画布；用户明确指定比例时以用户为准：

| 草稿画布 | `aspect_ratio` |
|---|---|
| 1080×1920 | **`9:16`** |
| 1920×1080 | **`16:9`** |

- 默认模型与其它文生/图生视频模型都可以传 `aspect_ratio`；Veo 只支持 `16:9` 与 `9:16`。
- 不要默认生成 16:9 再裁切；需要与草稿一致时直接按上表传比例。

## 支持的模型与分辨率

| 模型 | 可用分辨率 | 单价（元/秒） |
|------|-----------|----------------|
| `doubao-seedance-2.0` | **480P（默认）**、720P、1080P、4K | 0.45 / 1 / 2.5 / 5 |
| `doubao-seedance-2.0-fast` | 480P、720P | 0.36 / 0.8 |
| `doubao-seedance-2.0-mini` | 480P、720P | 0.22 / 0.5 |
| `doubao-seedance-2.5` | 720P、1080P | 1.6 / 3.8 |
| `wan3.0-video` | 480P、720P、1080P | 0.3 / 0.6 / 1.2 |
| `happyhorse-1.1-t2v` | 480P、720P、1080P | 0.45 / 0.9 / 1.2 |
| `happyhorse-1.1-i2v` | 480P、720P、1080P | 0.45 / 0.9 / 1.2 |
| `veo-3.1` | 720P、1080P、2K、4K | 无声 1.5 / 1.5 / 2.25 / 3；有声 3 / 3 / 3.75 / 4.5 |
| `veo-3.1-fast` | 720P、1080P、2K、4K | 无声 0.75 / 0.75 / 1.5 / 2.25；有声 1.125 / 1.125 / 1.875 / 2.625 |
| `veo-3.1-lite` | 720P、1080P、2K、4K | 无声 0.225 / 0.375 / 0.6 / 0.75；有声 0.375 / 0.6 / 0.9 / 1.125 |

- `wan3.0-video` 与三条 `veo-*` 同时支持文生视频和图生视频；`happyhorse-1.1-t2v` 只支持文生，
  `happyhorse-1.1-i2v` 只支持图生。
- Veo 三条时长只支持 **4 / 6 / 8 秒**（缺省 8 秒），只做文生/图生；带 `audio_url` 或
  `video_url` 会直接返回 `400`。
- 数字人（`audio_url` / `video_url`）走同一个提交接口，但属于数字人能力，本参考不展开。

> 上表是网关价目表；**线上实际单价以控制台「模型与定价」为准**。模型可用性可用
> `GET https://api.jcaigc.cn/v1/models` 查询。价目表没有条目的模型会返回 HTTP 503
> `model_not_priced`。

## 请求参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 模型名；本技能默认 `doubao-seedance-2.0` |
| `prompt` | 文生视频必填 | 提示词 |
| `image_url` | 图生视频必填 | 首帧图地址；别名 `image`、`first_frame_image`、`img_url` |
| `negative_prompt` | 否 | 反向提示词 |
| `resolution` / `size` | 否 | 分辨率，同时影响计费档位；默认 `480P`（默认模型） |
| `aspect_ratio` / `ratio` | 否 | 宽高比；Veo 只支持 `16:9` 与 `9:16` |
| `duration` | 否 | 视频时长（秒）；Veo 只接受 `4` / `6` / `8`，缺省 `8` |
| `audio_generation` | 否 | 仅 Veo：`enabled` / `disabled`（也接受布尔值），默认 `disabled`；开启按有声档计价 |
| `last_frame_url` | 否 | 尾帧图地址（Veo），必须同时提供首帧 |
| `reference_images` | 否 | 参考图列表（Veo），最多 3 张，与首尾帧不能同时使用 |
| `prompt_extend` / `seed` | 否 | 交由上游处理的扩展参数 |
| `enhance_prompt` | 否 | 仅 Veo：是否让上游扩写提示词 |

## 提交示例

```bash
curl -X POST https://api.jcaigc.cn/v1/video/generations \
  -H "Authorization: Bearer 123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2.0",
    "prompt": "镜头缓慢推进，雨后的城市街道，霓虹倒影",
    "resolution": "480P",
    "aspect_ratio": "9:16",
    "duration": 5
  }'
```

### 提交响应

```json
{
  "id": "task_...",
  "task_id": "task_...",
  "object": "video.generation",
  "created": 1699999999,
  "model": "doubao-seedance-2.0",
  "status": "queued",
  "progress": 0
}
```

`id` 与 `task_id` 是同一个值的两个别名。

## 轮询

```bash
curl https://api.jcaigc.cn/v1/video/generations/task_你的任务号 \
  -H "Authorization: Bearer 123e4567-e89b-12d3-a456-426614174000"
```

```json
{
  "id": "task_...",
  "status": "succeeded",
  "progress": 100,
  "data": [{ "url": "https://..." }],
  "video_url": "https://..."
}
```

| `status` | 含义 | 下一步 |
|----------|------|--------|
| `queued` | 排队中 | 继续轮询 |
| `processing` | 生成中 | 继续轮询 |
| `succeeded` | 已完成 | 读 `video_url` 或 `data[0].url` |
| `failed` | 失败 | 读 `error.message`，停止 |
| `expired` | 超时未取走结果 | 停止；预扣费用**不退还** |

轮询规则：

- 轮询**不计费**；网关对上游最多每 2 秒查询一次，更密请求返回缓存状态。
- 建议每 3–5 秒轮询一次；任务超过 **30 分钟**没有取到终态会变成 `expired`。
- 必须用**提交任务时的同一把 apiKey** 轮询，换 key/账号会返回 `404 task_not_found`。
- `failed` 任务全额退还；`expired` 不退还。

## 计费

视频任务**按秒计费**，提交时按预估时长预扣，任务终结拿到真实用量后结算差额。

- 默认 `doubao-seedance-2.0` + `480P`：**0.45 元/秒**。例如 5 秒约 2.25 元。
- 按 `单价 × 真实时长（秒）` 结算；`n` 不适用于视频接口。
- 未指定 `duration` 时，网关按 5 秒预估预扣（Veo 按 4/6/8 秒，缺省 8 秒），完成时按真实时长补退。
- 未指定分辨率时按 720P 预扣，结算时按真实分辨率补退。
- 分辨率写成该模型没有的档位时，按该模型 720P 的价结算；建议先用本参考的模型表校验。
- Veo 的**无声 / 有声是两个价**：`audio_generation` 决定；不传即无声，任务终结按上游真实开关重算。
- 失败任务全额退还；`expired` 不退还。

## 注意事项

1. **默认模型 / 分辨率**：用户未指定时用 `doubao-seedance-2.0` + `480P`（0.45 元/秒）；
   调用前告知模型、分辨率、预计时长与费用，并说明可换其它模型和分辨率。
2. **比例跟随草稿**：1080×1920 草稿传 `aspect_ratio: "9:16"`；1920×1080 传 `"16:9"`。
   用户指定比例时以用户为准；Veo 只支持这两个比例。
3. **时长**：时长直接影响费用。用户未指定时可按 5 秒估算，但要说明这是估算；
   Veo 只接受 4 / 6 / 8 秒。
4. **图生视频**：提供 `image_url` 即走图生视频；`happyhorse-1.1-t2v` 不支持图生，
   `happyhorse-1.1-i2v` 必须提供首帧图。
5. **数字人**：带 `audio_url` / `video_url` 会进入数字人能力，见 [digital-human.md](digital-human.md)。
6. **及时轮询**：30 分钟不取结果会 `expired` 且不退预扣费用。
7. **与草稿配合**：拿到 `video_url` 后可直接作为 `add_videos` 的 `video_infos[].video_url`。

## 相关接口

* [添加视频](add-videos.md)
* [图像生成](generate-image.md)（先生成首帧再图生视频）
* [账户余额](get-points.md)
* [视频生成文档](https://docs.jcaigc.cn/video/)
