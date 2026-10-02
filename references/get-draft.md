# get_draft（获取草稿文件列表）

```
GET /openapi/capcut-mate/v1/get_draft
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

获取草稿文件列表。该接口用于获取指定草稿ID对应的所有文件列表，可以查看草稿中包含的素材文件、配置文件等信息。通常用于草稿内容的预览、文件管理或状态检查。

## 请求参数

### Query参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| draft_id | string | ✅ | - | 草稿ID，长度为20-32位字符 |

### 参数详解

#### draft_id

* **类型**: 字符串
* **必填**: 是
* **长度**: 20-32位字符
* **格式**: 通常为UUID格式或类似的唯一标识符
* **示例**: `2f52a63b-8c6a-4417-8b01-1b2a569ccb6c`
* **获取方式**: 通常从draft_url中提取或由create_draft接口返回

## 响应格式

### 成功响应 (200)

```json
{
  "files": [
    "2f52a63b-8c6a-4417-8b01-1b2a569ccb6c.json",
    "video_123456789.mp4",
    "audio_987654321.mp3",
    "image_555666777.jpg",
    "thumbnail_888999000.png"
  ]
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| files | array | 草稿相关的文件列表 |

### 错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

#### 1. 基本获取草稿文件列表

```bash
curl -X GET "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2f52a63b-8c6a-4417-8b01-1b2a569ccb6c" \
  -H "Content-Type: application/json"
```

#### 2. 使用完整的draft_id

```bash
curl -X GET "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=7e8f9a0b-1c2d-3e4f-5g6h-7i8j9k0l1m2n" \
  -H "Content-Type: application/json"
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 400 | draft_id是必填项 | 缺少draft_id参数 | 提供有效的draft_id |
| 400 | draft_id长度无效 | draft_id长度不在20-32位范围内 | 检查draft_id格式是否正确 |
| 400 | draft_id格式无效 | draft_id格式不正确 | 确保使用正确的草稿ID格式 |
| 404 | 草稿不存在 | 指定的草稿ID无法找到 | 确认草稿ID是否正确且存在 |
| 500 | 获取文件列表失败 | 内部服务错误 | 联系技术支持或稍后重试 |
| 503 | 服务不可用 | 系统维护中 | 稍后重试 |

## 注意事项

1. **参数格式**: 确保draft_id格式正确且长度在20-32位之间
2. **ID提取**: 从draft_url正确提取draft_id
3. **文件类型**: 返回的文件列表包含多种类型的文件
4. **权限验证**: 确保有权限访问指定的草稿
5. **实时性**: 文件列表可能不是实时更新的，存在一定延迟
6. **文件状态**: 列表中的文件可能处于不同的处理状态

## 工作流程

1. 验证draft_id参数
2. 检查draft_id格式和长度
3. 查找指定的草稿
4. 获取草稿关联的所有文件
5. 返回文件列表

## 相关接口

* [创建草稿](create-draft.md)
* [保存草稿](save-draft.md)
* [添加视频](add-videos.md)
* [添加音频](add-audios.md)
* [添加图片](add-images.md)
* [生成视频](gen-video.md)

## ⚠️ 实施提示（本技能补充）

- 官方响应示例中的 `files` 是**文件名**（如 `2f52a63b-....json`），不一定是可下载的完整 URL。本地安装脚本 `scripts/install-draft.mjs` 同时兼容「完整 URL」与「裸文件名」两种返回。
- 本接口是唯一使用 `GET` 的接口，`draft_id` 走 query 参数，而不是 JSON body。
