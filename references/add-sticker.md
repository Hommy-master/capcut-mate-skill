# add_sticker（添加贴纸）

```
POST /openapi/capcut-mate/v1/add_sticker
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

向现有草稿中添加贴纸。该接口用于在指定的时间段内添加贴纸素材到剪映草稿中，支持贴纸的缩放和位置调整。贴纸可以用于增强视频的视觉效果，如表情、装饰、文字等。

## 请求参数

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "sticker_id": "7326810673609018675",
  "start": 0,
  "end": 5000000,
  "scale": 1.0,
  "transform_x": 0,
  "transform_y": 0
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| draft_url | string | ✅ | - | 目标草稿的完整URL |
| sticker_id | string | ✅ | - | 贴纸的唯一标识ID |
| start | number | ✅ | - | 贴纸开始时间（微秒） |
| end | number | ✅ | - | 贴纸结束时间（微秒） |
| scale | number | ❌ | 1.0 | 贴纸缩放比例，建议范围\[0.1, 5.0] |
| transform_x | number | ❌ | 0 | X轴位置偏移（像素） |
| transform_y | number | ❌ | 0 | Y轴位置偏移（像素） |

### 参数详解

#### 时间参数

* **start**: 贴纸在时间轴上的开始时间，单位为微秒（1秒 = 1,000,000微秒）
* **end**: 贴纸在时间轴上的结束时间，单位为微秒
* **duration**: 贴纸显示时长 = end - start

#### 缩放参数

* **scale**: 贴纸的缩放比例
  * 1.0 = 原始大小
  * 0.5 = 缩小到一半
  * 2.0 = 放大到两倍
  * 建议范围：0.1 - 5.0

#### 位置参数

* **transform_x**: 贴纸在X轴方向的位置偏移，单位为像素
  * 正值向右移动
  * 负值向左移动
  * 以画布中心为原点
  * 实际存储时会转换为半画布宽单位（假设画布宽度1920，即除以960）

* **transform_y**: 贴纸在Y轴方向的位置偏移，单位为像素
  * 正值向下移动
  * 负值向上移动
  * 以画布中心为原点
  * 实际存储时会转换为半画布高单位（假设画布高度1080，即除以540）

#### 贴纸ID说明

* **sticker_id**: 贴纸的唯一标识符
  * 格式：通常为数字字符串
  * 示例：`"7326810673609018675"`
  * 获取方式：通过剪映贴纸库或相关API获取

## 响应格式

### 成功响应 (200)

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "sticker_id": "7326810673609018675",
  "track_id": "track-uuid",
  "segment_id": "segment-uuid",
  "duration": 5000000
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| draft_url | string | 更新后的草稿URL |
| sticker_id | string | 贴纸的唯一标识ID |
| track_id | string | 贴纸轨道ID |
| segment_id | string | 贴纸片段ID |
| duration | number | 贴纸显示时长（微秒） |

### 错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

#### 1. 基本贴纸添加

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_sticker \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "sticker_id": "7326810673609018675",
    "start": 0,
    "end": 5000000
  }'
```

#### 2. 带缩放的贴纸

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_sticker \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "sticker_id": "7326810673609018675",
    "start": 1000000,
    "end": 6000000,
    "scale": 1.5
  }'
```

#### 3. 带位置偏移的贴纸

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_sticker \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "sticker_id": "7326810673609018675",
    "start": 2000000,
    "end": 7000000,
    "scale": 0.8,
    "transform_x": 200,
    "transform_y": -100
  }'
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 400 | draft_url是必填项 | 缺少草稿URL参数 | 提供有效的draft_url |
| 400 | sticker_id是必填项 | 缺少贴纸ID参数 | 提供有效的sticker_id |
| 400 | start是必填项 | 缺少开始时间参数 | 提供有效的start时间 |
| 400 | end是必填项 | 缺少结束时间参数 | 提供有效的end时间 |
| 400 | 时间范围无效 | end必须大于start | 确保结束时间大于开始时间 |
| 400 | 缩放比例无效 | scale超出建议范围 | 使用0.1-5.0范围内的缩放值 |
| 400 | 无效的贴纸信息，请检查贴纸参数是否正确 | 贴纸参数校验失败 | 检查贴纸参数是否符合要求 |
| 404 | 草稿不存在 | 指定的草稿URL无效 | 检查草稿URL是否正确 |
| 404 | 贴纸不存在 | 指定的贴纸ID无效 | 确认贴纸ID是否正确 |
| 500 | 贴纸添加失败 | 内部处理错误 | 联系技术支持 |

## 注意事项

1. **时间单位**: 所有时间参数使用微秒（1秒 = 1,000,000微秒）
2. **贴纸ID**: 确保使用有效的贴纸ID
3. **时间范围**: end必须大于start
4. **缩放范围**: scale建议在0.1-5.0范围内
5. **位置参数**: transform_x和transform_y单位为像素，但内部会转换为半画布单位存储
   * transform_x转换公式：实际值 / 960（假设画布宽度1920）
   * transform_y转换公式：实际值 / 540（假设画布高度1080）
6. **轨道管理**: 系统自动创建贴纸轨道
7. **性能考虑**: 避免同时添加大量贴纸

## 工作流程

1. 验证必填参数（draft_url, sticker_id, start, end）
2. 检查时间范围的有效性
3. 从缓存中获取草稿
4. 创建贴纸轨道（如果不存在）
5. 创建图像调节设置
6. 创建贴纸片段
7. 添加片段到轨道
8. 保存草稿
9. 返回贴纸信息

## 相关接口

* [创建草稿](create-draft.md)
* [添加视频](add-videos.md)
* [添加音频](add-audios.md)
* [添加图片](add-images.md)
* [保存草稿](save-draft.md)
* [生成视频](gen-video.md)
