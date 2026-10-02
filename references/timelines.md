# timelines（拆分时间线）

```
POST /openapi/capcut-mate/v1/timelines
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

根据指定的时长和数量创建时间线。该接口用于生成视频编辑所需的时间线配置，支持多种时间线类型和起始时间设置，为后续的素材添加和编辑提供时间参考。

## 请求参数

```json
{
  "duration": 10000000,
  "num": 3,
  "start": 0,
  "type": "equal"
}
```

### 参数说明

| 参数名 | 类型 |必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| duration | number |✅ | - |总时长(微秒) |
| num | number |✅ | - | 时间段数量 |
| start | number |❌ | 0 |时间(微秒) |
| type | string |❌ | "equal" | 时间线类型 |

### 参数详解

#### duration

* **类型**: number
* **说明**:总时长，单位为微秒（1秒 = 1,000,000微秒）
* **示例**: 10000000 (10秒)

#### num

* **类型**: number
* **说明**:需要创建的时间段数量
* **示例**: 3 (创建3个时间段)

#### start

* **类型**: number
* **说明**: 时间线的起始时间，单位为微秒
* **默认值**: 0
* **示例**: 2000000 (从2秒开始)

#### type

* **类型**: string
* **说明**: 时间线分割类型
* **可选值**:
  * "equal" -等分时间线
  * "custom" - 自定义时间线
* **默认值**: "equal"

## 响应格式

### 成功响应 (200)

```json
{
  "timelines": [
    {
      "start": 0,
      "end": 3333333
    },
    {
      "start": 3333333,
      "end": 6666666
    },
    {
      "start": 6666666,
      "end": 10000000
    }
  ],
  "all_timelines": [
    {
      "start": 0,
      "end": 10000000
    }
  ]
}
```

\###响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| timelines | array | 分段时间线数组 |
| all_timelines | array |完整时间线数组 |
| start | number | 时间段开始时间(微秒) |
| end | number | 时间段结束时间(微秒) |

\###错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

#### 1.基本时间线创建

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/timelines \
  -H "Content-Type: application/json" \
  -d '{
    "duration": 15000000,
    "num": 5,
    "start": 0,
    "type": "equal"
  }'
```

#### 2.带始时间的时间线

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/timelines \
  -H "Content-Type: application/json" \
  -d '{
    "duration": 20000000,
    "num": 4,
    "start": 5000000,
    "type": "equal"
  }'
```

\##错误码说明

| 错误码 |错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 400 | duration是必填项 |缺少总时长参数 | 提供有效的duration参数 |
| 400 | num是必填项 |缺少时间段数量参数 | 提供有效的num参数 |
| 400 | duration必须大于0 | 时长参数无效 | 使用大于0的时长值 |
| 400 | num必须大于0 | 数量参数无效 | 使用大于0的数量值 |
| 400 | 时间线类型无效 | type参数不支持 | 使用支持的时间线类型 |
| 500 | 时间线计算失败 |内部处理错误 |联技术支持术支持 |

## 注意事项

1. **时间单位**:所有时间参数使用微秒（1秒 = 1,000,000微秒）
2. **参数要求**: duration和num为必填参数
3. **时间范围**:确保start + (duration/num) * num <=总时长
4. **类型选择**:根据实际需求选择合适的时间线类型
5. **精度考虑**:微秒级别的时间精度适合精确的视频编辑

\##工作流程

1.验证必填参数（duration, num）
2.检查参数有效性（正数、合理范围）
3.根据type类型计算时间线分割方式
4\. 生成分段时间线数组
5\. 生成完整时间线数组
6\. 返回时间线配置结果

\##相关接口

* [创建草稿](create-draft.md)
* [音频时间线](audio-timelines.md)
* [视频信息](video-infos.md)
* [图片信息](imgs-infos.md)
