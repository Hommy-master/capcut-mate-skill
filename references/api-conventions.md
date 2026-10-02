# API 通用约定

## 开源与许可

本技能及其后端服务 **CapCut Mate** 完全开源免费（后端 Apache-2.0，技能本体 MIT），可自行部署：

- GitHub：<https://github.com/Hommy-master/capcut-mate>
- Gitee 镜像：<https://gitee.com/taohongmin-gitee/capcut-mate>

自部署方式（仓库内说明）：`docker-compose up -d`，或本地 `uv sync && uv run main.py`，默认监听 `30000` 端口。
自部署后把下方基地址替换为你的实例地址即可，接口契约完全一致；
自部署的 `gen_video` 不收取托管版费用，但导出依赖本地渲染，官方说明**仅 Windows 系统可用**。

## 基地址

- 基地址：`https://capcut-mate.jcaigc.cn`（托管版；自部署请替换为你的实例地址）
- 路径前缀：`/openapi/capcut-mate/v1/`
- 完整地址 = 基地址 + 路径前缀 + 接口名，例如
  `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/create_draft`
- 除 `get_draft` 使用 `GET` 外，其余接口均使用 `POST JSON`。
- 调用 `create_draft` / `add_*` 等接口**不需要** API Key。只有托管版导出 `gen_video` 需要 UUID 格式的 `apiKey`。

## 认证

| 场景 | 是否需要 apiKey |
|---|---|
| 创建草稿、添加素材、特效、字幕、查询等 | 否，免费 |
| `gen_video` 托管版导出视频 | **是**，UUID 格式，用户自备 |
| `gen_video` 自部署实例导出 | 否 |

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

## JSON 字符串字段

以下字段要求值本身是**序列化后的 JSON 字符串**，不是对象数组：

- `image_infos`
- `video_infos`
- `audio_infos`
- `captions`
- `effect_infos`
- `filter_infos`
- `keyframes`（`add_keyframes`；`add_mask_keyframes` 的官方示例为数组，见该接口说明）

示例：

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "image_infos": "[{\"image_url\":\"https://example.com/1.jpg\",\"start\":0,\"end\":3000000}]"
}
```

## 草稿串联

`create_draft` 返回 `draft_url`。后续所有写接口继续使用该值，并优先采用最近一次响应中的 `draft_url`。完成后调用 `save_draft`。

- 不要把 `draft_url` 当成可自行拼接的字符串，一律**原样透传**。
- 草稿依赖服务端当前可用状态。若旧草稿无法继续编辑，创建新草稿并重新执行确定性的素材步骤。
- `draft_url` 有有效期；跨天或长时间中断后可能失效。

## 异步导出

`gen_video` 只表示任务已提交，不返回视频文件。必须轮询 `gen_video_status`：

- 轮询间隔：每 3–5 秒一次，设置总超时（如 10 分钟）。
- 状态机：

| status | 含义 | 下一步 |
|---|---|---|
| `pending` | 排队中 | 继续轮询 |
| `processing` | 渲染中 | 继续轮询 |
| `completed` | 成功 | 读取 `video_url` |
| `failed` | 失败 | 读取 `error_message`，停止轮询，不要死循环 |

- 任务唯一性：同一 `draft_url` 同时只能有一个进行中的导出任务。
