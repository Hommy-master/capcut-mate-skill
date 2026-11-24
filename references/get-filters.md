# get_filters（查询滤镜列表）

```
POST /openapi/capcut-mate/v1/get_filters
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

获取剪映内置滤镜列表，可按 VIP / 免费筛选。调用 `add_filters` 前可用本接口查询合法的
`filter_title`。**免费接口，无需 `apiKey`，也不需要草稿。**

## 请求参数

```json
{
  "mode": 0
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| mode | integer | ❌ | 0 | 0=全部滤镜，1=仅 VIP，2=仅免费 |

## 响应格式

### 成功响应 (200)

```json
{
  "code": 0,
  "message": "success",
  "filters": [
    {
      "name": "1980",
      "is_vip": false,
      "resource_id": "7127828208690433311",
      "effect_id": "7127828208690433311",
      "has_params": false
    }
  ]
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| filters | array | 滤镜对象数组 |
| filters[].name | string | 滤镜名称，可直接作为 `add_filters` 的 `filter_title` |
| filters[].is_vip | boolean | 是否为 VIP 滤镜 |
| filters[].resource_id | string | 滤镜资源 ID |
| filters[].effect_id | string | 滤镜效果 ID |
| filters[].has_params | boolean | 是否带额外参数 |

### 错误响应

```json
{
  "code": 2040,
  "message": "获取滤镜列表失败"
}
```

## 使用示例

### cURL 示例

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_filters \
  -H "Content-Type: application/json" \
  -d '{"mode": 0}'
```

### 本技能脚本

```bash
node scripts/call-api.mjs --endpoint get_filters --data '{"mode": 2}'
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 1001 | 参数校验失败 | `mode` 超出 0-2 或类型错误 | 传入 0、1 或 2 |
| 2040 | 获取滤镜列表失败 | 读取滤镜元数据出错 | 重试或联系技术支持 |

## 注意事项

1. **无需草稿**：只读接口，不涉及任何草稿。
2. **名称匹配**：`name` 就是 `add_filters` 的 `filter_title` 所接受的值。
3. **与 add_filters 配合**：这里返回的名称一定能解析成功；名称匹配不到时 `add_filters` 会返回 `2039`。
