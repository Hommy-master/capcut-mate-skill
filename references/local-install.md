# 下载并安装到剪映草稿箱

只在用户明确要求本地安装时执行。

## 准备

1. 建议先关闭剪映。
2. 确认 `draft_url` 是本服务返回的草稿链接，形如：

   `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=...`

   > 官方 `create_draft` 的响应示例中主机也可能出现 `cm.jcaigc.cn`。安装器按 `jcaigc.cn` 域名族校验，
   > 两种情况都能识别；但**不要手工改写主机名**。

3. 优先让用户从剪映设置中确认草稿位置。常见默认目录：

   | 平台 | 默认草稿根目录 |
   |---|---|
   | Windows | `%LOCALAPPDATA%\JianyingPro\User Data\Projects\com.lveditor.draft` |
   | macOS | `~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft` |

## 安装

自动发现默认目录：

```bash
node scripts/install-draft.mjs --draft-url "<draft_url>"
```

显式指定目录：

```bash
node scripts/install-draft.mjs --draft-url "<draft_url>" --draft-root "D:\JianyingDrafts\com.lveditor.draft"
```

也可以设置环境变量：

```powershell
$env:JIANYING_DRAFT_ROOT = "D:\JianyingDrafts\com.lveditor.draft"
```

```bash
export JIANYING_DRAFT_ROOT="$HOME/Movies/JianyingPro/User Data/Projects/com.lveditor.draft"
```

## 安装器做什么

- 校验 HTTPS，并限定在 `jcaigc.cn` 域名族内；
- 拒绝外部跳转、路径穿越和重复文件目标；
- 限制文件数（≤500）、单文件大小（≤256 MB）及总下载量（≤1 GB）；
- 要求草稿同时包含 `draft_content.json` 和 `draft_meta_info.json`；
- 修复素材绝对路径与草稿元数据（`draft_name`、`draft_fold_path`、`draft_root_path`）；
- 先复制到临时目录，再原子安装；
- 拒绝覆盖同名草稿。

## 已知差异与排障

- **文件列表形态**：官方 `get_draft` 响应示例中的 `files` 是裸文件名（如 `2f52a63b-....json`），
  也可能是可直接下载的完整 URL。安装器两种都支持。
- **裸文件名 + `--file-base`**：当 `files` 是裸文件名时，安装器需要知道文件下载的基地址，请补上：

  ```bash
  node scripts/install-draft.mjs --draft-url "<draft_url>" --file-base "https://<文件下载基地址>/"
  ```

  若服务直接返回完整 URL，则无需 `--file-base`。
- **业务包装**：安装器同时接受 `{"files": [...]}` 与 `{"code": 0, "data": {"files": [...]}}`。
- 若提示「草稿文件列表响应格式不正确」，先用 `node scripts/call-api.mjs --endpoint get_draft --data '{"draft_id":"..."}'`
  看真实返回结构，再决定是否需要在安装器里补充字段路径。
- 若提示同名草稿已存在，**不要删除或覆盖用户原草稿**。让服务创建新草稿，或由用户自行处理旧草稿后再安装。
- 安装完成后提醒用户重新打开或刷新剪映草稿箱。
