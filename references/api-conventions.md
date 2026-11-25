# API 通用约定

## 开源与许可

本技能及其后端服务 **CapCut Mate** 完全开源免费（后端 Apache-2.0，技能本体 MIT）：

- GitHub：<https://github.com/Hommy-master/capcut-mate>
- Gitee 镜像：<https://gitee.com/taohongmin-gitee/capcut-mate>

## 基地址

- 基地址：`https://capcut-mate.jcaigc.cn`
- 路径前缀：`/openapi/capcut-mate/v1/`
- 完整地址 = 基地址 + 路径前缀 + 接口名，例如
  `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/create_draft`
- 本技能使用的剪映小助手接口中，`get_draft` 使用 `GET`，`upload_file` 使用 `multipart/form-data`，其余接口均使用 `POST JSON`；`get_points` 是 `jcaigc.cn` 余额接口的 `GET`，不走该基地址。
- 调用 `create_draft` / `add_*` 等接口**不需要** API Key。线上服务的 `gen_video` 与 `upload_file` 需要 UUID 格式的 `apiKey`。
- **字幕/时间线 ASR 是独立服务（autosubrt）**：基地址 `https://autosubrt.jcaigc.cn`，路径前缀
  `/openapi/autosubrt/v1/`，按音频时长 0.00022 元/秒计费（识别成功后扣费），需要 `apiKey`；
  与剪映小助手共用充值余额。普通「音频转文字」走下面的语音网关。
- **图像生成是独立网关**：基地址 `https://api.jcaigc.cn/v1`，`POST /v1/images/generations`，
  鉴权用 `Authorization: Bearer <apiKey>`，按张计费（0.12–1.12 元/张），同步返回图片 URL。
- **视频生成是同一独立网关**：`POST /v1/video/generations` 提交任务，
  `GET /v1/video/generations/{task_id}` 轮询；按秒计费，默认 `doubao-seedance-2.0` + 480P（0.45 元/秒）。
- **语音网关也是同一独立网关**：`POST /v1/audio/transcriptions`（ASR）、`POST /v1/audio/speech`（TTS）、
  `POST /v1/audio/voices`（声音复刻）。ASR 默认 `volc.bigasr.auc_turbo`（0.00022 元/秒），
  TTS 默认 `seed-tts-2.0`（2.8 元/万字符），复刻默认 `cosyvoice-v3.5-plus`（9.9 元/个）。
- **音乐生成也是同一独立网关**：`POST /v1/music/generations` 提交，`GET /v1/music/generations/{task_id}`
  轮询；按次计费，默认 `minimax-music-2.0`（0.25 元/次）。
- **数字人复用视频网关**：`video_url + audio_url` 用 `videoretalk`（0.08 元/秒）；
  `image_url + audio_url` 用 `wan2.2-s2v`（480P 0.5 / 720P 0.9 元/秒）。
- **文案生成走大语言模型网关**：`POST /v1/chat/completions`，本技能只接入
  `gemini-3.5-flash-lite`（输入 2.25、输出 18.75 元/百万 token）。

## 认证与计费

| 场景 | 是否需要 apiKey | 费用 |
|---|---|---|
| 创建草稿、添加素材、特效、字幕、查询等 | 否 | 免费 |
| `upload_file` 上传素材 | **是**，UUID 格式，用户自备 | 0.005 元/MB，单次最低 0.002 元（上传成功后扣费） |
| `gen_video` 导出视频 | **是**，UUID 格式，用户自备 | 0.3 元/分钟（VIP 0.24、SVIP 0.18 元/分钟） |
| ASR（独立服务 `autosubrt.jcaigc.cn`） | **是**，UUID 格式，用户自备 | 0.00022 元/秒（按音频时长，识别成功后扣费） |
| 图像生成（独立网关 `api.jcaigc.cn`） | **是**，UUID 格式，用户自备 | 默认 `doubao-seedream-5-0-flash` 0.12 元/张；其它模型 0.2–1.12 元/张（Gemini 按 1K/2K/4K 分档） |
| 视频生成（独立网关 `api.jcaigc.cn`） | **是**，UUID 格式，用户自备 | 默认 `doubao-seedance-2.0` + 480P 0.45 元/秒；其它文生/图生视频模型与分辨率 0.22–5 元/秒 |
| 语音网关（独立网关 `api.jcaigc.cn`） | **是**，UUID 格式，用户自备 | ASR 默认 0.00022 元/秒；TTS 默认 2.8 元/万字符；声音复刻默认 9.9 元/个 |
| 音乐生成（独立网关 `api.jcaigc.cn`） | **是**，UUID 格式，用户自备 | 默认 `minimax-music-2.0` 0.25 元/次；`minimax-music-3.0` 1 元/次 |
| 数字人（复用视频网关） | **是**，UUID 格式，用户自备 | 视频对口型 0.08 元/秒；图片说话 480P 0.5 / 720P 0.9 元/秒 |
| 文案生成（大语言模型网关） | **是**，UUID 格式，用户自备 | `gemini-3.5-flash-lite`：输入 2.25、输出 18.75 元/百万 token |

调用 `upload_file` / `gen_video` 时账户充值余额需大于 0，否则返回 `2035`；
上传还需余额覆盖本次费用，导出会按草稿时长预估费用并提前校验余额。

API Key 获取与充值：<https://www.jcaigc.cn>

## 响应

线上服务可能在业务数据外增加统一包装。至少检查：

- `code`：`0` 通常表示成功；
- `message` / `msg` / `detail`：业务提示或错误描述；
- 接口自身字段，例如 `draft_url`、`infos`、`effects`、`files`、`status`、`video_url`。

不要只依据 HTTP 200 判断成功，也不要只依据 HTTP 状态判断失败（错误信息常在 `detail` 中）。

