# 下载剪映草稿到本机

剪辑完成后默认执行（只有用户明确表示不需要时才跳过）。该流程会把草稿文件、
草稿内引用的远程素材下载到本机，并尽量激活剪映的目录发现，让新草稿尽快出现在
剪映首页；完成后提示用户可用剪映打开草稿查看成片。

对应脚本：`scripts/download-draft.mjs`（旧入口 `scripts/install-draft.mjs` 仍可用，
参数相同，`--work-dir` 已忽略）。

## 准备

1. Node.js 18 或更高版本。
2. 确认 `draft_url` 带 `draft_id`，形如：

   `https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1/get_draft?draft_id=...`

   > 官方 `create_draft` 响应中主机也可能是 `cm.jcaigc.cn`。下载器按 `jcaigc.cn`
   > 域名族校验，两种情况都能识别；**不要手工改写主机名**。

3. 从剪映设置中确认草稿根目录。常见默认目录：

   | 平台 | 默认草稿根目录 |
   |---|---|
   | Windows | `%LOCALAPPDATA%\JianyingPro\User Data\Projects\com.lveditor.draft` |
   | macOS | `~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft` |

   > 剪映草稿目录在 macOS 上是 `Movies/JianyingPro/...`，不是 `Movies/CapCut/...`。

4. 建议先关闭剪映；下载完成后重新打开或刷新草稿箱。

## 用法

自动探测草稿根目录：

```bash
node scripts/download-draft.mjs --draft-url "<draft_url>"
```

显式指定目录：

```bash
node scripts/download-draft.mjs \
  --draft-url "<draft_url>" \
  --draft-root "D:\JianyingDrafts\com.lveditor.draft"
```

也可以用环境变量：

```powershell
$env:JIANYING_DRAFT_ROOT = "D:\JianyingDrafts\com.lveditor.draft"
```

```bash
export JIANYING_DRAFT_ROOT="$HOME/Movies/JianyingPro/User Data/Projects/com.lveditor.draft"
```

常用参数：

| 参数 | 说明 |
|---|---|
| `--draft-root <目录>` | 指定剪映草稿根目录；缺省自动探测 |
| `--file-base <URL>` | `get_draft` 返回裸文件名时，指定文件下载基地址 |
| `--replace` | 允许覆盖同名草稿；**默认拒绝** |
| `--max-file-mb <MB>` | 单文件上限，默认 2048 |
| `--max-total-mb <MB>` | 总下载量上限，默认 8192 |
| `--discovery-timeout <毫秒>` | 等待剪映收录草稿的时间，默认 8000 |
| `--verbose` | 输出逐文件下载进度 |

下载器会输出 JSON 结果；`installed` 为 `true` 且进程退出码为 0 才算成功。

## 下载器做什么

1. 调用 `get_draft` 获取文件列表（失败最多重试 3 次，总超时 30 秒）。
2. 最多 10 路并发下载；单文件首次尝试 + 最多 10 次重试。
3. 支持 Range 断点续传：中断后重新运行同一命令会从半成品继续。
4. 空闲超时 10 秒、相对劣化看门狗：连接从自身峰值吞吐跌到 20% 以下且连续
   两个采样窗口确认时断开重连，避免长连接卡死。
5. 改写 `draft_content.json` / `draft_info.json`：
   - 把服务端绝对路径改为本地草稿目录；
   - 把 `materials.videos` / `materials.audios` 中的 http(s) 素材下载到
     `assets/{videos,audios,images}`；
   - 将素材路径归一化为剪映的
     `##_draftpath_placeholder_<UUID>_##/<草稿内相对路径>`；
   - 按实际路径重算 `config.material_save_mode`。
6. 改写 `draft_meta_info.json` 的 `draft_name`、`draft_fold_path`、
   `draft_root_path` 和素材登记表 `file_Path`。
7. 发布草稿：
   - **macOS/Linux**：先写 `<草稿根目录>/.capcut-mate-staging/<draft_id>`，
     全部文件成功后再原子改名为正式目录。剪映只会收录「一次出现就完整」的
     新目录，半成品不会被索引。
   - **Windows**：直接写正式目录，再用 `robocopy` 复制到临时目录并删除，
     触发 `ReadDirectoryChangesW`，让剪映无需重启即可发现新草稿。
