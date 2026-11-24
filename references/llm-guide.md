# 模型调用指南

> 摘自官方《模型调用指南》 https://docs.jcaigc.cn/capcut-mate/llm-guide.zh ，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 硬规则

1. **Base URL** 必须是 `https://capcut-mate.jcaigc.cn`，路径前缀 `/openapi/capcut-mate/v1/`。
2. **时间单位是微秒**：1 秒 = `1000000`。例如 5 秒片段写 `start: 0, end: 5000000`。
3. **先 `create_draft`，后续每次写接口带上返回的 `draft_url`**。不要自己编 `draft_id`。
4. **列表字段是 JSON 字符串**，不是对象数组：`video_infos`、`audio_infos`、`image_infos`、`captions`、`keyframes`、`effect_infos`、`filter_infos`。
5. 剪映小助手托管版仅 `gen_video`（0.3 元/分钟，VIP 0.24 / SVIP 0.18）与 `upload_file`（0.005 元/MB，单次最低 0.002 元）收费，需要 `apiKey`（UUID）。其余接口免费。图像生成与 ASR 是独立服务，另行计费。
6. 导出是异步：`gen_video` 只表示任务已提交，必须轮询 `gen_video_status`。
7. **图层顺序**：先添加的在下层、后添加的在上层；音频是独立层，始终在最底层轨道；时间线重合会遮挡。
8. **只能通过接口生成草稿**：除下载器安装时的素材本地化改写外，不要直接修改剪映草稿文件
   （草稿文件是加密的）。需要调整时重新运行 `create_draft` + `add_*`；图片、视频、音频 URL
   可复用，非必要不要重新上传。
9. **ASR 是独立服务**：基地址 `https://autosubrt.jcaigc.cn`，路径前缀 `/openapi/autosubrt/v1/`，
   按音频时长 0.00022 元/秒计费，需要 `apiKey`。`asr` / `asr_srt` 返回**毫秒**，
   `asr_text_align` 返回**微秒**（可直接给 `add_captions`）。
10. **图像生成是独立网关**：基地址 `https://api.jcaigc.cn/v1`，`POST /v1/images/generations`，
    鉴权用 `Authorization: Bearer <apiKey>`，按张计费（0.12–1.12 元/张），同步返回图片 URL。
11. **视频生成是同一独立网关**：`POST /v1/video/generations` 提交，`GET /v1/video/generations/{task_id}`
    轮询；按秒计费，默认 `doubao-seedance-2.0` + 480P（0.45 元/秒）。异步任务要及时轮询，
    30 分钟未取结果会 `expired` 且不退预扣费用。

## 默认工作流

0. 本地素材：`POST /upload_file`（multipart，收费 0.005 元/MB）换成公网 URL（签名 URL 默认 7 天；仅下载草稿触发下载，`add_*` 只登记 URL）
0.5 需要配图时：`POST https://api.jcaigc.cn/v1/images/generations` 生成图片（按张收费），拿 `data[].url`
1. `POST /create_draft` → 拿到 `draft_url`
2. 按需要多次调用 `add_videos` / `add_images` / `add_audios` / `add_captions`
3. 可选：`add_effects` / `add_filters` / `add_keyframes` / `add_masks`
4. 默认下载草稿到本机剪映草稿目录，并告诉用户可以用剪映打开草稿查看成片
5. 询问用户是否需要自动导出成片；需要时要求提供 `apiKey`（不知道从哪里获取时提示 <https://jcaigc.cn>）
6. `POST /gen_video`（线上导出带 `apiKey`）
7. 每 3–5 秒 `POST /gen_video_status`，直到 `status` 为 `completed` 或 `failed`
8. 成功后使用响应里的 `video_url`

```mermaid
flowchart LR
  createDraft[create_draft] --> addMedia["add_videos / add_audios / add_images / add_captions"]
  addMedia --> download[下载草稿到剪映]
  download --> ask{需要导出?}
  ask -->|是| genVideo[gen_video]
  genVideo --> poll[gen_video_status]
  poll -->|pending or processing| poll
  poll -->|completed| videoUrl[video_url]
```

## 可选：图像生成（独立网关）

需要配图/封面时，`POST https://api.jcaigc.cn/v1/images/generations`，
请求头 `Authorization: Bearer <apiKey>`。**默认模型 `doubao-seedream-5-0-flash`（0.12 元/张）**；
用户未指定时用它，调用前告知单价、张数与预计费用，并说明可以换其它模型。

