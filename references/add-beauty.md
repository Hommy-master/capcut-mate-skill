# add_beauty（添加美颜 / 美型 / 美妆 / 美体）

```
POST /openapi/capcut-mate/v1/add_beauty
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

给已有草稿中的视频片段添加人像美化，覆盖剪映「美颜 / 美型 / 美妆 / 美体」四个面板，
对应请求体中的 `skin` / `shape` / `makeup` / `body` 四个分组。
美化素材挂在视频片段上，写入 `materials.effects`（`type=figure`），不是独立特效轨道。

> ⚠️ **字段名为英文**。旧版的中文具名参数（`匀肤`、`美白`…）与 `beauty_infos` 已移除，
> 分组内出现未知字段会直接返回 `1001` 参数校验失败，不要再传旧字段。
> 预设的**取值**仍是中文（如 `skin_tone: "冷白"`、`look: "淡人妆"`），与剪映面板一致。

四个分组都可选，但至少要有一项生效。滑杆为 0、预设为空字符串时**不写入**该素材（与剪映「关闭」= 素材缺失一致）；
任一滑杆生效时会自动为该片段补一条 `makeup-root`。
同一片段再次设置同一滑杆时只原地更新强度（保留素材 id），不会重复追加素材。

## 请求参数

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "segment_ids": ["d62994b4-25fe-422a-a123-87ef05038558"],
  "skin": { "smooth": 52, "whitening": 67, "skin_tone": "冷白", "temperature": 11, "intensity": 60 },
  "shape": { "small_face": 19, "slim": 33 },
  "makeup": { "look": "淡人妆", "intensity": 80 },
  "body": { "small_head": 33, "slim_waist": 60, "smooth": 19, "whitening": 26 }
}
```

### 公共参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| draft_url | string | ✅ | "" | 目标草稿的完整 URL |
| segment_ids | array | ✅ | \[] | 要应用美化的视频/图片片段 ID 数组 |
| skin | object | ❌ | - | 美颜参数组（剪映「美颜」面板），见下表 |
| shape | object | ❌ | - | 美型参数组（剪映「美型 - 面部」），见下表 |
| makeup | object | ❌ | - | 美妆参数组（剪映「美妆」），见下表 |
| body | object | ❌ | - | 美体参数组（剪映「美体」），见下表 |

四个分组内均不允许未知字段。

### skin（美颜）

| 字段 | 剪映面板名 | 类型 | 默认 | 说明 |
|------|-----------|------|------|------|
| even | 匀肤 | number | 0 | 强度 0–100 |
| plump | 丰盈 | number | 0 | 强度 0–100 |
| smooth | 磨皮 | number | 0 | 强度 0–100（与 `body.smooth` 是两个素材） |
| dewrinkle | 祛法令纹 | number | 0 | 强度 0–100 |
| bright_eye | 亮眼 | number | 0 | 强度 0–100 |
| dark_circle | 祛黑眼圈 | number | 0 | 强度 0–100 |
| whitening | 美白 | number | 0 | 强度 0–100（与 `body.whitening` 是两个素材） |
| white_teeth | 白牙 | number | 0 | 强度 0–100 |
| skin_tone | 肤色 | string | "" | 肤色预设：`冷白` / `暖白`，空字符串表示不应用 |
| temperature | 冷暖 | number | 0 | 肤色冷暖 0–99，仅设置 `skin_tone` 时生效 |
| intensity | 程度 | number | 60 | 肤色程度 0–100，仅设置 `skin_tone` 时生效 |

### shape（美型）—— 剪映「美型 - 面部」

| 字段 | 剪映面板名 | 类型 | 默认 | 说明 |
|------|-----------|------|------|------|
| small_face | 小脸 | number | 0 | 强度 0–100 |
| slim | 瘦脸 | number | 0 | 强度 0–100 |
| v_shape | V脸 | number | 0 | 强度 0–100 |
| jaw | 下颌骨 | number | 0 | 强度 0–100 |
| cheekbone | 颧骨 | number | 0 | 强度 0–100 |
| shorten | 短脸 | number | 0 | 强度 0–100 |
| contour_smooth | 流畅脸 | number | 0 | 强度 0–100 |
| lower | 下庭 | number | 0 | 强度 0–100 |
| middle | 中庭 | number | 0 | 强度 0–100 |
| upper | 上庭 | number | 0 | 强度 0–100 |
| hairline | 发际线 | number | 0 | 强度 0–100 |
| width | 窄脸 | number | 0 | **预留字段，暂不支持**，仅允许 0 |
| chin_length | 下巴长短 | number | 0 | **预留字段，暂不支持**，仅允许 0 |