## 时间和坐标

- 时间统一使用**微秒**：1 秒 = `1000000`。
- `start` 为开始时间，`end` 为结束时间，必须满足 `0 <= start < end`。
- 位置通常以画布中心为原点；不确定时使用 `transform_x: 0`、`transform_y: 0`。
- 9:16 竖屏使用 `width: 1080`、`height: 1920`；16:9 横屏使用 `width: 1920`、`height: 1080`。
- 关键帧的 `offset` 是**片段内**的微秒偏移，不是时间轴绝对时间。

## 字幕默认样式

用户没有特别要求时，`add_captions` 按以下样式：

| 类型 | `font_size` | `font` | 文字颜色 | 描边颜色 | 阴影 | 每行字数 |
|---|---|---|---|---|---|---|
| 普通字幕 | **8** | **金陵体** | **`#000000`** | **`#ffffff`** | **`has_shadow: true`** | **≤15 字** |
| 标题/花字 | **16** | 金陵体 | `#000000` | `#ffffff` | `has_shadow: true` | **≤8 字** |

- 用户可指定其它字号、字体、颜色、描边或阴影，优先按用户要求。
- 花字/文字模板会覆盖颜色/描边/阴影，但字号与每行字数仍按 16 / 8。
- 字幕默认不含标点：先按标点断句并去掉标点，仍超长再硬切（不拆数字和英文单词）。

## 画布与素材比例

生成或选用素材时，优先与草稿画布方向一致；用户明确指定尺寸/比例时以用户为准：

| 草稿画布 | 优先素材比例 | 图片生成 | 视频生成 | 数字人 |
|---|---|---|---|---|
| 1080×1920 | **9:16** | 非 Gemini `size: "1080x1920"`；Gemini `aspect_ratio: "9:16"` | `aspect_ratio: "9:16"` | 竖向人像图/竖屏人物视频 |
| 1920×1080 | **16:9** | 非 Gemini `size: "1920x1080"`；Gemini `aspect_ratio: "16:9"` | `aspect_ratio: "16:9"` | 横屏人像图/人物视频 |

不要默认生成 1:1 或相反方向的素材再裁切。

## 图层与遮挡

图片、视频、音频、特效、滤镜、字幕、贴纸等资源都有图层（轨道）概念，并按添加顺序叠放：

- **先添加的在底层，后添加的在上层轨道**。多次调用 `add_*` 时，调用顺序就是叠放顺序。
- **音频是独立层**，始终位于最底层轨道。
- **时间线重合会遮挡**：上层轨道会盖住下层轨道同一时间段的内容。需要某元素显示在最上面时，
  把它放到最后一次调用添加；需要垫底时最先添加。需要调整前后关系时，调整对应 `add_*` 的调用顺序。

## JSON 字符串字段

以下字段要求值本身是**序列化后的 JSON 字符串**，不是对象数组：

- `image_infos`
- `video_infos`
- `audio_infos`
- `captions`
- `effect_infos`
- `filter_infos`
- `keyframes`：`add_keyframes` 要求 JSON 字符串；`add_mask_keyframes` 要求数组，不能传字符串（见该接口说明）

示例：

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "image_infos": "[{\"image_url\":\"https://example.com/1.jpg\",\"start\":0,\"end\":3000000}]"
}
```

## multipart/form-data

在剪映小助手接口中，`upload_file` 是唯一不使用 JSON 的写接口：文件放 `file` 字段、密钥放 `apiKey` 字段，见 [upload-file.md](upload-file.md)。

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/upload_file \
  -F "file=@demo.mp4" -F "apiKey=<uuid>"
```

技能脚本用 `--file` 指定本地文件（`--data` 中的字段转为附加表单字段）：

```bash
node scripts/call-api.mjs --endpoint upload_file --file ./demo.mp4 --data '{"apiKey":"<uuid>"}'
```

返回的 `url` 是带签名的临时地址（默认 7 天），可直接作为 `add_videos` / `add_images` / `add_audios` 的素材地址。
只有下载剪映草稿时才会实际下载文件（`add_*` 调用只登记 URL，不触发下载）；URL 过期或文件被删除后需要重新上传。

## 草稿串联

`create_draft` 返回 `draft_url`。后续所有写接口继续使用该值，并优先采用最近一次响应中的 `draft_url`。完成后调用 `save_draft`。

- 不要把 `draft_url` 当成可自行拼接的字符串，一律**原样透传**。
- 草稿依赖服务端当前可用状态。若旧草稿无法继续编辑，创建新草稿并重新执行确定性的素材步骤。
- `draft_url` 有有效期；跨天或长时间中断后可能失效。
- **只能通过接口生成和修改草稿**：除下载器安装时的素材本地化改写外，不要直接修改、替换或用脚本
  改写下载到本机的剪映草稿文件（剪映草稿文件是加密的）。需要调整时重新走 `create_draft` + `add_*`；
  图片、视频、音频 URL 可以直接复用，非必要不要重新上传。

## 异步导出

导出是可选后续步骤：剪辑完成（`save_draft`）后默认先下载草稿到本机剪映草稿箱，
再询问用户是否需要自动导出。`gen_video` 只表示任务已提交，不返回视频文件。必须轮询 `gen_video_status`：

- 轮询间隔：每 3–5 秒一次，设置总超时（如 10 分钟）。
- 状态机：

| status | 含义 | 下一步 |
|---|---|---|
| `pending` | 排队中 | 继续轮询 |
| `processing` | 渲染中 | 继续轮询 |
| `completed` | 成功 | 读取 `video_url` |
| `failed` | 失败 | 读取 `error_message`，停止轮询，不要死循环 |

- 任务唯一性：同一 `draft_url` 同时只能有一个进行中的导出任务。
