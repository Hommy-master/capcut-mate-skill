# gen_video（生成视频（收费））

```
POST /openapi/capcut-mate/v1/gen_video
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

提交视频生成任务。该接口采用异步处理模式，立即返回任务提交状态，视频生成在后台进行。支持任务排队，确保系统稳定性。

此接口只提交任务，不返回视频文件。接着轮询 gen_video_status，直到 status=completed 或 failed。线上导出请带 uuid 格式的 apiKey。

## 请求参数

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "apiKey": "123e4567-e89b-12d3-a456-426614174000"
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| draft_url | string | ✅ | - | 目标草稿的完整URL |
| apiKey | string | 是 | - | 合法 UUID；线上服务必填 |

### 参数详解

#### 草稿URL参数

* **draft_url**: 草稿的完整URL地址
  * 格式：`https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id={草稿ID}`
  * 示例：`"https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258"`
  * 获取方式：通过[创建草稿](create-draft.md)或[保存草稿](save-draft.md)接口获取

## 响应格式

### 成功响应 (200)

```json
{
  "message": "视频生成任务已提交，请使用draft_url查询进度"
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| message | string | 响应消息 |

### 错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

#### 1. 基本视频生成

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/gen_video \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL"
  }'
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 1001 | 参数校验失败 | `apiKey` 不是合法 UUID，或参数类型不正确 | 检查参数类型与必填字段 |
| 2001 | 无效的草稿URL | `draft_url` 缺失或不含 `draft_id` | 传入 `create_draft` 返回的 `draft_url` |
| 2035 | 充值余额不足 | 当前余额不大于 0，或不足以覆盖预估费用 | 前往 <https://jcaigc.cn/recharge> 充值后重试 |
| 2036 | 无效的 apiKey | 未传或非法 `apiKey` | 登录 <https://jcaigc.cn/user-info> 获取 apiKey |
| 9998 | 系统内部错误 | 提交任务时发生未知错误 | 稍后重试或联系技术支持 |

## 注意事项

1. **处理时间**: 视频生成是耗时操作，可能需要几分钟到几十分钟
2. **文件大小**: 草稿复杂度和素材数量会影响处理时间
3. **网络稳定**: 确保素材URL可以稳定访问
4. **超时设置**: 建议设置较长的超时时间或使用轮询机制
5. **并发限制**: 避免同时生成大量视频
6. **存储空间**: 生成的视频文件可能很大，注意存储空间
7. **URL有效期**: 生成的video_url可能有时效性限制
8. **系统要求**: 视频生成功能仅在Windows系统上可用

## 工作流程

1. 验证draft_url参数
2. 解析草稿配置文件
3. 下载所有必需的素材文件
4. 按时间轴排列和处理素材
5. 应用视觉效果和转场
6. 混合音频轨道
7. 渲染最终视频
8. 编码并上传视频文件
9. 返回视频URL

## 相关接口

* [创建草稿](create-draft.md)
* [保存草稿](save-draft.md)
* [添加视频](add-videos.md)
* [添加音频](add-audios.md)
* [添加图片](add-images.md)
* [获取草稿](get-draft.md)
* [查询视频生成状态](gen-video-status.md)

## ⚠️ 实施提示（本技能补充）

- 线上导出**必须**携带 UUID 格式的 `apiKey`：`{"draft_url":"...","apiKey":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}`。
- 本接口只表示**任务已提交**，不返回视频地址，必须接着轮询 `gen-video-status.md`。
- 计费：0.3 元/分钟，VIP 0.24 元/分钟、SVIP 0.18 元/分钟。调用前先与用户确认，不要在没有 `apiKey` 时盲目重试。
- 导出通常在草稿下载完成后按需提示；用户不知道从哪里获取 `apiKey` 时，提示到 <https://jcaigc.cn> 获取。
