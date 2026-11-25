# voice_clone（声音复刻）

```
POST   https://api.jcaigc.cn/v1/audio/voices
GET    https://api.jcaigc.cn/v1/audio/voices
GET    https://api.jcaigc.cn/v1/audio/voices/{voice_id}
DELETE https://api.jcaigc.cn/v1/audio/voices/{voice_id}
```

> 依据官方文档 https://docs.jcaigc.cn/voice/voice-clone.md 整理。
> **这是独立的语音网关**：基地址 `https://api.jcaigc.cn/v1`，鉴权用
> `Authorization: Bearer <apiKey>`（也接受 `x-api-key`）。

## 默认模型与选择

**用户没有指定时，默认使用 `cosyvoice-v3.5-plus`（阿里云复刻，9.9 元/个）**。
调用前必须告知用户复刻费用、参考音频要求和可选模型，并确认用户有权使用该声音。

| 模型 | 复刻入口 | 合成时用 | 复刻费 |
|------|---------|----------|--------|
| `cosyvoice-v3.5-plus` | **默认**；`POST /v1/audio/voices` | 与创建时一致（1.5 元/万字符） | **9.9 元/个** |
| `cosyvoice-v3.5-flash` | `POST /v1/audio/voices` | 与创建时一致（0.8 元/万字符） | 9.9 元/个 |
| 豆包语音复刻音色 | **不通过开放 API** | `seed-icl-2.0`（2.8 元/万字符） | 豆包侧 138 元/个 |

- `cosyvoice-v3.5-*` 没有系统音色，必须先创建专属音色。
- `qwen3-tts-flash` **不支持声音复刻**。
- 用哪个模型创建的音色，合成时必须用同一个模型；`-plus` 与 `-flash` 不能混用。
- 每个账号最多保留 **10 个**音色；只能查看/使用/删除自己创建的音色。

## 创建音色

`POST /v1/audio/voices`，`multipart/form-data`：

| 参数 | 必填 | 说明 |
|------|------|------|
| `file` | 是 | 参考音频，3~30 秒、≤ 7.5MB；推荐 10~20 秒，单人、无背景音乐、无混响 |
| `model` | 是 | `cosyvoice-v3.5-plus` / `cosyvoice-v3.5-flash`；默认 `cosyvoice-v3.5-plus` |
| `name` | 否 | 展示名，最多 30 个字符；不填时展示名为空 |

```bash
curl -X POST https://api.jcaigc.cn/v1/audio/voices \
  -H "Authorization: Bearer 123e4567-e89b-12d3-a456-426614174000" \
  -F "file=@./my_voice.mp3" \
  -F "model=cosyvoice-v3.5-plus" \
  -F "name=myvoice"
```

```json
{
  "voice_id": "<voice_id>",
  "name": "myvoice",
  "model": "cosyvoice-v3.5-plus",
  "status": "DEPLOYING",
  "created_at": 1793000000,
  "fee": 9.9
}
```

创建成功（拿到 `voice_id`）即扣费 **9.9 元/个**；上游创建失败会全额退还。
创建成功后审核不通过（`UNDEPLOYED`）不自动退款，需要换参考音频重新创建；删除音色不退费。

### 查询状态

`GET /v1/audio/voices/{voice_id}`

| `status` | 含义 | 能否合成 |
|----------|------|----------|
| `DEPLOYING` | 审核与训练中 | 否，稍后重试 |
| `OK` | 已就绪 | 是 |
| `UNDEPLOYED` | 未通过（音频质量或内容不合规） | 否，换参考音频重建 |

```bash
curl https://api.jcaigc.cn/v1/audio/voices/<voice_id> \
  -H "Authorization: Bearer <apiKey>"
```

### 列出音色

```bash
curl https://api.jcaigc.cn/v1/audio/voices \
  -H "Authorization: Bearer <apiKey>"
```

只返回当前账号创建的音色。

### 删除音色

```bash
curl -X DELETE https://api.jcaigc.cn/v1/audio/voices/<voice_id> \
  -H "Authorization: Bearer <apiKey>"
```

删除后不能再用于合成，且不退费。

## 用专属音色合成

```bash
curl -X POST https://api.jcaigc.cn/v1/audio/speech \
  -H "Authorization: Bearer <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cosyvoice-v3.5-plus",
    "input": "这是用专属音色合成的示例音频。",
    "voice": "<voice_id>"
  }' \
  --output cloned.mp3
```

### 本技能脚本

```bash
node scripts/clone-voice.mjs --api-key <uuid> --create --file ./my_voice.mp3 --name myvoice
node scripts/clone-voice.mjs --api-key <uuid> --list
node scripts/clone-voice.mjs --api-key <uuid> --get <voice_id>
node scripts/clone-voice.mjs --api-key <uuid> --delete <voice_id>
node scripts/generate-speech.mjs --api-key <uuid> --text '...' \
  --model cosyvoice-v3.5-plus --voice <voice_id> --output cloned.mp3
```

## 计费

| 项目 | 费用 |
|------|------|
| 阿里云 `cosyvoice-v3.5-plus` / `-flash` 复刻 | **9.9 元/个** |
| 豆包语音复刻（不走本接口） | 138 元/个 |
| 用复刻音色合成 | 按所用合成模型计费：`-plus` 1.5 元/万字符，`-flash` 0.8 元/万字符，`seed-icl-2.0` 2.8 元/万字符 |

- 创建成功即扣费；上游创建失败全额退还；审核不通过（`UNDEPLOYED`）不退款；删除不退费。
- 查询/列出音色免费。
- 余额不足时不会请求上游，直接返回余额不足。

## 错误码

| `code` | 含义 |
|--------|------|
| `voice_not_found` | 音色不存在，或不属于当前账号 |
| `voice_quota_exceeded` | 账号音色数量已达上限（10 个） |
| `insufficient_quota` | 余额不足 |
| `invalid_voice_model` | 模型不支持复刻 |
| `voice_channel_unavailable` | 当前没有可用的上游渠道 |
| `voice_clone_failed` | 上游创建失败，`message` 里是具体原因 |

## 注意事项

1. **默认**：`cosyvoice-v3.5-plus`，9.9 元/个；调用前告知费用与参考音频要求。
2. **授权**：只复刻用户本人或已获得明确授权的声音；不要模仿他人或用于违法用途。
3. **参考音频**：3~30 秒、≤ 7.5MB，单人、无背景音乐、无混响。
4. **模型绑定**：用哪个模型创建，就用哪个模型合成；`-plus` 与 `-flash` 不能混用。
5. **审核风险**：`UNDEPLOYED` 不退款，创建前先确认音频质量与合规性。
6. **豆包复刻**：不通过本接口创建；拿到豆包音色 ID 后用 `seed-icl-2.0` 合成。

## 相关接口

* [语音合成](voice-tts.md)
* [音色库](voice-voices.md)
* [语音识别](voice-transcribe.md)
