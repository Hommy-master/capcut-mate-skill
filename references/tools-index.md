# 接口索引

> 完全开源免费｜开源仓库：<https://github.com/Hommy-master/capcut-mate>（Apache-2.0，Gitee 镜像 <https://gitee.com/taohongmin-gitee/capcut-mate>）

统一基地址：`https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`

完整地址 = 基地址 + `/{接口名}`。本技能使用的剪映小助手接口中，`get_draft` 使用 `GET`（`draft_id` 走 query 参数），
`upload_file` 使用 `multipart/form-data`，其余接口全部使用 `POST JSON`；`get_points` 是 `jcaigc.cn` 余额接口的
`GET`，不走该基地址。
文案生成（大语言模型）、图像生成、视频生成、数字人、音乐生成、语音网关与 autosubrt ASR
是独立服务，见下方单独章节。

接口英文名用于准确调用，中文说明用于快速理解。执行任务时只读取实际需要的参考文件，不要一次全读。

## 素材上传

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 上传本地文件，换取可用 URL（**收费** 0.005 元/MB，单次最低 0.002 元，需 apiKey；签名 URL 默认 7 天） | `upload_file` | POST multipart | [upload-file.md](upload-file.md) |

## 草稿生命周期

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 创建草稿 | `create_draft` | POST | [create-draft.md](create-draft.md) |
| 获取草稿文件列表 | `get_draft` | GET | [get-draft.md](get-draft.md) |
| 保存草稿 | `save_draft` | POST | [save-draft.md](save-draft.md) |
| 快速组合素材（一步出草稿） | `easy_create_material` | POST | [easy-create-material.md](easy-create-material.md) |

## 素材编排

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 添加视频 | `add_videos` | POST | [add-videos.md](add-videos.md) |
| 添加图片 | `add_images` | POST | [add-images.md](add-images.md) |
| 添加音频 | `add_audios` | POST | [add-audios.md](add-audios.md) |
| 添加字幕 | `add_captions` | POST | [add-captions.md](add-captions.md) |

## 效果增强

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 添加特效 | `add_effects` | POST | [add-effects.md](add-effects.md) |
| 添加滤镜 | `add_filters` | POST | [add-filters.md](add-filters.md) |
| 添加关键帧 | `add_keyframes` | POST | [add-keyframes.md](add-keyframes.md) |
| 添加蒙版 | `add_masks` | POST | [add-masks.md](add-masks.md) |
| 添加蒙版关键帧（`keyframes` 为数组） | `add_mask_keyframes` | POST | [add-mask-keyframes.md](add-mask-keyframes.md) |
| 添加美颜/美型/美妆/美体 | `add_beauty` | POST | [add-beauty.md](add-beauty.md) |
| 添加贴纸 | `add_sticker` | POST | [add-sticker.md](add-sticker.md) |
| 添加文本样式 | `add_text_style` | POST | [add-text-style.md](add-text-style.md) |

## 输出导出

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 生成视频（**收费**） | `gen_video` | POST | [gen-video.md](gen-video.md) |
| 查询生成状态 | `gen_video_status` | POST | [gen-video-status.md](gen-video-status.md) |

