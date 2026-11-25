# 剪映小助手

开源的剪映草稿自动化技能。安装后，在 WorkBuddy、Codex 或 Claude 中用自然语言创建、编辑剪映草稿；剪辑完成后默认把草稿完整下载到本机剪映草稿箱（Windows / macOS，含远程素材本地化与激活剪映发现），并可按需异步导出成片。

- **技能名**：`jianchuang-jianying-assistant`
- **默认接口**：`https://capcut-mate.jcaigc.cn`
- **接口文档**：<https://docs.jcaigc.cn>

## 默认约定

| 项目 | 约定 |
| --- | --- |
| 画幅 | 生成素材默认跟随草稿画布：1080×1920 用 9:16，1920×1080 用 16:9；用户指定时以用户为准 |
| 字幕 | 默认 8 号字、金陵体、黑字白边并开启阴影，每行 ≤15 字 |
| 标题/花字 | 16 号字，每行 ≤8 字 |

字幕与标题的字号、字体、颜色均可由用户指定。

## 脚本

| 能力 | 脚本 |
| --- | --- |
| 文案生成 | `scripts/generate-script.mjs` |
| 图像生成 | `scripts/generate-image.mjs` |
| 视频生成 | `scripts/generate-video.mjs` |
| 数字人 | `scripts/generate-digital-human.mjs` |
| 音乐生成 | `scripts/generate-music.mjs` |
| 语音识别 | `scripts/transcribe-audio.mjs` |
| 语音合成 | `scripts/generate-speech.mjs` |
| 声音复刻 | `scripts/clone-voice.mjs` |
| 字幕/时间线 ASR | `scripts/call-asr.mjs` |
| 余额查询 | `scripts/get-points.mjs` |

脚本仅依赖 Node.js，无需安装其他包。

## 计费

草稿创建与编辑免费；以下线上服务按量计费：

| 服务 | 价格 |
| --- | --- |
| 导出成片 | 0.3 元/分钟（VIP 0.24 元/分钟，SVIP 0.18 元/分钟） |
| 上传素材 | 0.005 元/MB，单次最低 0.002 元 |

上传后返回带签名的临时 URL（默认 7 天有效），过期后需要重新上传。

文案、图像、视频、数字人、音乐与语音生成走独立网关 `https://api.jcaigc.cn/v1`，按以下标准计费：

| 能力 | 默认模型/规格 | 价格 |
| --- | --- | --- |
| 文案生成 | `gemini-3.5-flash-lite`（唯一接入） | 输入 2.25、输出 18.75 元/百万 token |
| 图像生成 | `doubao-seedream-5-0-flash` | 0.12 元/张；其它模型 0.2–1.12 元/张 |
| 视频生成 | `doubao-seedance-2.0` + 480P | 0.45 元/秒；其它文生/图生视频模型与分辨率 0.22–5 元/秒 |
| 数字人（视频对口型） | — | 0.08 元/秒 |
| 数字人（图片说话） | 480P / 720P | 0.5 / 0.9 元/秒 |
| 音乐生成 | `minimax-music-2.0` | 0.25 元/次；`minimax-music-3.0` 1 元/次 |
| 语音识别 | `volc.bigasr.auc_turbo` | 0.00022 元/秒 |
| 语音合成 | `seed-tts-2.0` | 2.8 元/万字符 |
| 声音复刻 | `cosyvoice-v3.5-plus` | 9.9 元/个 |

字幕/时间线 ASR 走独立服务 `https://autosubrt.jcaigc.cn`，0.00022 元/秒。

## 环境

- [Node.js](https://nodejs.org/) 18 或更高版本
- Codex CLI，或 Claude Code / Claude

自行安装时，把本仓库放到对应技能目录。目录名请使用 `jianchuang-jianying-assistant`，与 `SKILL.md` 中的 `name` 一致。

## WorkBuddy

在技能商店搜索「开源剪映小助手」，可以直接使用。

## Codex

个人技能，所有项目可用：

```bash
git clone https://github.com/Hommy-master/capcut-mate-skill.git ~/.agents/skills/jianchuang-jianying-assistant
```

仅当前仓库可用时，克隆到该仓库的 `.agents/skills/jianchuang-jianying-assistant`。

在 Codex 中输入 `$jianchuang-jianying-assistant`，或直接描述剪辑任务。未出现时重启 Codex。

更新：

```bash
git -C ~/.agents/skills/jianchuang-jianying-assistant pull
```

## Claude Code

个人技能，所有项目可用：

```bash
git clone https://github.com/Hommy-master/capcut-mate-skill.git ~/.claude/skills/jianchuang-jianying-assistant
```

仅当前项目可用时，克隆到该项目的 `.claude/skills/jianchuang-jianying-assistant`。

在 Claude Code 中输入 `/jianchuang-jianying-assistant`，或直接描述剪辑任务。若技能目录是本次会话开始后新建的，重启 Claude Code。

更新：

```bash
git -C ~/.claude/skills/jianchuang-jianying-assistant pull
```

## Claude 网页与桌面端

1. 将本仓库目录重命名为 `jianchuang-jianying-assistant`。
2. 打包为 ZIP，且 ZIP 内第一层是该目录，而不是直接放入 `SKILL.md`：

```text
jianchuang-jianying-assistant.zip
└── jianchuang-jianying-assistant/
    ├── SKILL.md
    ├── references/
    └── scripts/
```

3. 打开 **Customize → Skills**，选择 **Upload a skill**，上传 ZIP 并启用。
4. 新开一段对话后再使用。

安装到本机剪映草稿目录需要在本机执行脚本，请使用 Codex 或 Claude Code。

## 许可

本技能以 MIT 发布。后端 [CapCut Mate](https://github.com/Hommy-master/capcut-mate) 为 Apache-2.0。
