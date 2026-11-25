# 案例：三张图片、三段字幕和一首 BGM

目标：创建 1080×1920、9 秒、可继续编辑的竖屏剪映草稿，并可选导出成片。
以下 URL 和文字替换为用户素材。所有时间单位为微秒（1 秒 = `1000000`）。

> 本案例的 `*_infos` / `timelines` 调用属于「拼 JSON 字符串」用法，在原生 function calling 场景下
> 应改为**直接自己构造 JSON 字符串**。这里保留完整链路，便于对照排查。

## 1. 创建草稿

`create_draft` → `POST /openapi/capcut-mate/v1/create_draft`

```json
{"width":1080,"height":1920}
```

保存返回的 `draft_url`，后续**原样透传**。

## 2. 创建三段时间线（可选）

自己构造即可，无需调用接口：0–3 秒、3–6 秒、6–9 秒。

## 3. 添加图片

`add_images` → `POST /openapi/capcut-mate/v1/add_images`

```json
{
  "draft_url": "<draft_url>",
  "image_infos": "[{\"image_url\":\"https://example.com/1.jpg\",\"start\":0,\"end\":3000000},{\"image_url\":\"https://example.com/2.jpg\",\"start\":3000000,\"end\":6000000},{\"image_url\":\"https://example.com/3.jpg\",\"start\":6000000,\"end\":9000000}]",
  "alpha": 1,
  "scale_x": 1,
  "scale_y": 1,
  "transform_x": 0,
  "transform_y": 0
}
```

注意 `image_infos` 是 **JSON 字符串**，不是数组。

## 4. 添加字幕

`add_captions` → `POST /openapi/capcut-mate/v1/add_captions`

```json
{
  "draft_url": "<draft_url>",
  "captions": "[{\"start\":0,\"end\":3000000,\"text\":\"第一段字幕\"},{\"start\":3000000,\"end\":6000000,\"text\":\"第二段字幕\"},{\"start\":6000000,\"end\":9000000,\"text\":\"第三段字幕\"}]",
  "font_size": 8,
  "font": "金陵体",
  "text_color": "#000000",
  "border_color": "#ffffff",
  "has_shadow": true,
  "transform_y": -800
}
```

字幕默认按 [add-captions.md](add-captions.md) 的规则：普通字幕 8 号字、金陵体、黑字白边、开启阴影，
每行 ≤15 字；标题/花字 16 号字、每行 ≤8 字；用户可指定其它字号、字体和颜色。

## 5. 添加 BGM

先用 `get_audio_duration` 检查音频时长。音频不少于 9 秒时：

`add_audios` → `POST /openapi/capcut-mate/v1/add_audios`

```json
{
  "draft_url": "<draft_url>",
  "audio_infos": "[{\"audio_url\":\"https://example.com/bgm.mp3\",\"start\":0,\"end\":9000000,\"volume\":0.6}]"
}
```

## 6. 保存

`save_draft` → `POST /openapi/capcut-mate/v1/save_draft`

```json
{"draft_url":"<draft_url>"}
```

## 7. 默认：下载到剪映草稿箱

剪辑完成后默认使用最终 `draft_url` 运行：

```bash
node scripts/download-draft.mjs --draft-url "<draft_url>"
```

下载器会一并下载草稿内引用的远程素材并激活剪映发现。完成后报告 `draftDirectory`
与 `jianyingDiscovered`，并告诉用户可以用剪映打开草稿查看成片；未确认发现时提醒用户
重新打开或重启剪映。详见 [download-draft.md](download-draft.md)。

## 8. 可选：导出成片（收费）

下载完成后询问用户是否需要自动导出；用户需要时要求提供 `apiKey`，不知道从哪里获取时
提示到 <https://jcaigc.cn> 获取。

`gen_video` → `POST /openapi/capcut-mate/v1/gen_video`

```json
{"draft_url":"<draft_url>","apiKey":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
```

**先告知用户 0.3 元/分钟**，确认后再调用。然后轮询：

```bash
node scripts/poll-gen-video.mjs --draft-url "<draft_url>"
```

直到 `status` 为 `completed`（读取 `video_url`）或 `failed`（读取 `error_message` 后停止）。