## 数据生成与检索

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 平均或随机拆分时间线 | `timelines` | POST | [timelines.md](timelines.md) |
| 按音频生成时间线 | `audio_timelines` | POST | [audio-timelines.md](audio-timelines.md) |
| 生成图片数据 | `imgs_infos` | POST | [imgs-infos.md](imgs-infos.md) |
| 生成视频数据 | `video_infos` | POST | [video-infos.md](video-infos.md) |
| 生成音频数据 | `audio_infos` | POST | [audio-infos.md](audio-infos.md) |
| 生成字幕数据 | `caption_infos` | POST | [caption-infos.md](caption-infos.md) |
| 生成特效数据 | `effect_infos` | POST | [effect-infos.md](effect-infos.md) |
| 生成滤镜数据 | `filter_infos` | POST | [filter-infos.md](filter-infos.md) |
| 生成关键帧数据 | `keyframes_infos` | POST | [keyframes-infos.md](keyframes-infos.md) |
| 查询文字动画 | `get_text_animations` | POST | [get-text-animations.md](get-text-animations.md) |
| 查询图片动画 | `get_image_animations` | POST | [get-image-animations.md](get-image-animations.md) |
| 查询花字 | `get_text_effects` | POST | [get-text-effects.md](get-text-effects.md) |
| 查询滤镜列表（取 `filter_title`） | `get_filters` | POST | [get-filters.md](get-filters.md) |
| 查询特效列表（取 `effect_title`） | `get_effects` | POST | [get-effects.md](get-effects.md) |
| 搜索贴纸 | `search_sticker` | POST | [search-sticker.md](search-sticker.md) |
| 获取音频时长 | `get_audio_duration` | POST | [get-audio-duration.md](get-audio-duration.md) |
| 查询账户余额（jcaigc.cn 网关，免费） | `get_points` | GET | [get-points.md](get-points.md) |

## 格式转换

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 从文本提取 URL | `get_url` | POST | [get-url.md](get-url.md) |
| 字符串转列表 | `str_to_list` | POST | [str-to-list.md](str-to-list.md) |
| 字符串列表转对象列表 | `str_list_to_objs` | POST | [str-list-to-objs.md](str-list-to-objs.md) |
| 对象列表转字符串列表 | `objs_to_str_list` | POST | [objs-to-str-list.md](objs-to-str-list.md) |

## 文案生成（大语言模型网关）

文案生成走独立网关：基地址 `https://api.jcaigc.cn/v1`，鉴权用 `Authorization: Bearer <apiKey>`，
**按 token 计费**。**本技能只接入 `gemini-3.5-flash-lite`，不接入其它大语言模型**。

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 生成/润色视频文案、口播文案、短视频脚本 | `POST /v1/chat/completions` | POST | [generate-script.md](generate-script.md) |

| 模型 | 输入 | 输出 |
|---|---|---|
| `gemini-3.5-flash-lite` | **2.25 元/百万 token** | **18.75 元/百万 token** |

计费按 `usage.prompt_tokens` / `usage.completion_tokens` 计算；失败请求不计费。
主要用于生成口播文案，结果可交给语音合成/数字人或作为字幕文本。

## 图像生成（独立网关）

图像生成走独立网关：基地址 `https://api.jcaigc.cn/v1`，鉴权用 `Authorization: Bearer <apiKey>`，
**按张计费**，同步返回图片 URL。**默认模型 `doubao-seedream-5-0-flash`（0.12 元/张）**；
用户未指定时用它，调用前告知计费并可换其它模型。**比例跟随草稿**：1080×1920 → 9:16
（非 Gemini `size`，Gemini `aspect_ratio`）；1920×1080 → 16:9；用户指定优先。

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 文生图 / 参考图改图 | `POST /v1/images/generations` | POST | [generate-image.md](generate-image.md) |
| 查询当前可用模型 | `GET /v1/models` | GET | [generate-image.md](generate-image.md) |

支持模型：`qwen-image-3.0-pro`、`qwen-image-3.0`、`wan2.7-image`、`wan2.7-image-pro`、
`doubao-seedream-5-0-pro`、`doubao-seedream-5-0-flash`、`gemini-3.1-flash-image`、
`gemini-3.1-flash-lite-image`。完整参数、单价与超时说明见 [generate-image.md](generate-image.md)。

## 视频生成（独立网关）

