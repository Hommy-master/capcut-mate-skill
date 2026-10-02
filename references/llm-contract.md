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
  "captions": "[{\"start\":0,\"end\":5000000,\"text\":\"你好，剪映\"}]",
  "font_size": 15,
  "text_color": "#ffffff"
}
```

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

## 增强接口（按需）

| 接口 | 必填 | 备注 |
|------|------|------|
| add_effects | `draft_url`, `effect_infos` | `effect_infos` 为 JSON 字符串 |
| add_filters | `draft_url`, `filter_infos` | `filter_infos` 为 JSON 字符串 |
| add_keyframes | `draft_url`, `keyframes` | `keyframes` 为 JSON 字符串 |
| add_masks | `draft_url`, `segment_ids`, `name` | 先有视频/图片片段 |
| add_sticker | `draft_url`, `sticker_id`, `start`, `end` | sticker_id 来自 search_sticker |
| save_draft | `draft_url` | 通常可省略，写接口会落盘 |

## 相关文档

* [调用指南](llm-guide.md)
* [发现入口 llms.txt](https://docs.jcaigc.cn/llms.txt)