8. 全部文件成功时，在草稿目录写入提示文件
   `【剪映草稿】请用剪映打开查看成片.txt`（UTF-8 BOM），说明这是剪映草稿、
   不是可直接播放的成片；写入失败只记日志，不影响草稿安装。
9. 轮询草稿根目录的 `root_meta_info.json`，确认剪映已把草稿登记进
   `all_draft_store`。
10. 下载前用真实写入探针检查目录权限（macOS TCC 下 `fs.access` 可能误报成功）。

## 结果字段

```json
{
  "installed": true,
  "draftDirectory": ".../com.lveditor.draft/<draft_id>",
  "draftRoot": ".../com.lveditor.draft",
  "draftId": "...",
  "published": true,
  "files": { "total": 12, "image": 3, "video": 6, "audio": 2, "config": 1,
             "success": 12, "failure": 0 },
  "jianyingDiscovered": true,
  "discoveryReason": "found",
  "message": "..."
}
```

- `jianyingDiscovered` 只表示本次是否**确认**剪映已收录；`false` 不影响安装结果。
- macOS/Linux 只有全部文件成功才会发布；未完整下载时 `installed: false`，结果里会给出
  `stagingDirectory`，重新运行同一命令即可续传。
- Windows 直接写正式目录，部分文件失败时 `published` 仍可能为 `true`；必须以
  `files.failure` 和进程退出码为准。
- 使用 `--replace` 覆盖 Windows 同名草稿时，旧目录会备份到
  `.capcut-mate-staging/`；成功后才删除，失败时结果里会给出 `backupDirectory`。

## 平台与发现确认

| 平台 | 下载位置 | 激活发现方式 | 确认方式 |
|---|---|---|---|
| macOS | 隐藏暂存目录 → 原子改名 | 完整目录一次出现 | `root_meta_info.json` |
| Windows | 正式目录 | `robocopy` 触发目录变更 | `root_meta_info.json` |
| Linux | 隐藏暂存目录 → 原子改名 | 无剪映客户端 | 通常返回 `root_meta_missing` |

`root_meta_info.json` 位于剪映草稿根目录。若剪映未运行或尚未初始化该文件，
下载器会报告无法确认，但草稿文件已经就位；打开剪映后它会自行扫描。

## 排障

- **macOS 提示无法写入**：到「系统设置 → 隐私与安全性 → 文件与文件夹」
  允许当前终端或宿主应用访问「影片」文件夹，然后重新运行。
- **`root_meta_missing`**：草稿根目录里还没有 `root_meta_info.json`。
  打开一次剪映，或确认 `--draft-root` 指向的是剪映设置里的草稿位置。
- **`not_listed`**：草稿已下载，但剪映未在超时时间内收录。剪映已开启时重启
  剪映；未运行时打开即可。
- **部分文件失败 / `installed:false`**：暂存目录会保留，修复网络或服务后重新
  运行同一命令即可续传；不要手工删除 `.capcut-mate-staging` 里的半成品。
- **同名草稿已存在**：默认拒绝覆盖。**不要删除用户原草稿**；先向用户确认，
  确实需要覆盖时加 `--replace`。
- **`get_draft` 返回裸文件名**：补 `--file-base "https://<文件下载基地址>/"`。
  当前线上服务通常返回完整 URL，不需要该参数。
- **素材下载失败或已失效**：草稿素材若来自 `upload_file`，返回的是带签名的临时 URL（默认 7 天）。
  下载草稿时才会实际下载文件，`add_*` 调用只登记 URL。URL 过期或文件被删除后无法再读取，
  只能重新上传并替换草稿中的 URL。

## 安全边界

- 草稿列表与草稿文件链接只接受 `jcaigc.cn` 域名族；
  每一跳重定向都会重新校验，拒绝路径穿越和重复目标路径。
- 草稿内引用的素材 URL 来自草稿 JSON 本身，会被下载到本地草稿目录。只对用户
  确认可信的草稿执行下载。
- 下载到本机的草稿文件仅供剪映打开、查看和导出；下载器安装完成后，**不要用脚本或编辑器再修改**
  （剪映草稿文件是加密的）。需要调整内容时，通过接口重新生成草稿。
- 下载器默认不覆盖已有草稿；`--replace` 只在用户明确同意时使用。
