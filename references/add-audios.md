# add_audios（添加音频）

```
POST /openapi/capcut-mate/v1/add_audios
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

批量向现有草稿中添加音频素材。该接口支持添加多个音频文件到剪映草稿，为视频创建背景音乐、音效、旁白等音频内容。音频将被添加到独立的音频轨道中，不会影响视频内容。

必须传入 create_draft 返回的 draft_url。audio_infos 必须是 JSON 字符串（不是对象数组）。start/end 单位为微秒。

## 请求参数

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "audio_infos": "[{\"audio_url\":\"https://assets.jcaigc.cn/audio1.mp3\",\"start\":0,\"end\":5000000,\"duration\":10000000,\"volume\":1.0,\"audio_effect\":\"reverb\"}]"
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| draft_url | string | ✅ | - | 目标草稿的完整URL |
| audio_infos | string | ✅ | - | 音频信息数组的JSON字符串 |

### audio_infos 数组结构

audio_infos是一个JSON字符串，解析后为数组，每个元素包含以下字段：

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| audio_url | string | ✅ | - | 音频文件的URL地址 |
| start | number | ✅ | - | 音频开始播放时间(微秒) |
| end | number | ✅ | - | 音频结束播放时间(微秒) |
| duration | number | ❌ | 自动获取 | 音频总时长(微秒)，如果不提供将自动获取 |
| volume | number | ❌ | 1.0 | 音量大小(0.0-2.0) |
| audio_effect | string | ❌ | None | 音频效果名称 |

### 参数详解

#### 时间参数

* **start**: 音频在时间轴上的开始时间，单位为微秒（1秒 = 1,000,000微秒）
* **end**: 音频在时间轴上的结束时间，单位为微秒
* **duration**: 音频文件的总时长，用于素材创建，单位为微秒，如果不提供将自动获取
* **播放时长**: 实际播放时长 = end - start

#### 音量控制

* **volume**: 音频音量大小
  * 1.0 = 原始音量
  * 0.5 = 一半音量
  * 0.0 = 静音
  * 范围：0.0 - 2.0

#### 音频效果

* **audio_effect**: 音频效果名称
  * None = 无音频效果
  * 示例：`"reverb"`（混响效果）

## 响应格式

### 成功响应 (200)

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "track_id": "audio-track-uuid",
  "audio_ids": ["audio1-uuid", "audio2-uuid", "audio3-uuid"]
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| draft_url | string | 更新后的草稿URL |
| track_id | string | 音频轨道ID |
| audio_ids | array | 添加的音频ID列表 |

### 错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

#### 1. 基本音频添加

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_audios \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "audio_infos": "[{\"audio_url\":\"https://assets.jcaigc.cn/bgm.mp3\",\"start\":0,\"end\":10000000,\"duration\":15000000,\"volume\":0.8}]"
  }'
```

#### 2. 多音频批量添加

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_audios \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "audio_infos": "[{\"audio_url\":\"https://assets.jcaigc.cn/intro.mp3\",\"start\":0,\"end\":3000000,\"duration\":5000000,\"volume\":1.0},{\"audio_url\":\"https://assets.jcaigc.cn/bgm.mp3\",\"start\":3000000,\"end\":30000000,\"duration\":35000000,\"volume\":0.6}]"
  }'
```

#### 3. 带淡入淡出效果的音频

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_audios \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "audio_infos": "[{\"audio_url\":\"https://assets.jcaigc.cn/outro.mp3\",\"start\":25000000,\"end\":30000000,\"duration\":8000000,\"volume\":0.9,\"audio_effect\":\"reverb\"}]"
  }'
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 400 | draft_url是必填项 | 缺少草稿URL参数 | 提供有效的草稿URL |
| 400 | audio_infos是必填项 | 缺少音频信息参数 | 提供有效的音频信息JSON |
| 400 | audio_infos格式错误 | JSON格式不正确 | 检查JSON字符串格式 |
| 400 | 音频配置验证失败 | 音频参数不符合要求 | 检查每个音频的参数 |
| 400 | audio_url是必填项 | 音频URL缺失 | 为每个音频提供URL |
| 400 | 时间范围无效 | end必须大于start | 确保结束时间大于开始时间 |
| 400 | 音量值无效 | volume不在0.0-2.0范围内 | 使用0.0-2.0之间的音量值 |
| 404 | 草稿不存在 | 指定的草稿URL无效 | 检查草稿URL是否正确 |
| 404 | 音频资源不存在 | 音频URL无法访问 | 检查音频URL是否可访问 |
| 500 | 音频处理失败 | 内部处理错误 | 联系技术支持 |

## 注意事项

1. **JSON格式**: audio_infos必须是合法的JSON字符串
2. **时间单位**: 所有时间参数使用微秒（1秒 = 1,000,000微秒）
3. **音频格式**: 确保音频文件格式被支持（如MP3、WAV、AAC等）
4. **文件大小**: 大音频文件可能影响处理速度
5. **网络访问**: 音频URL必须可以正常访问
6. **音量范围**: 音量值必须在0.0-2.0范围内
7. **轨道限制**: 同一时间段可能存在音频重叠

## 工作流程

1. 验证必填参数（draft_url, audio_infos）
2. 解析audio_infos JSON字符串
3. 验证每个音频的参数配置
4. 获取并解密草稿内容
5. 创建音频轨道
6. 添加音频片段到轨道
7. 应用音量和音频效果
8. 保存并加密草稿
9. 返回处理结果

## 相关接口

* [创建草稿](create-draft.md)
* [添加视频](add-videos.md)
* [添加图片](add-images.md)
* [保存草稿](save-draft.md)
* [生成视频](gen-video.md)