```json
{
  "model": "doubao-seedream-5-0-flash",
  "prompt": "窗台上打盹的橘猫，晨光，浅景深",
  "size": "1024x1024",
  "n": 1
}
```

响应同步返回 `data[].url`，可直接作为 `add_images` 的 `image_url`。按张计费，`n` 张就是
`单价 × n`。Gemini 两条支持参考图改图、每次只生成 1 张、结果 URL 默认 7 天有效。
模型清单可用 `GET https://api.jcaigc.cn/v1/models` 查询。详见 [generate-image.md](generate-image.md)。

## 可选：视频生成（独立网关）

需要视频片段时，`POST https://api.jcaigc.cn/v1/video/generations`，
请求头 `Authorization: Bearer <apiKey>`。**默认模型 `doubao-seedance-2.0` + `480P`（0.45 元/秒）**；
用户未指定时用它，调用前告知模型、分辨率、时长与预计费用，并说明可换其它模型/分辨率。

```json
{
  "model": "doubao-seedance-2.0",
  "prompt": "镜头缓慢推进，雨后的城市街道，霓虹倒影",
  "resolution": "480P",
  "duration": 5
}
```

提交后返回 `task_id`，再 `GET /v1/video/generations/{task_id}` 轮询，`succeeded` 后读
`video_url` 或 `data[0].url`。按秒计费；`failed` 全额退还，30 分钟未取结果会 `expired`
且不退预扣费用。完整模型/分辨率/价格见 [generate-video.md](generate-video.md)。

## 可选：语音识别（ASR，独立服务）

需要从音频生成字幕时：

1. 已有人工校对文案：`POST https://autosubrt.jcaigc.cn/openapi/autosubrt/v1/asr/text/align`
   传 `audio_url` + `text` + `max_chars_per_line`，返回的 `timelines` 是微秒，直接作为
   `add_captions` 的 `start` / `end`。
2. 没有文案：`POST .../asr` 拿分句与逐字时间线（毫秒），或 `POST .../asr/srt` 直接拿 SRT 文件本体。
3. 只要纯文本：`POST .../asr/text`。

ASR 按音频时长 0.00022 元/秒计费，需要 `apiKey`；调用前先告知用户。详细参数见
[asr.md](asr.md) / [asr-text.md](asr-text.md) / [asr-srt.md](asr-srt.md) / [asr-text-align.md](asr-text-align.md)。

## 字幕默认规则

用户没有特别要求时：每行少于 15 个汉字；字幕不含标点，先按标点断句并去掉标点，
仍超长再硬切，硬切不要拆开数字和英文单词。画布为 1080×1920 时，字幕位置默认
`transform_x: 0`、`transform_y: -800`。用户有明确要求时按用户要求实现。

## 不要主动调用

以下接口是给扣子 / n8n 拼 JSON 字符串用的，原生 function calling **不要**调用：

* `timelines`、`audio_timelines`
* `video_infos`、`audio_infos`、`imgs_infos`、`caption_infos`、`effect_infos`、`filter_infos`、`keyframes_infos`
* `str_to_list`、`str_list_to_objs`、`objs_to_str_list`

直接构造 JSON 字符串传给 `add_*` 即可。

## 最小示例：竖屏短视频

```bash
# 1. 创建 1080x1920 草稿
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/create_draft \
  -H "Content-Type: application/json" \
  -d '{"width":1080,"height":1920}'

# 2. 添加 5 秒视频（把 YOUR_DRAFT_URL 换成上一步的 draft_url）
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_videos \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "video_infos": "[{\"video_url\":\"https://example.com/clip.mp4\",\"start\":0,\"end\":5000000}]"
  }'

# 3. 提交导出
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/gen_video \
  -H "Content-Type: application/json" \
  -d '{"draft_url":"YOUR_DRAFT_URL","apiKey":"YOUR_UUID_API_KEY"}'

# 4. 查询状态，直到 completed
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/gen_video_status \
  -H "Content-Type: application/json" \
  -d '{"draft_url":"YOUR_DRAFT_URL"}'
```

## 状态机

| status | 含义 | 下一步 |
|--------|------|--------|
| pending | 排队中 | 继续轮询 |
| processing | 渲染中 | 继续轮询 |
| completed | 成功 | 读取 `video_url` |
| failed | 失败 | 读取 `error_message`，不要死循环 |

## 相关文档

* [精简契约](llm-contract.md)
* [发现入口 llms.txt](https://docs.jcaigc.cn/llms.txt)
* [创建草稿](create-draft.md)
* [生成视频](gen-video.md)
* [查询导出状态](gen-video-status.md)