视频生成走同一网关：基地址 `https://api.jcaigc.cn/v1`，鉴权用 `Authorization: Bearer <apiKey>`，
**按秒计费**，异步提交后轮询。**默认 `doubao-seedance-2.0` + `480P`（0.45 元/秒）**；
用户未指定时用它，调用前告知计费与时长，并可换其它模型/分辨率。**比例跟随草稿**：
1080×1920 → `aspect_ratio: "9:16"`；1920×1080 → `"16:9"`；用户指定优先。

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 提交文生视频 / 图生视频 | `POST /v1/video/generations` | POST | [generate-video.md](generate-video.md) |
| 轮询任务结果 | `GET /v1/video/generations/{task_id}` | GET | [generate-video.md](generate-video.md) |
| 查询当前可用模型 | `GET /v1/models` | GET | [generate-video.md](generate-video.md) |

支持的模型与单价见 [generate-video.md](generate-video.md)。轮询必须用同一把 `apiKey`；
`failed` 全额退还，30 分钟未取结果会 `expired` 且不退预扣费用。

## 数字人（复用视频网关）

数字人没有单独端点，复用 `POST /v1/video/generations`；**方案由入参决定**：

| 方案 | 入参 | 模型 | 单价 |
|---|---|---|---|
| 视频对口型 | `video_url` + `audio_url` | `videoretalk` | **0.08 元/秒** |
| 图片说话 | `image_url` + `audio_url` | `wan2.2-s2v` | **480P 0.5 元/秒（默认）/ 720P 0.9 元/秒** |

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 提交数字人任务 | `POST /v1/video/generations` | POST | [digital-human.md](digital-human.md) |
| 轮询任务结果 | `GET /v1/video/generations/{task_id}` | GET | [digital-human.md](digital-human.md) |

图片说话音频 ≤20 秒；视频对口型音频可到 120 秒。模型必须与入参匹配；失败全额退还，
30 分钟未取结果会 `expired` 且不退预扣费用。**比例跟随草稿**：1080×1920 选竖向人像/竖屏视频，
1920×1080 选横屏素材；用户指定优先。

## 音乐生成（独立网关）

音乐生成走同一网关：基地址 `https://api.jcaigc.cn/v1`，鉴权用 `Authorization: Bearer <apiKey>`，
**按次计费**，异步提交后轮询。**默认 `minimax-music-2.0`（0.25 元/次）**；
用户未指定时用它，调用前告知单次价格，并可换 `minimax-music-3.0`（1 元/次）。

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 提交音乐生成 | `POST /v1/music/generations` | POST | [generate-music.md](generate-music.md) |
| 轮询任务结果 | `GET /v1/music/generations/{task_id}` | GET | [generate-music.md](generate-music.md) |
| 查询当前可用模型 | `GET /v1/models` | GET | [generate-music.md](generate-music.md) |

一次任务生成一首完整的歌；失败全额退还，30 分钟未取结果会 `expired` 且不退预扣费用；
结果音频地址默认 7 天有效。

## 语音（独立网关）

语音识别、语音合成与声音复刻走独立网关：基地址 `https://api.jcaigc.cn/v1`，
鉴权用 `Authorization: Bearer <apiKey>`。**默认模型**：
ASR `volc.bigasr.auc_turbo`（0.00022 元/秒）、TTS `seed-tts-2.0`（2.8 元/万字符）、
声音复刻 `cosyvoice-v3.5-plus`（9.9 元/个）；用户可换其它模型。

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 语音转写（默认 `volc.bigasr.auc_turbo`） | `POST /v1/audio/transcriptions` | POST multipart | [voice-transcribe.md](voice-transcribe.md) |
| 语音合成（默认 `seed-tts-2.0`） | `POST /v1/audio/speech` | POST JSON | [voice-tts.md](voice-tts.md) |
| 创建复刻音色（默认 `cosyvoice-v3.5-plus`） | `POST /v1/audio/voices` | POST multipart | [voice-clone.md](voice-clone.md) |
| 列出/查询/删除复刻音色 | `GET/DELETE /v1/audio/voices[/{voice_id}]` | GET/DELETE | [voice-clone.md](voice-clone.md) |
| 音色库（模型对应的可用音色 ID） | — | — | [voice-voices.md](voice-voices.md) |

