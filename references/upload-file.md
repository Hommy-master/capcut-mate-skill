# upload_file（上传文件）

```
POST /openapi/capcut-mate/v1/upload_file
Content-Type: multipart/form-data
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

把本地文件上传到对象存储（服务端中转）：客户端把文件字节提交给本服务，服务端再转发上传到对象存储，
返回一个**带签名的临时下载 URL**，可直接传给 `add_videos` / `add_images` / `add_audios` 等接口使用。

对象存储密钥全程留在服务端，不会下发给客户端。

**本接口收费**：0.0005 元/MB，按文件实际体积计费，仅在上传成功后才扣费；调用前必须提供 `apiKey`（见下）。

## 请求参数

请求体是 `multipart/form-data`（本服务唯一不使用 `POST JSON` 的写接口）：

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/upload_file \
  -F "file=@demo.mp4" \
  -F "apiKey=123e4567-e89b-12d3-a456-426614174000"
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| file | file | ✅ | - | 待上传文件，单文件最大 500MB，空文件会被拒绝 |
| apiKey | string | 按服务端配置 | - | 合法 UUID；托管版默认校验（`ENABLE_APIKEY=true`），必填 |

### 参数详解

#### file

* **类型**：文件（multipart/form-data）
* **支持格式**：`mp4`、`mov`、`m4v`、`avi`、`mkv`、`flv`、`webm`、`wmv`、`mp3`、`wav`、`m4a`、`aac`、`flac`、`ogg`、`jpg`、`jpeg`、`png`、`gif`、`webp`、`bmp`
* **限制**：单文件最大 500MB，空文件会被拒绝；扩展名不在白名单内返回 `2050`
* **文件名**：会做安全清洗（去掉路径与非法字符），清洗后无可用字符返回 `2049`

#### apiKey

* **类型**：string，UUID 格式
* **说明**：托管版默认开启校验（`ENABLE_APIKEY=true`），缺失或非法返回 `2036`；
  账户积分需**大于 1** 才能上传，否则返回 `2035`。获取与充值：<https://www.jcaigc.cn>
* 自部署实例可通过配置关闭该校验（关闭后余额判断同样跳过）。

## 响应格式

```json
{
  "code": 0,
  "message": "success",
  "url": "https://bucket.oss-cn-hangzhou.aliyuncs.com/jianchuang/2026-10-06/8f3a1c2d5e6b7a90_demo.mp4?OSSAccessKeyId=xxx&Expires=xxx&Signature=xxx",
  "key": "jianchuang/2026-10-06/8f3a1c2d5e6b7a90_demo.mp4",
  "size": 10485760,
  "size_mb": 10.0,
  "cost": 0.005,
  "url_expire_days": 7
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| url | string | 带签名的临时下载地址，可直接传给 `add_videos` / `add_images` / `add_audios` |
| key | string | 对象存储 object key |
| size | int | 文件实际字节数 |
| size_mb | float | 文件体积（MB，保留 3 位小数） |
| cost | float | 本次上传费用（元）；未启用计费时为 0 |
| url_expire_days | int | `url` 有效期（天），取服务端 `VIDEO_GEN_RETENTION_DAYS`（默认 7 天） |

## 使用示例

### 1. cURL

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/upload_file \
  -F "file=@demo.mp4" \
  -F "apiKey=123e4567-e89b-12d3-a456-426614174000"
```

### 2. 本技能脚本

```bash
node scripts/call-api.mjs --endpoint upload_file --file ./demo.mp4 \
  --data '{"apiKey":"123e4567-e89b-12d3-a456-426614174000"}'
```

`--file` 指定本地文件，`--data` 中的字段会作为附加表单字段一并提交（`apiKey` 就放这里）。

### 3. 拿到 URL 后接着编排

```bash
# 上一步返回的 url 直接作为视频素材地址
node scripts/call-api.mjs --endpoint add_videos --data '{
  "draft_url": "YOUR_DRAFT_URL",
  "video_infos": "[{\"video_url\":\"<upload_file 返回的 url>\",\"start\":0,\"end\":5000000}]"
}'
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 1001 | 参数校验失败 | 缺少 `file` 字段、`apiKey` 不是合法 UUID，或上传了空文件 | 检查请求参数 |
| 2004 | 文件大小超出限制 | 文件超过 500MB | 压缩或切分文件后重试 |
| 2035 | 账户余额不足 | 积分需大于 1 才可继续使用服务 | 完成充值后重试 |
| 2036 | 无效的 apiKey | 开启校验且 `apiKey` 缺失或非法 | 登录 <https://jcaigc.cn> 获取 |
| 2049 | 无效的文件名 | 文件名为空或清洗后没有可用字符 | 提供合法的文件名 |
| 2050 | 不支持的文件类型 | 扩展名不在白名单内 | 改用受支持的格式 |
| 9998 | 系统内部错误 | 服务端未配置对象存储或上传失败 | 稍后重试或联系服务方 |

## 注意事项

1. **收费接口**：0.0005 元/MB。上传前先与用户确认，不要在没有 `apiKey` 的情况下反复重试。
   自部署实例不计托管费用。
2. **服务端中转**：文件先到本服务再转到对象存储；对象存储密钥不下发给客户端。
3. **有效期**：返回的 `url` 是带签名的临时地址（默认 7 天）。**请在同一轮任务里尽快用掉**；
   过期后草稿里的素材会失效，需要重新上传。
4. **大小限制**：单文件最大 500MB。若服务部署在 nginx 之后，需同时放开
   `client_max_body_size`（默认 1MB 会直接返回 HTTP 413，而不是业务错误码）。
5. **不是草稿接口**：上传只返回 URL，不写入任何草稿；拿到 `url` 后仍需按正常流程
   `create_draft` → `add_*`。
6. 只上传用户明确提供、且允许上传到第三方对象存储的文件；不要上传敏感或涉密内容。

## 相关接口

* [添加视频](add-videos.md)
* [添加图片](add-images.md)
* [添加音频](add-audios.md)
* [创建草稿](create-draft.md)
