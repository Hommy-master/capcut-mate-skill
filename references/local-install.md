# 下载并安装到剪映草稿箱（旧入口）

本能力已升级为完整下载器，覆盖文件列表下载、远程素材本地化、占位符路径归一化、
暂存目录原子发布、Windows 目录扫描激活与 `root_meta_info.json` 发现确认。

**完整说明见 [download-draft.md](download-draft.md)。**

旧命令仍然可用（兼容别名，参数相同，`--work-dir` 已忽略）：

```bash
node scripts/install-draft.mjs --draft-url "<draft_url>"
```

新入口：

```bash
node scripts/download-draft.mjs --draft-url "<draft_url>"
```