### makeup（美妆）

| 字段 | 剪映面板名 | 类型 | 默认 | 说明 |
|------|-----------|------|------|------|
| look | 套装 | string | "" | 美妆套装预设，取剪映「美妆 - 套装」的中文名（共 54 个，见下），空字符串表示不应用 |
| intensity | 程度 | number | 80 | 套装程度 0–100，仅设置 `look` 时生效 |
| face_id | 人脸 | string | "-1" | 妆容作用的人脸：`-1` = 全部人脸（等价剪映「全局应用」）；也可指定检出的人脸序号 `0` / `1` / `2`… |

### body（美体）

| 字段 | 剪映面板名 | 类型 | 默认 | 说明 |
|------|-----------|------|------|------|
| small_head | 小头 | number | 0 | 强度 0–100 |
| swan_neck | 天鹅颈 | number | 0 | 强度 0–100 |
| slim_arm | 瘦手臂 | number | 0 | 强度 0–100 |
| straight_shoulder | 直角肩 | number | 0 | 强度 0–100 |
| slim_body | 瘦身 | number | 0 | 强度 0–100 |
| slim_waist | 瘦腰 | number | 0 | 强度 0–100 |
| long_leg | 长腿 | number | 0 | 强度 0–100 |
| plump_breast | 丰胸 | number | 0 | 强度 0–100 |
| slim_hip | 美胯 | number | 0 | 强度 0–100 |
| smooth | 磨皮 | number | 0 | 美体磨皮 0–100（与 `skin.smooth` 是两个素材） |
| whitening | 美白 | number | 0 | 美体美白 0–100（与 `skin.whitening` 是两个素材） |
| wide_shoulder | 宽肩 | number | 0 | **预留字段，暂不支持**，仅允许 0 |

## 写入草稿的映射

| 分组 | category_id | 强度落点 | 归一 |
|------|-------------|----------|------|
| skin 滑杆 | auto-beauty2 | `smooth` / `whitening` 写顶层 `value`，其余写 `adjust_params` | ÷100 |
| skin 肤色 | auto-beauty2 | `face_adjust_params`（ColdWarm + Intensity） | 冷暖 ÷99，程度 ÷100 |
| shape | auto-beauty | `adjust_params`（name 恒为 `"0"`） | ÷100 |
| makeup | makeup | `face_adjust_params`（face_adjust_whole） | ÷100 |
| body | auto-beauty3 | 顶层 `value` | ÷100 |

* skin、shape、makeup 的滑杆需要算法路径 `algorithm_artifact_path`；`whitening`、全部 body 滑杆、肤色不需要。
* makeup 会写入固定的 11 项 `exclusion_group`，避免与其它妆容部件叠加。
* 所有素材按 `resource_id` 写入，不写本机特效缓存路径；剪映打开草稿时自行下载资源。
* 草稿里效果条的 `name` 字段仍写剪映面板的中文名（如 `"name": "磨皮"`），与接口字段名无关。

### 预设对照

| 预设 | resource_id | 备注 |
|------|-------------|------|
| `skin_tone: 冷白` | 7148720872105185800 | 冷暖 ÷99、程度 ÷100 |
| `skin_tone: 暖白` | 7148720647714116132 | 冷暖默认 0 |
| `look: <套装名>` | 见源码元数据 | 默认全部人脸（`face_id` 为 `"-1"`） |

`look` 支持的 54 个套装（取值即名称本身，与剪映面板一致）：

> 90年代、doll感、上镜韩妹、中国妆、人形电脑、元气、兔兔妆、冬日白开水、冷感、减龄妆、初恋、原生、古早韩妆、夏日桃桃、夏日清透感、夏日白开水、奶杏、学姐妆、小烟熏、小魔女、微醺、心动、拜年妆、新年开运妆、无花果、春日樱花妆、柿柿如意、橘子汽水、氧气感、派对微醺、淡人妆、淡妆公式、淡盐系、清透感、热红酒、猫系女友、甜心芭比、甜系白开水、男友、男生、白开水、白鹿好运妆、盐系、纯欲蝴蝶兰、腮红大法、芋泥啵啵、芭蕾少女、英气、落日、裸妆、郁金香、雀斑自由、韩国学妹、韩系蜜桃

