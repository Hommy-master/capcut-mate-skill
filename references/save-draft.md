# save_draft（保存草稿）

```
POST /openapi/capcut-mate/v1/save_draft
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

保存剪映草稿。该接口用于保存当前的草稿状态，确保编辑的内容得到持久化存储。通常在完成一系列编辑操作后调用此接口，以防止编辑内容丢失。

## 请求参数

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258"
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| draft_url | string | ✅ | - | 要保存的草稿URL |

### 参数详解

#### draft_url

* **类型**: 字符串
* **必填**: 是
* **格式**: 完整的草稿URL，通常由create_draft接口返回
* **示例**: `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258`

## 响应格式

### 成功响应 (200)

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258"
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| draft_url | string | 保存后的草稿URL，通常与请求中的URL相同 |

### 错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

#### 1. 基本保存草稿

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/save_draft \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258"
  }'
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 400 | draft_url是必填项 | 缺少草稿URL参数 | 提供有效的draft_url |
| 400 | draft_url格式无效 | URL格式不正确 | 检查URL格式是否正确 |
| 404 | 草稿不存在 | 指定的草稿无法找到 | 确认草稿URL是否正确且存在 |
| 500 | 保存失败 | 内部服务错误 | 联系技术支持或稍后重试 |
| 503 | 服务不可用 | 系统维护中 | 稍后重试 |

## 注意事项

1. **URL有效性**: 确保传入的draft_url是有效且存在的
2. **网络稳定性**: 保存操作需要稳定的网络连接
3. **频率控制**: 避免过于频繁的保存操作
4. **并发安全**: 同一草稿的并发保存可能导致冲突

## 工作流程

1. 验证draft_url参数
2. 检查草稿是否存在
3. 获取当前草稿状态
4. 持久化保存草稿数据
5. 返回保存结果

## 相关接口

* [创建草稿](create-draft.md)
* [添加视频](add-videos.md)
* [添加音频](add-audios.md)
* [添加图片](add-images.md)
* [生成视频](gen-video.md)
