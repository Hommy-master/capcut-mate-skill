# generate_script（大语言模型生成视频文案）

```
POST https://api.jcaigc.cn/v1/chat/completions
```

> 依据官方文档 https://docs.jcaigc.cn/llm/ 整理。
> **本技能只接入一个模型：`gemini-3.5-flash-lite`**，其它大语言模型不在此技能范围内。
> 基地址 `https://api.jcaigc.cn/v1`，鉴权用 `Authorization: Bearer <apiKey>`（也接受 `x-api-key`）。

## 用途

主要用于生成**视频文案/口播文案/短视频脚本**，也可以用来润色、改写、翻译已有文案。
生成结果可以直接交给：

- [语音合成](voice-tts.md) 生成配音；
- [数字人](digital-human.md) 让图片/视频按配音开口；
- [添加字幕](add-captions.md) 作为字幕文本；
- 或人工修改后使用。

## 模型与计费

| 模型 | 输入 | 输出 |
|------|------|------|
| `gemini-3.5-flash-lite` | **2.25 元/百万 token** | **18.75 元/百万 token** |

计价公式：

```
输入 token ÷ 1,000,000 × 2.25 + 输出 token ÷ 1,000,000 × 18.75 = 费用（元）
```

示例：输入 1,000 token、输出 1,000 token，费用约 `0.00225 + 0.01875 = 0.021 元`。
失败请求不计费；实际单价以控制台「模型与定价」为准。

## 请求参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `model` | 是 | 固定 `gemini-3.5-flash-lite`（本技能不使用其它模型） |
| `messages` | 是 | 对话消息数组，至少一条 `user` |
| `stream` | 否 | 本技能用 `false`（同步返回）；接口也支持 `true` 走 SSE |
| `temperature` | 否 | 采样温度，建议 0.5–0.9；默认 0.7 |
| `max_tokens` | 否 | 最大输出 token 数；默认 2000 |

请求示例：

```bash
curl -X POST https://api.jcaigc.cn/v1/chat/completions \
  -H "Authorization: Bearer 123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.5-flash-lite",
    "messages": [
      {"role": "system", "content": "你是短视频口播文案编剧。输出口语化、短句、可直接朗读的中文文案。"},
      {"role": "user", "content": "主题：新手如何拍出稳定的手机视频。目标时长：30 秒。语气：自然、亲切。"}
    ],
    "stream": false,
    "temperature": 0.7
  }'
```

## 响应

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1699999999,
  "model": "gemini-3.5-flash-lite",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "..." },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 1000,
    "completion_tokens": 300,
    "total_tokens": 1300
  }
}
```

- 文案正文在 `choices[0].message.content`。
- 计费用量在 `usage.prompt_tokens` / `usage.completion_tokens`。

## 口播文案的默认写作规则

用户没有特别要求时，按以下规则生成：

1. **开头 1–2 句抓注意力**：先给冲突、问题或结果，不要慢热。
2. **口语化、短句**：一句话一个意思，避免书面语和长从句，方便直接朗读。
3. **按目标时长控制篇幅**：中文口播大约每秒 4 个字；15 秒约 60 字、30 秒约 120 字、
   60 秒约 240 字。默认按 30 秒。
4. **结构完整**：钩子 → 正文（2–4 个要点）→ 结尾行动号召。
5. **不编造事实/数据**：不确定的内容用通用表述，或提示用户补充。
6. **默认只输出文案正文**：不要 Markdown 标题、表情符号、分镜表，除非用户明确要求。

生成前最好确认：主题、目标受众、语气风格、目标时长、发布平台。

## 调用限制

| 项目 | 默认值 | 说明 |
|------|--------|------|
| 调用频率 | 120 次/分钟，突发 20 | 按密钥统计 |
| 等待响应头 | 1800 秒 | 上游一直不返回响应头的上限 |
| 空闲超时 | 300 秒 | 响应开始后连续无新数据的中断阈值 |
| 失败重试 | 最多 3 次 | 上游 5xx / 429 自动换渠道重试；4xx 不重试 |

## 本技能脚本

```bash
node scripts/generate-script.mjs --api-key <uuid> \
  --topic '新手如何拍出稳定的手机视频' --duration 30 --tone '自然、亲切'

node scripts/generate-script.mjs --api-key <uuid> \
  --topic '...' --duration 60 --platform '抖音' --audience '新手宝妈' --output script.txt
```

脚本默认使用 `gemini-3.5-flash-lite`，提交前打印单价，完成后按 `usage` 计算本次费用。

## 注意事项

1. **只用 `gemini-3.5-flash-lite`**：本技能不接入其它大语言模型，不要替换成别的模型名。
2. **按 token 计费**：输入和输出分别计价；调用前告知用户单价，完成后按 `usage` 结算。
3. **事实核验**：模型可能生成不准确的内容；涉及数据、医疗、法律、金融等信息时请用户核实。
4. **隐私**：不要发送账号密码、证件、客户名单、企业机密等敏感信息。
5. **与后续流程配合**：文案可直接交给 [语音合成](voice-tts.md) 生成配音，再交给
   [数字人](digital-human.md) 或 [添加音频](add-audios.md) 放进草稿。

## 相关接口

* [语音合成](voice-tts.md)
* [数字人](digital-human.md)
* [添加字幕](add-captions.md)
* [添加音频](add-audios.md)
* [大语言模型文档](https://docs.jcaigc.cn/llm/)
