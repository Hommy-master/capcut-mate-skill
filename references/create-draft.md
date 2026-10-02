# create_draft（创建草稿）

```
POST /openapi/capcut-mate/v1/create_draft
```

> 依据官方接口文档 https://docs.jcaigc.cn/ 整理，基地址 `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1`。

## 功能描述

创建剪映草稿。该接口用于创建一个新的剪映草稿项目，可以自定义视频的宽度和高度。创建成功后会返回草稿URL和帮助文档URL，为后续的视频编辑操作提供基础。

时间单位为微秒（1秒=1000000）。本接口返回的 draft_url 必须原样传给后续所有写接口。不要自行拼接 draft_id。

## 请求参数

```json
{
  "width": 1920,
  "height": 1080
}
```

### 参数说明

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| width | number | ❌ | 1920 | 视频宽度(像素)，必须大于等于1 |
| height | number | ❌ | 1080 | 视频高度(像素)，必须大于等于1 |

### 参数详解

#### 尺寸参数

* **width**: 草稿视频的宽度
  * 最小值：1像素
  * 建议常用值：1920、1280、720
  * 支持自定义尺寸

* **height**: 草稿视频的高度
  * 最小值：1像素
  * 建议常用值：1080、720、480
  * 支持自定义尺寸

#### 常用分辨率

| 分辨率名称 | 宽度 | 高度 | 适用场景 |
|------------|------|------|----------|
| 1080P | 1920 | 1080 | 高清视频制作 |
| 720P | 1280 | 720 | 标清视频制作 |
| 4K | 3840 | 2160 | 超高清视频制作 |
| 竖屏短视频 | 1080 | 1920 | 手机短视频 |
| 正方形 | 1080 | 1080 | 社交媒体内容 |

## 响应格式

### 成功响应 (200)

```json
{
  "draft_url": "https://cm.jcaigc.cn/openapi/v1/get_draft?draft_id=2025092811473036584258",
  "tip_url": "https://help.assets.jcaigc.cn/draft-usage"
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| draft_url | string | 新创建的草稿URL，用于后续的编辑操作 |
| tip_url | string | 草稿使用帮助文档URL |

### 错误响应 (4xx/5xx)

```json
{
  "detail": "错误信息描述"
}
```

## 💻 使用示例

### cURL 示例

#### 1. 创建默认分辨率草稿

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/create_draft \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 2. 创建自定义分辨率草稿

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/create_draft \
  -H "Content-Type: application/json" \
  -d '{
    "width": 1280,
    "height": 720
  }'
```

#### 3. 创建竖屏短视频草稿

```bash
curl -X POST https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/create_draft \
  -H "Content-Type: application/json" \
  -d '{
    "width": 1080,
    "height": 1920
  }'
```

## 错误码说明

| 错误码 | 错误信息 | 说明 | 解决方案 |
|--------|----------|------|----------|
| 400 | width必须大于等于1 | 宽度参数无效 | 提供大于等于1的宽度值 |
| 400 | height必须大于等于1 | 高度参数无效 | 提供大于等于1的高度值 |
| 400 | 参数类型错误 | 参数类型不正确 | 确保width和height为数字类型 |
| 500 | 草稿创建失败 | 内部服务错误 | 联系技术支持 |
| 503 | 服务不可用 | 系统维护中 | 稍后重试 |

## 注意事项

1. **参数验证**: width和height必须为正整数
2. **分辨率建议**: 建议使用常见的视频分辨率以确保兼容性
3. **性能考虑**: 超高分辨率可能影响后续处理性能
4. **存储占用**: 高分辨率草稿会占用更多存储空间
5. **URL有效期**: 返回的draft_url具有一定的有效期

## 工作流程

1. 接收并验证请求参数
2. 创建草稿基础结构
3. 设置画布尺寸
4. 生成草稿URL
5. 返回草稿信息和帮助文档链接

## 相关接口

* [添加视频](add-videos.md)
* [添加音频](add-audios.md)
* [添加图片](add-images.md)
* [保存草稿](save-draft.md)
* [生成视频](gen-video.md)

## ⚠️ 实施提示（本技能补充）

- 官方响应示例中的 `draft_url` 主机为 `cm.jcaigc.cn`，而其余接口文档统一写 `capcut-mate.jcaigc.cn`。**不要把 `draft_url` 当成可自行拼接的字符串**，一律原样透传即可，主机差异由服务端处理。
- `draft_url` 有有效期，且草稿依赖服务端状态；跨天或长时间中断后如失效，重新 `create_draft` 并重放确定性的素材步骤。
