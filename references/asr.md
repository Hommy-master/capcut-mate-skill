# asr（语音转文案）

```
POST https://autosubrt.jcaigc.cn/openapi/autosubrt/v1/asr
```

> 依据官方接口文档 https://docs.jcaigc.cn/capcut-mate/ 整理。
> **这是独立的语音识别服务**：基地址 `https://autosubrt.jcaigc.cn`，路径前缀 `/openapi/autosubrt/v1/`，
> 与剪映小助手（`capcut-mate.jcaigc.cn`）不是同一个服务，调用时不要拼错。

## 功能描述

把音频识别成**带标点的完整文案**，并按句末标点切成一句一句，同时给出每句话里每个字的时间线。
适合「拿到音频 → 直接出文案」的场景。只要纯文本用 [asr_text](asr-text.md)，
只要 SRT 文件用 [asr_srt](asr-srt.md)，要按自己写的文本对齐时间线用
[asr_text_align](asr-text-align.md)。

## 请求参数

```json
{
  "audio_url": "https://example.com/audio.mp3",
  "apiKey": "123e4567-e89b-12d3-a456-426614174000"
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| audio_url | string | ✅ | - | 音频文件 URL，需可被服务端直接下载 |
| apiKey | string | 开启计费时必填 | - | 合法 UUID；可登录 <https://jcaigc.cn> 获取 |

### 参数详解

#### audio_url

* **类型**: string
* **说明**: 服务端会先把这个 URL 下载到本地再识别，因此必须是**可直接访问的直链**
* **格式**: 常见音视频文件均可，如 wav、mp3、m4a、aac、flac、ogg；mp4、mov 等视频文件也能直接传（自动抽取音轨）
* **限制**: 单文件最大 100MB

## 响应格式

### 成功响应 (200)

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "text": "多谢，请入席吧。",
    "utterances": [
      {
        "text": "多谢，请入席吧。",
        "words": [
          { "text": "多", "start_time": 2810, "end_time": 3070 },
          { "text": "谢", "start_time": 3070, "end_time": 3330 },
          { "text": "请", "start_time": 4889, "end_time": 5320 },
          { "text": "入", "start_time": 5320, "end_time": 5620 },
          { "text": "席", "start_time": 5620, "end_time": 5860 },
          { "text": "吧", "start_time": 5860, "end_time": 6009 }
        ]
      }
    ]
  }
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| code | int | 0 表示成功 |
| message | string | 提示信息 |
| data.text | string | 完整文案，**一定带标点** |
| data.utterances | array | 分句结果，每条以句末标点收尾 |
| data.utterances[].text | string | 一句话的文本，标点计入其中 |
| data.utterances[].words | array | 该句每个字的时间线，**不含标点** |
| data.utterances[].words[].text | string | 单个字符（英文按字母切分） |
| data.utterances[].words[].start_time | int | 开始时间（**毫秒**） |
| data.utterances[].words[].end_time | int | 结束时间（**毫秒**） |

### 错误响应

```json
{
  "code": 2003,
  "message": "下载文件失败"
}
```

错误体**不包含** `data` 字段；所有错误都返回 HTTP 200，需按 `code` 判断成功与否。

## 计费

按**音频时长**扣费，与剪映小助手共用同一套充值余额。

| 项 | 说明 |
| --- | --- |
| 单价 | **0.00022 元/秒** |
| 计费依据 | 音频实际时长（秒），由识别引擎给出 |
| 扣费时机 | 识别**成功之后**才扣费；识别失败不扣费 |

10 秒 0.0022 元，60 秒 0.0132 元，1 小时 0.792 元。`apiKey` 必须是合法 UUID。

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 1001 | 参数校验失败 | 缺少 audio_url，或 apiKey 不是合法 UUID | 检查请求参数 |
| 2001 | 识别音频失败 | 音频无法解码、模型未加载，或 audio_url 返回 401/403/404 | 换可访问的直链或可播放文件 |
| 2002 | 文件大小超出限制 | 音频超过 100MB | 压缩或截取后再试 |
| 2003 | 下载文件失败 | 下载过程中网络或服务端错误 | 确认是公网可直链下载的地址 |
| 2005 | 下载文件超时 | 下载整体超时 | 换更快的源或更小的文件 |
| 2035 | 充值余额不足 | 余额不足 | 充值后重试 |
| 2036 | 无效的 apiKey | 计费开启时未传 apiKey | 登录 <https://jcaigc.cn> 获取 |
| 9997 | 服务器忙 | 并发已达上限 | 稍后重试 |
| 9998 | 系统内部错误 | 未预期的内部异常 | 联系技术支持 |
| 9999 | 未知异常 | 计费服务不可用等 | 稍后重试 |

## 注意事项

1. **时间单位是毫秒**（1 秒 = 1000）。注意 [asr_text_align](asr-text-align.md) 返回的是**微秒**，两者相差 1000 倍。
2. **分句只按句末标点断句**：遇到 `。！？.!?` 才结束一句话，逗号、顿号、冒号等留在句子内部。
3. **各句拼接与 `data.text` 逐字一致**：`"".join(u.text) == data.text`。
4. **标点没有时间戳**：`words` 只包含真实的字。
5. **整段没有识别出语音**时，`data.text` 为空字符串、`data.utterances` 为空数组，接口仍返回成功。
6. **重复调用会重复扣费**，超时后请勿盲目重试。
7. **与 add_captions 配合**：`start_time` / `end_time` 是毫秒，作为字幕时间需乘以 1000 转成微秒；
   分句文本自带标点，若按默认字幕规则（不含标点）需先去掉标点。

## 工作流程

1. 校验 apiKey（计费开启时）
2. 下载 `audio_url` 指向的音视频到服务端临时目录
3. 语音识别，得到逐字时间线
4. 标点模型恢复标点，得到带标点的完整文案
5. 按句末标点分句，识别成功后按音频时长扣费
6. 返回文案与分句时间线，删除临时文件

## 相关接口

* [语音转文本](asr-text.md)
* [语音转 SRT 字幕](asr-srt.md)
* [文本对齐时间线](asr-text-align.md)
* [添加字幕](add-captions.md)
