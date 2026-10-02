# add_beauty（添加美颜）

```
POST /openapi/capcut-mate/v1/add_beauty
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

给已有草稿中的视频片段添加美颜。美颜挂在视频片段上，写入 `materials.effects`（`type=figure`），不是独立特效轨道。

支持剪映「美颜」面板中已核对的 10 个参数：匀肤、丰盈、磨皮、祛法令纹、亮眼、祛黑眼圈、美白、白牙、肤色、肤色强度。每个参数都有默认值；滑杆为 0、肤色为空时不写入。任一滑杆生效时，会自动为该片段补一条 `makeup-root`。同一片段再次设置同名滑杆时只更新强度，不重复追加素材。

## 请求参数

```json
{
  "draft_url": "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=2025092811473036584258",
  "segment_ids": ["d62994b4-25fe-422a-a123-87ef05038558"],
  "匀肤": 100,
  "丰盈": 100,
  "磨皮": 100,
  "祛法令纹": 100,
  "亮眼": 100,
  "祛黑眼圈": 100,
  "美白": 60,
  "白牙": 100,
  "肤色": "暖白",
  "肤色强度": 60
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| draft_url | string | ✅ | "" | 目标草稿的完整 URL |
| segment_ids | array | ✅ | \[] | 要应用美颜的视频片段 ID |
| 匀肤 | number | ❌ | 0 | 匀肤强度，0–100 |
| 丰盈 | number | ❌ | 0 | 丰盈强度，0–100 |
| 磨皮 | number | ❌ | 0 | 磨皮强度，0–100 |
| 祛法令纹 | number | ❌ | 0 | 祛法令纹强度，0–100 |
| 亮眼 | number | ❌ | 0 | 亮眼强度，0–100 |
| 祛黑眼圈 | number | ❌ | 0 | 祛黑眼圈强度，0–100 |
| 美白 | number | ❌ | 0 | 美白强度，0–100 |
| 白牙 | number | ❌ | 0 | 白牙强度，0–100 |
| 肤色 | string | ❌ | "" | 肤色预设，空字符串表示不应用；当前支持 `暖白` |
| 肤色强度 | number | ❌ | 60 | 肤色强度，0–100，仅在设置 `肤色` 时生效 |
| beauty_infos | array | ❌ | \[] | 兼容旧写法的滑杆列表，可与具名参数同时使用 |

### beauty_infos

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| name | string | ✅ | - | 美颜名称：`匀肤`、`丰盈`、`磨皮`、`祛法令纹`、`亮眼`、`祛黑眼圈`、`美白`、`白牙`、`肤色`/`暖白` |
| intensity | number | ❌ | 0 | 强度，0–100，与剪映滑杆一致 |

具名参数与 `beauty_infos` 会先合并再写入。滑杆为 `0`、肤色为空时跳过；合并后至少需要一个生效滑杆。

写入草稿时强度会除以 100。美白、磨皮写在素材的 `value`；匀肤、丰盈、祛法令纹、亮眼、祛黑眼圈写在 `adjust_params`（`name` 为 `"0"`）；白牙写在 `adjust_params`（`name` 为 `"1"`）；肤色写在 `face_adjust_params`，导出名称为 `暖白`。

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
| affected_segments | array | 成功应用美颜的片段 ID |
| figure_ids | array | 美颜素材 ID，包含自动补上的 makeup-root |

## 使用示例

### 1. 具名参数

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_beauty \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "segment_ids": ["segment-id"],
    "匀肤": 80,
    "美白": 60,
    "肤色": "暖白",
    "肤色强度": 60
  }'
```

### 2. beauty_infos

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_beauty \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "segment_ids": ["segment-id"],
    "beauty_infos": [
      {"name": "磨皮", "intensity": 70},
      {"name": "白牙", "intensity": 50},
      {"name": "暖白", "intensity": 60}
    ]
  }'
```

### 3. 同一片段更新强度

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/add_beauty \
  -H "Content-Type: application/json" \
  -d '{
    "draft_url": "YOUR_DRAFT_URL",
    "segment_ids": ["segment-id"],
    "美白": 40
  }'
```

同一片段再次设置同名滑杆时只更新强度，不重复追加 figure 素材；每个片段只保留一条 `makeup-root`。

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 2001 | 无效的草稿URL | 草稿不存在或不在缓存中 | 检查 draft_url |
| 2015 | 片段未找到 | segment_id 不存在 | 确认片段 ID |
| 2016 | 无效的片段类型 | 非视频片段 | 只对视频/图片片段调用 |
| 2042 | 草稿锁获取超时 | 同一草稿正在被其他写入占用 | 稍后重试 |
| 2043 | 无效的美颜信息 | segment_ids 为空、无生效滑杆，或强度不在 0–100 | 检查美颜参数 |
| 2044 | 美颜类型未找到 | 不支持的滑杆名称（如瘦脸） | 使用已支持的名称 |
| 2045 | 美颜添加失败 | 写入片段美颜时失败 | 重试或联系技术支持 |

## 说明

* 只支持视频轨道上的片段（视频或图片）。字幕、音频等片段会失败。
* 瘦脸、大眼等未在草稿中核对过的滑杆暂不支持，传入会返回 `2044`。
* 美颜资源按 `resource_id` 写入，不写本机特效缓存路径。剪映打开草稿时自行下载资源。
* 具名参数为 0 或肤色为空时不会写入对应素材；至少需要提供一个非默认美颜参数或 `beauty_infos`。
* 肤色的 `name` / `肤色` 值可传 `肤色` 或 `暖白`，导出素材名称为 `暖白`。
* 每次成功写入都会保证片段上有且仅有一条 `makeup-root`（`type=makeup_root`，强度固定为 0）。

## 相关接口

* [添加视频](add-videos.md)
* [添加图片](add-images.md)
* [添加特效](add-effects.md)
* [保存草稿](save-draft.md)