传入不在该列表内的名称会返回 `2044`。

## 响应参数

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "affected_segments": ["d62994b4-25fe-422a-a123-87ef05038558"],
  "figure_ids": ["figure-id-1", "makeup-root-id"]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| draft_url | string | 草稿 URL |
| affected_segments | array | 成功应用美化的片段 ID |
| figure_ids | array | 人像美化素材 ID，包含自动补上的 makeup-root |

## 使用示例

### 1. 美颜 + 美型

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_beauty \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "segment_ids": ["segment-id"],
    "skin": {"smooth": 52, "whitening": 67, "skin_tone": "冷白", "temperature": 11, "intensity": 60},
    "shape": {"small_face": 19, "slim": 33}
  }'
```

### 2. 美妆套装

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_beauty \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "segment_ids": ["segment-id"],
    "makeup": {"look": "淡人妆", "intensity": 80, "face_id": "-1"}
  }'
```

### 3. 美体

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_beauty \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "segment_ids": ["segment-id"],
    "body": {"small_head": 33, "slim_waist": 60, "smooth": 19, "whitening": 26}
  }'
```

### 4. 同一片段更新强度

只传要改的字段即可，素材 id 不变，不会重复追加：

```bash
-d '{"draft_url":"YOUR_DRAFT_URL","segment_ids":["segment-id"],"skin":{"whitening":40}}'
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|------|
| 1001 | 参数校验失败 | 滑杆越界（0–100，冷暖 0–99）、组内出现未知字段、`face_id` 非法 | 检查请求参数，勿传旧中文参数 |
| 2043 | 无效的美颜信息 | 未提供任何有效参数，或参数类型非法 | 至少提供一个非 0 滑杆或有效预设 |
| 2044 | 美颜类型未找到 | 预留字段传了非 0 值、肤色/美妆预设不支持 | 改用受支持的名称，或把预留字段传 0 |
| 2045 | 美颜添加失败 | 写入草稿过程出错 | 重试或检查草稿状态 |
| 2001 | 无效的草稿URL | 草稿不存在或不在缓存中 | 检查 draft_url |
| 2015 | 片段未找到 | segment_id 不存在 | 确认片段 ID |
| 2016 | 无效的片段类型 | 目标片段不是视频/图片片段 | 只对视频轨道片段应用 |
| 2042 | 草稿锁获取超时 | 同一草稿正在被其它写入占用 | 稍后重试 |

## 注意事项

1. **只支持视频轨道上的片段**（视频或图片），字幕、音频等片段会失败。
2. **0 表示不写入**：与剪映「关闭」= 素材缺失一致；已写入的滑杆只能改值，暂不支持删除/关闭。
3. **预留字段**：`shape.width`（窄脸）、`shape.chin_length`（下巴长短）、`body.wide_shoulder`（宽肩）
   在剪映草稿中没有对应素材资源，传非 0 会返回 `2044`，请传 0。
4. **skin 与 body 重名**：`smooth`、`whitening` 在两个分组下是**不同的素材**（resource_id 不同），需按分组设置。
5. **`face_id` 是人脸序号**：剪映按视频检出的先后顺序给脸编号（0 起），不是妆容自身的槽位。
   写死成某一序号时，换一段人脸更少或顺序不同的素材，妆容会落到不存在的人脸上而完全不渲染；
   不确定时保持默认 `"-1"`（全部人脸）。
6. **重复调用**：同一片段同一滑杆只更新强度，素材 id 不变；每个片段只保留一条 `makeup-root`。
7. **资源下载**：草稿只写 `resource_id`，不写本机缓存路径；首次用剪映打开时需联网下载素材。
8. **手绘小脸**（`manual_deformations`）不在本接口范围内。

## 相关接口

* [添加视频](add-videos.md)
* [添加图片](add-images.md)
* [添加特效](add-effects.md)
* [保存草稿](save-draft.md)
