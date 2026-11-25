# generate_image（文生图 / 图像生成）

```
POST https://api.jcaigc.cn/v1/images/generations
```

> 依据官方文档 https://docs.jcaigc.cn/image/ 整理。
> **这是独立的图像生成网关**：基地址 `https://api.jcaigc.cn/v1`，鉴权用
> `Authorization: Bearer <apiKey>`（也接受 `x-api-key`），与剪映小助手、ASR 都不是同一个服务。

## 功能描述

给一段提示词，直接拿回图片地址；Gemini 两条还支持带参考图改图。接口沿用 OpenAI 图像接口风格，
已习惯 OpenAI SDK 的客户端只需改 Base URL 和密钥。出图是**同步**返回的，不需要轮询。

## 默认模型与选择

**用户没有指定模型时，默认使用 `doubao-seedream-5-0-flash`**：0.12 元/张，速度最快、单价最低，
适合大多数配图和批量生成。

调用前必须向用户说明：

1. 本次使用的模型（默认 `doubao-seedream-5-0-flash`）与单价；
2. 生成张数 `n` 与预计费用（`单价 × n`）；
3. 用户可以换其它模型；如需更高质量或参考图改图，列出可选模型与单价让用户选择。

用户明确指定其它模型时，按用户选择执行，不要擅自改回默认模型。

## 按草稿画布选择尺寸/比例

生成图片前先看草稿画布；用户明确指定尺寸/比例时以用户为准：

| 草稿画布 | 优先比例 | 非 Gemini 模型 | Gemini 两条 |
|---|---|---|---|
| 1080×1920 | **9:16** | `size: "1080x1920"`（或 720x1280） | `aspect_ratio: "9:16"` |
| 1920×1080 | **16:9** | `size: "1920x1080"`（或 1280x720） | `aspect_ratio: "16:9"` |

- 非 Gemini 模型用 `size` 控制输出尺寸；`aspect_ratio` 只对 Gemini 两条生效。
- Gemini 两条可用 `aspect_ratio` 指定比例，`size` 同时决定 1K/2K/4K 计费档位。
- 不要默认生成 1:1 再裁切；需要与草稿一致时直接按上表生成。

## 支持的模型

| 模型 | 说明 | 单价 |
|------|------|------|
| `doubao-seedream-5-0-flash` | **默认**；豆包轻量，更快、更便宜，适合批量 | **0.12 元/张** |
| `qwen-image-3.0` | 千问生图标准版，成本低 | 0.2 元/张 |
| `wan2.7-image-pro` | 万相 Pro 档（价格反而比标准版低） | 0.2 元/张 |
| `doubao-seedream-5-0-pro` | 豆包旗舰，质量优先 | 0.3 元/张 |
| `qwen-image-3.0-pro` | 千问生图旗舰，质量最高 | 0.5 元/张 |
| `wan2.7-image` | 万相文生图 | 0.5 元/张 |
| `gemini-3.1-flash-lite-image` | Gemini 3.1 轻量文生图，1K/2K/4K | 0.252 / 0.302 / 0.363 元/张 |
| `gemini-3.1-flash-image` | Gemini 3.1 文生图（Nano Banana 2），1K/2K/4K | 0.5 / 0.75 / 1.12 元/张 |

> 上表是网关价目表；**实际能用哪些模型取决于账号开通的通道**。可调用
> `GET https://api.jcaigc.cn/v1/models` 获取当前可用清单。价目表里没有条目的模型会被拒绝
> （HTTP 503，`error.type = model_not_priced`），不会回落到默认价。
>
> 注意万相这组是 **Pro 比标准版便宜**，与千问相反，以价目表为准。
> 参考图相关参数目前**只对 Gemini 两条开放**；其它模型的“多参考图/编辑”属于上游能力，
> 网关请求参数里没有开放，不要传。

