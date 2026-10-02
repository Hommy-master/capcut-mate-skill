# effect_infos（生成特效数据）

```
POST /openapi/capcut-mate/v1/effect_infos
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

根据特效名称和时间线生成特效信息。该接口将特效名称和时间线配置转换为剪映草稿所需的特效信息格式。

## 请求参数

```json
{
  "effects": ["blur", "vignette"],
  "timelines": [
    {"start": 0, "end": 3000000},
    {"start": 3000000, "end": 6000000}
  ]
}
```

### 参数说明

| 参数名 | 类型 |必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| effects | array\[string] |✅ | - |特名称数组 |
| timelines | array\[object] |✅ | - | 时间线配置数组 |

\##响应格式

### 成功响应 (200)

```json
{
  "infos": "[{\"effect\":\"blur\",\"start\":0,\"end\":3000000,\"duration\":5000000},{\"effect\":\"vignette\",\"start\":3000000,\"end\":6000000,\"duration\":5000000}]"
}
```

\###响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| infos | string |特效信息JSON字符串 |

\###错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

#### 1. 基本特效信息生成

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/effect_infos \
  -H "Content-Type: application/json" \
  -d '{
    "effects": ["blur"],
    "timelines": [{"start": 0, "end": 5000000}]
  }'
```

#### 2.多特效信息生成

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/effect_infos \
  -H "Content-Type: application/json" \
  -d '{
    "effects": ["blur", "vignette", "sepia"],
    "timelines": [{"start": 0, "end": 2000000}, {"start": 2000000, "end": 4000000}, {"start": 4000000, "end": 6000000}]
  }'
```

\##错误码说明

|错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 400 | effects是必填项 |缺少特效名称参数 | 提供有效的特效名称数组 |
| 400 | timelines是必填项 |缺少时间线参数 | 提供有效的时间线数组 |
| 400 | 数组长度不匹配 | effects和timelines长度不一致 |确保两个数组长度相同 |
| 500 |特效信息生成失败 |内部处理错误 |联技术支持 |

## 注意事项

1. **数组匹配**: effects和timelines数组长度必须相同
2. **时间单位**:所有时间参数使用微秒（1秒 = 1,000,000微秒）
3. **特效名称**:需要使用系统支持的特效名称
4. **连续性**:特效按时间线顺序应用

\##工作流程

1.验证必填参数（effects, timelines）
2.检查数组长度匹配
3.验证时间线参数有效性
4\. 为每个特效名称生成对应的特效信息
5.将信息转换为JSON字符串格式
6\. 返回处理结果

\##相关接口

* [创建草稿](create-draft.md)
* [添加特效](add-effects.md)
* [时间线](timelines.md)
* [保存草稿](save-draft.md)
