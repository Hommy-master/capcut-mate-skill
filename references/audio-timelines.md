# audio_timelines（按音频生成时间线）

```
POST /openapi/capcut-mate/v1/audio_timelines
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

根据音频文件时长计算时间线。该接口通过分析输入音频文件的时长信息，自动计算并生成合适的时间线配置，用于视频编辑中音频素材的精确时间安排。

## 请求参数

```json
{
  "links": [
    {
      "url": "https://assets.jcaigc.cn/audio1.mp3",
      "duration": 5000000
    },
    {
      "url": "https://assets.jcaigc.cn/audio2.mp3",
      "duration": 3000000
    }
  ]
}
```

### 参数说明

| 参数名 | 类型 |必 | | 默认值 | 说明 |
|--------|------|------|--------|------|
| links | array\[object] |✅ | - |音链接信息数组 |

### links 数组结构

每个links数组元素包含以下字段：

| 字段名 | 类型 |必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| url | string |✅ | - |音频文件URL地址 |
| duration | number |✅ | - | 音频时长(微秒) |

### 参数详解

#### url

* **类型**: string
* **说明**: 音频文件的完整URL地址
* **示例**: "https://assets.jcaigc.cn/background.mp3"

#### duration

* **类型**: number
* **说明**: 音频文件的时长，单位为微秒（1秒 = 1,000,000微秒）
* **示例**: 5000000 (5秒)

\##响应格式

### 成功响应 (200)

```json
{
  "timelines": [
    {
      "start": 0,
      "end": 5000000
    },
    {
      "start": 5000000,
      "end": 8000000
    }
  ],
  "all_timelines": [
    {
      "start": 0,
      "end": 8000000
    }
  ]
}
```

\###响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| timelines | array | 分段音频时间线数组 |
| all_timelines | array |完整音频时间线数组 |
| start | number | 时间段开始时间(微秒) |
| end | number | 时间段结束时间(微秒) |

### 错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

#### 1. 基本音频时间线计算

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/audio_timelines \
  -H "Content-Type: application/json" \
  -d '{
    "links": [
      {
        "url": "https://assets.jcaigc.cn/intro.mp3",
        "duration": 3000000
      },
      {
        "url": "https://assets.jcaigc.cn/bgm.mp3",
        "duration": 15000000
      }
    ]
  }'
```

#### 2.多音频时间线计算

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/audio_timelines \
  -H "Content-Type: application/json" \
  -d '{
    "links": [
      {
        "url": "https://assets.jcaigc.cn/opening.mp3",
        "duration": 2000000
      },
      {
        "url": "https://assets.jcaigc.cn/content.mp3",
        "duration": 10000000
      },
      {
        "url": "https://assets.jcaigc.cn/ending.mp3",
        "duration": 3000000
      }
    ]
  }'
```

\##错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 400 | links是必填项 |缺少音频链接参数 | 提供有效的links数组 |
| 400 | links格式错误 | JSON格式不正确 |检查JSON数组格式 |
| 400 | url是必填项 | 音频URL缺失 | 为每个音频提供URL |
| 400 | duration是必填项 |音频时长缺失 | 为每个音频提供时长 |
| 400 | duration必须大于0 | 时长参数无效 | 使用大于0的时长值 |
| 404 | 音频资源不存在 |音频URL无法访问 |检查音频URL是否可访问 |
| 500 |音频时间线计算失败 |内部处理错误 |联技术支持 |

## 注意事项

1. **时间单位**:所有时间参数使用微秒（1秒 = 1,000,000微秒）
2. **参数要求**: links数组为必填参数，且每个元素都需要url和duration
3. **时长准确性**:确保提供的duration参数准确反映音频实际时长
4. **网络访问**: 音频URL必须可以正常访问（用于验证）
5. **连续性**: 时间线按音频顺序连续排列，无间隔
6. **总时长**:完整时间线的end值等于所有音频时长之和

\##工作流程

1.验证必填参数（links）
2\. 解析links数组中的每个音频信息
3.验证每个音频的url和duration参数
4.按顺序计算每个音频的时间段
5\. 生成分段音频时间线数组
6\. 生成完整音频时间线数组
7\. 返回时间线配置结果

\##相关接口

* [创建草稿](create-draft.md)
* [创建时间线](timelines.md)
* [音频信息](audio-infos.md)
* [生成视频](gen-video.md)
