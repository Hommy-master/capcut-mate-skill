# 精简契约

> 摘自官方《精简契约》 https://docs.jcaigc.cn/guide/llm-contract.zh.html ，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 核心接口一览

| 接口 | 方法 | 必填 | JSON 字符串字段 | 必须接着传的返回字段 |
|------|------|------|-----------------|----------------------|
| create_draft | POST | 无（默认 1920x1080） | 无 | `draft_url` |
| add_videos | POST | `draft_url`, `video_infos` | `video_infos` | `draft_url`, `segment_ids` |
| add_audios | POST | `draft_url`, `audio_infos` | `audio_infos` | `draft_url` |
| add_images | POST | `draft_url`, `image_infos` | `image_infos` | `draft_url`, `segment_ids` |
| add_captions | POST | `draft_url`, `captions` | `captions` | `draft_url` |
| gen_video | POST | `draft_url`；线上导出建议带 `apiKey` | 无 | 无（去查状态） |
| gen_video_status | POST | `draft_url` | 无 | `status`, `video_url` |

## 草稿修改约定

草稿只能通过本技能的接口生成和修改；除下载器安装时的素材本地化改写外，不要直接修改、替换或用
脚本改写下载到本机的剪映草稿文件（剪映草稿文件是加密的）。需要调整时重新走 `create_draft` +
`add_*` 流程；图片、视频、音频 URL 可以直接复用，非必要不要重新上传。

## 完成后的默认动作

`save_draft` 后默认把草稿下载到本机剪映草稿目录，并告诉用户可以用剪映打开草稿查看成片。
随后询问用户是否需要自动导出成片；需要时要求提供 `apiKey`，不知道从哪里获取时提示
<https://jcaigc.cn>，再走 `gen_video` + `gen_video_status`。

## 最小请求体

### create_draft

```json
{ "width": 1080, "height": 1920 }
```

响应关键字段：`draft_url`。

### add_videos

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=REPLACE",
  "video_infos": "[{\"video_url\":\"https://example.com/clip.mp4\",\"start\":0,\"end\":5000000}]"
}
```

`video_infos` 数组项常用字段：`video_url`（必填，http/https）、`start`、`end`；可选 `duration`、`volume`、`transition`、`transition_duration`、`mask`。

### add_audios

```json
{
  "draft_url": "YOUR_DRAFT_URL",
  "audio_infos": "[{\"audio_url\":\"https://example.com/bgm.mp3\",\"start\":0,\"end\":10000000}]"
}
```

### add_images

```json
{
  "draft_url": "YOUR_DRAFT_URL",
  "image_infos": "[{\"image_url\":\"https://example.com/cover.png\",\"start\":0,\"end\":5000000}]"
}
```

### add_captions

```json
{
  "draft_url": "YOUR_DRAFT_URL",
  "captions": "[{\"start\":0,\"end\":5000000,\"text\":\"你好剪映\"}]",
  "font_size": 15,
  "text_color": "#ffffff",
  "transform_x": 0,
  "transform_y": -800
}
```

`text` 默认每行少于 15 个汉字且不含标点：先按标点断句并去掉标点，仍超长再硬切（不拆数字和英文单词）。
画布为 1080×1920 时，字幕位置默认 `transform_x: 0`、`transform_y: -800`。

### gen_video

```json
{
  "draft_url": "YOUR_DRAFT_URL",
  "apiKey": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### gen_video_status

```json
{ "draft_url": "YOUR_DRAFT_URL" }
```

`status`：`pending` | `processing` | `completed` | `failed`。仅 `completed` 时读取 `video_url`。

## 图层顺序

图片、视频、音频、特效、滤镜、字幕、贴纸都有图层/轨道：先添加的在底层，后添加的在上层；
音频是独立层，始终位于最底层；时间线重合时会互相遮挡。需要调整前后关系时，调整对应 `add_*` 的调用顺序。

## 增强接口（按需）

| 接口 | 必填 | 备注 |
|------|------|------|
| upload_file | `file`（multipart），托管版带 `apiKey` | **收费** 0.0005 元/MB；返回 url 可直接给 `add_*` 用；临时文件最多下载 10 次（仅下载草稿触发），被删除后需重传 |
| add_effects | `draft_url`, `effect_infos` | `effect_infos` 为 JSON 字符串 |
| add_filters | `draft_url`, `filter_infos` | `filter_infos` 为 JSON 字符串 |
| add_keyframes | `draft_url`, `keyframes` | `keyframes` 为 JSON 字符串 |
| add_masks | `draft_url`, `segment_ids`, `name` | 先有视频/图片片段 |
| add_sticker | `draft_url`, `sticker_id`, `start`, `end` | sticker_id 来自 search_sticker |
| save_draft | `draft_url` | 通常可省略，写接口会落盘 |

## 相关文档

* [调用指南](llm-guide.md)
* [发现入口 llms.txt](https://docs.jcaigc.cn/llms.txt)