## 请求参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 否 | 模型名，取值见上表；不传默认 `doubao-seedream-5-0-flash` |
| `prompt` | 是 | 提示词；Gemini 两条带参考图时可省略 |
| `size` | 否 | 图片尺寸，写成 `1080x1920` / `1920x1080` 等，网关自动转成上游格式 |
| `n` | 否 | 生成张数，**按张数计费**；Gemini 两条单次只能生成 1 张 |
| `negative_prompt` | 否 | 反向提示词 |
| `image` / `image_url` / `image_urls` / `images` | 否 | 参考图，**仅 Gemini 两条**；可传公网地址、`data:image/...;base64,...`，或 `{"url": ...}` / `{"base64": ...}` 对象；单张或数组，最多 14 张，Base64 合计不超过 10MB |
| `aspect_ratio` / `ratio` | 否 | 宽高比，**仅 Gemini 两条**：`1:1`、`1:4`、`1:8`、`2:3`、`3:2`、`3:4`、`4:1`、`4:3`、`4:5`、`5:4`、`8:1`、`9:16`、`16:9`、`21:9`；不传时按 `size` 推导，认不出按 `1:1` |
| `output_format` | 否 | 输出格式，**仅 Gemini 两条**：`png` / `jpeg` |
| `seed` | 否 | 随机种子，**仅 Gemini 两条** |
| `enhance_prompt` | 否 | 是否让上游扩写提示词，布尔值，**仅 Gemini 两条** |

## 请求示例

```bash
curl -X POST https://api.jcaigc.cn/v1/images/generations \
  -H "Authorization: Bearer 123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedream-5-0-flash",
    "prompt": "一只在窗台上打盹的橘猫，晨光，浅景深",
    "size": "1080x1920",
    "n": 1
  }'
```

### Gemini 参考图改图

```bash
curl -X POST https://api.jcaigc.cn/v1/images/generations \
  -H "Authorization: Bearer <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-flash-image",
    "prompt": "把背景换成海边日落，保留人物",
    "image_urls": ["https://example.com/photo.jpg"],
    "aspect_ratio": "16:9",
    "size": "2048x1152",
    "n": 1
  }'
```

## 响应

出图是**同步**返回的，响应里直接带图片地址：

```json
{
  "created": 1699999999,
  "data": [{ "url": "https://..." }]
}
```

Gemini 两条返回的是**临时访问地址，有效期 7 天**；需要长期保存时请及时转存。
拿到 `url` 后可直接作为 `add_images` 的 `image_infos[].image_url` 使用。

## 计费

按张计费；默认模型 `doubao-seedream-5-0-flash` 为 **0.12 元/张**。
Gemini 两条按输出档位（1K / 2K / 4K）分档：

| 模型 | 1K | 2K | 4K |
|------|----|----|----|
| `gemini-3.1-flash-lite-image` | 0.252 元/张 | 0.302 元/张 | 0.363 元/张 |
| `gemini-3.1-flash-image` | 0.5 元/张 | 0.75 元/张 | 1.12 元/张 |

- 按 `n` 计费，生成 3 张就是 3 倍；Gemini 两条每次只生成 1 张。
- Gemini 档位按 `size` 折算：1024×1024 为 1K、2048×2048 为 2K、4096×4096 为 4K；不传按 1K。
- 参考图不计费，仍按输出张数与档位计价。
- 失败请求不计费。

## 错误与超时

- `prompt` 缺失且没有参考图：HTTP 400，`缺少 prompt`。
- 价目表没有该模型：HTTP 503，`error.type = model_not_priced`。
- 同步等待超时：HTTP 504，`image_timeout`。阿里系生图总预算 **240 秒**，Gemini 两条 **600 秒**。
  **超时后任务仍可能由后台继续收口并计费**，不要因为客户端超时就认为一定免费。
- 批量出图建议拆成多次小请求，不要一次提交过多张。

## 注意事项

1. **鉴权**：`Authorization: Bearer <apiKey>`（或 `x-api-key`），apiKey 来自 <https://jcaigc.cn>。
2. **默认模型**：用户未指定时用 `doubao-seedream-5-0-flash`（0.12 元/张）；调用前告知默认模型、
   单价与预计费用，并说明可以换其它模型。
3. **模型可用性**：先查 `GET /v1/models`；不要假设价目表里的模型都一定开通。
4. **比例跟随草稿**：1080×1920 草稿优先生成 9:16（非 Gemini `size: 1080x1920`，
   Gemini `aspect_ratio: 9:16`）；1920×1080 草稿优先 16:9。用户指定时以用户为准。
5. **张数与费用**：调用前先向用户说明按张计费，确认预算与 `n`；`n` 张就是 `单价 × n`。
6. **参考图**：仅 Gemini 两条支持；最多 14 张，Base64 合计 ≤ 10MB。
7. **临时链接**：Gemini 结果 URL 默认 7 天，长期使用请转存。
8. **与草稿配合**：把返回的 `url` 传给 `add_images` 即可把生成图放进剪映草稿。

## 相关接口

* [添加图片](add-images.md)
* [上传文件](upload-file.md)
* [账户余额](get-points.md)
* [图像生成文档](https://docs.jcaigc.cn/image/)