音色与模型必须配套：`seed-tts-2.0` 用豆包 `*_uranus_bigtts`；`qwen3-tts-flash` 用千问内置音色；
`cosyvoice-v3.5-*` 没有系统音色，需先复刻。

## 字幕/时间线 ASR（autosubrt 独立服务）

autosubrt ASR 是**独立服务**：基地址 `https://autosubrt.jcaigc.cn`，路径前缀 `/openapi/autosubrt/v1/`，
按音频时长 **0.00022 元/秒** 计费，识别成功后才扣费，需要 `apiKey`。适合 SRT 字幕、逐字时间线
与文本对齐；普通「音频转文字」用上面的语音网关（默认 `volc.bigasr.auc_turbo`）。

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 语音转文案（分句 + 逐字时间线，**毫秒**） | `asr` | POST | [asr.md](asr.md) |
| 语音转文本（只返回带标点的文本） | `asr_text` | POST | [asr-text.md](asr-text.md) |
| 语音转 SRT 字幕（直接返回文件本体） | `asr_srt` | POST | [asr-srt.md](asr-srt.md) |
| 文本对齐时间线（**微秒**，可直接给 `add_captions`） | `asr_text_align` | POST | [asr-text-align.md](asr-text-align.md) |

## 指南

| 内容 | 参考 |
|---|---|
| 调用顺序、硬规则、最小示例 | [llm-guide.md](llm-guide.md) |
| 核心写接口的最小请求体 | [llm-contract.md](llm-contract.md) |

## 本地脚本（不经 API）

| 需求 | 脚本 | 参考 |
|---|---|---|
| 通用接口调用 | `scripts/call-api.mjs` | [llm-guide.md](llm-guide.md) |
| 查询账户余额（jcaigc.cn 网关，免费） | `scripts/get-points.mjs` | [get-points.md](get-points.md) |
| 文案生成调用（大语言模型网关） | `scripts/generate-script.mjs` | [generate-script.md](generate-script.md) |
| 图像生成调用（独立网关） | `scripts/generate-image.mjs` | [generate-image.md](generate-image.md) |
| 视频生成调用（独立网关） | `scripts/generate-video.mjs` | [generate-video.md](generate-video.md) |
| 数字人调用（复用视频网关） | `scripts/generate-digital-human.mjs` | [digital-human.md](digital-human.md) |
| 音乐生成调用（独立网关） | `scripts/generate-music.mjs` | [generate-music.md](generate-music.md) |
| 语音识别调用（网关） | `scripts/transcribe-audio.mjs` | [voice-transcribe.md](voice-transcribe.md) |
| 语音合成调用（网关） | `scripts/generate-speech.mjs` | [voice-tts.md](voice-tts.md) |
| 声音复刻调用（网关） | `scripts/clone-voice.mjs` | [voice-clone.md](voice-clone.md) |
| 字幕/时间线 ASR（autosubrt） | `scripts/call-asr.mjs` | [asr.md](asr.md) |
| 导出任务轮询 | `scripts/poll-gen-video.mjs` | [gen-video-status.md](gen-video-status.md) |
| 下载草稿到本机剪映草稿箱（素材本地化 + 激活发现） | `scripts/download-draft.mjs` | [download-draft.md](download-draft.md) |
| 旧版安装入口（兼容别名） | `scripts/install-draft.mjs` | [download-draft.md](download-draft.md) |

## 不要主动调用的接口

以下接口是给扣子（Coze）/ n8n 等平台**拼 JSON 字符串**用的辅助接口。原生 function calling 场景下不要主动调用，
直接自己构造 JSON 字符串传给对应 `add_*` 即可：

`timelines`、`audio_timelines`、`video_infos`、`audio_infos`、`imgs_infos`、`caption_infos`、
`effect_infos`、`filter_infos`、`keyframes_infos`、`str_to_list`、`str_list_to_objs`、`objs_to_str_list`

详细约定见 [api-conventions.md](api-conventions.md)。
