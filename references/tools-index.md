# 接口索引

> 完全开源免费｜开源仓库：<https://github.com/Hommy-master/capcut-mate>（Apache-2.0，Gitee 镜像 <https://gitee.com/taohongmin-gitee/capcut-mate>）
> 可自行部署，部署后把下方基地址换成你的实例地址即可。

统一基地址：`https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`

完整地址 = 基地址 + `/{接口名}`。除 `get_draft` 使用 `GET`、`upload_file` 使用 `multipart/form-data` 外，
其余接口全部使用 `POST JSON`。

接口英文名用于准确调用，中文说明用于快速理解。执行任务时只读取实际需要的参考文件，不要一次全读。

## 素材上传

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 上传本地文件，换取可用 URL（**收费** 0.0005 元/MB，需 apiKey） | `upload_file` | POST multipart | [upload-file.md](upload-file.md) |

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
| 添加蒙版关键帧 | `add_mask_keyframes` | POST | [add-mask-keyframes.md](add-mask-keyframes.md) |
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
| 搜索贴纸 | `search_sticker` | POST | [search-sticker.md](search-sticker.md) |
| 获取音频时长 | `get_audio_duration` | POST | [get-audio-duration.md](get-audio-duration.md) |

## 格式转换

| 需求 | 接口 | 方法 | 参考 |
|---|---|---|---|
| 从文本提取 URL | `get_url` | POST | [get-url.md](get-url.md) |
| 字符串转列表 | `str_to_list` | POST | [str-to-list.md](str-to-list.md) |
| 字符串列表转对象列表 | `str_list_to_objs` | POST | [str-list-to-objs.md](str-list-to-objs.md) |
| 对象列表转字符串列表 | `objs_to_str_list` | POST | [objs-to-str-list.md](objs-to-str-list.md) |

## 指南

| 内容 | 参考 |
|---|---|
| 调用顺序、硬规则、最小示例 | [llm-guide.md](llm-guide.md) |
| 核心写接口的最小请求体 | [llm-contract.md](llm-contract.md) |

## 不要主动调用的接口

以下接口是给扣子（Coze）/ n8n 等平台**拼 JSON 字符串**用的辅助接口。原生 function calling 场景下不要主动调用，
直接自己构造 JSON 字符串传给对应 `add_*` 即可：

`timelines`、`audio_timelines`、`video_infos`、`audio_infos`、`imgs_infos`、`caption_infos`、
`effect_infos`、`filter_infos`、`keyframes_infos`、`str_to_list`、`str_list_to_objs`、`objs_to_str_list`

详细约定见 [api-conventions.md](api-conventions.md)。
