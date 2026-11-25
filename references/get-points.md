# get_points（查询账户余额）

```
GET https://jcaigc.cn/openapi/v1/user/points?apiKey=<uuid>
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理。注意：本接口由简创开放平台（jcaigc.cn）直接提供，
> **不是** `capcut-mate.jcaigc.cn` 的路径，请求也不经过剪映小助手服务端。

## 功能描述

查询指定 `apiKey` 对应账户的充值余额（单位：元）。与 `gen_video`、`upload_file` 以及文案/图像/视频/数字人/音乐/语音网关
扣费使用的是同一份充值余额。可在调用计费接口前先查余额，避免因余额不足导致任务被拒绝。**免费，不扣费。**

## 请求参数

参数放在 URL 查询串中，没有请求体。

```bash
curl -X GET "https://jcaigc.cn/openapi/v1/user/points?apiKey=123e4567-e89b-12d3-a456-426614174000"
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| apiKey | string | ✅ | - | 账户的 API Key，固定为 36 位 UUID |

## 响应格式

### 成功响应 (200)

```json
{
  "code": 0,
  "message": "success",
  "traceid": "067b0e601f4a4784afe4068da658e555",
  "data": {
    "points": 12.34
  }
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| code | int | 业务状态码，0 表示成功 |
| message | string | 状态描述 |
| traceid | string | 本次请求的链路追踪 ID |
| data.points | float | 账户充值余额，单位：元 |

### 错误响应

```json
{
  "code": 10007,
  "message": "API密钥无效",
  "traceid": "845b5403cd8a999ad7df7b6c4649336d",
  "data": null
}
```

## 使用示例

```bash
curl -X GET "https://jcaigc.cn/openapi/v1/user/points?apiKey=<uuid>" \
  -H "Accept-Language: zh-CN"
```

### 本技能脚本

```bash
node scripts/get-points.mjs --api-key <uuid>
```

默认输出 `{"points":12.34,"unit":"CNY"}`；加 `--raw` 输出接口完整 JSON。

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 10002 | 参数无效 | 未传 apiKey，或 apiKey 长度不是 36 位 | 传入完整的 36 位 UUID |
| 10007 | API密钥无效 | apiKey 格式正确，但账户不存在 | 核对 API Key，或登录 <https://jcaigc.cn/user-info> 重新获取 |
| 10001 | 服务器内部错误 | 网关内部异常 | 稍后重试；持续失败请携带 traceid 联系技术支持 |

## 注意事项

1. **接口归属**：由简创开放平台提供，不是剪映小助手的服务地址；剪映小助手、ASR 与文案/图像/视频/数字人/音乐/语音网关
   共用同一份充值余额。
2. **免费**：查询余额不扣费。
3. **余额单位**：`points` 是网关沿用的字段名，实际值是充值余额，单位：元。
4. **apiKey 在 URL 中**：请使用 HTTPS，不要把带 apiKey 的完整 URL 写入日志或公开分享。
5. **会员折扣**：会员折扣只作用于云渲染扣费（VIP 8 折、SVIP 6 折），其它接口按原价结算。
