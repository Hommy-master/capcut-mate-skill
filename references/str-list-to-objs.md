# str_list_to_objs（字符串列表转对象列表）

```
POST /openapi/capcut-mate/v1/str_list_to_objs
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

字符串列表转化成对象列表。该接口用于将输入的字符串列表转换为对象列表格式。

## 请求参数

```json
{
  "infos": [
    "https://assets.jcaigc.cn/min.mp4",
    "https://assets.jcaigc.cn/max.mp4"
  ]
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| infos | array\[string] | ✅ | - | 字符串列表 |

### 参数详解

#### infos

* **类型**: array\[string]
* **说明**: 需要转换的字符串列表
* **示例**: `["https://assets.jcaigc.cn/min.mp4", "https://assets.jcaigc.cn/max.mp4"]`

## 响应格式

### 成功响应 (200)

```json
{
  "infos": [
    {
      "output": "https://assets.jcaigc.cn/min.mp4"
    },
    {
      "output": "https://assets.jcaigc.cn/max.mp4"
    }
  ]
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| infos | array\[object] | 对象列表 |
| output | string | URL地址 |

### 错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

#### 1. 基本使用

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/str_list_to_objs \
  -H "Content-Type: application/json" \
  -d '{
    "infos": [
      "https://assets.jcaigc.cn/min.mp4",
      "https://assets.jcaigc.cn/max.mp4"
    ]
  }'
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 400 | infos是必填项 | 缺少infos参数 | 提供有效的infos参数 |
| 500 | 字符串列表转换失败 | 内部处理错误 | 联系技术支持 |

## 注意事项

1. **参数要求**: infos参数为必填项
2. **返回值**: 将输入的字符串列表转换为包含output字段的对象列表

## 工作流程

1. 验证必填参数（infos）
2. 调用服务层处理业务逻辑
3. 返回转换后的对象列表

## 相关接口

* [创建草稿](create-draft.md)
