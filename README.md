# 剪映小助手

开源的剪映草稿自动化技能。安装后，在 WorkBuddy、Codex 或 Claude 中用自然语言创建、编辑剪映草稿，异步导出成片，或把草稿安装到本机剪映草稿箱。

技能名：`jianchuang-jianying-assistant`。默认请求托管接口 `https://capcut-mate.jcaigc.cn`。接口文档：<https://docs.jcaigc.cn>。创建与编辑免费；托管版导出按量计费。脚本仅依赖 Node.js，无需安装其他包。

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
