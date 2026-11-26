#!/usr/bin/env bash
# 将本技能目录打包为 jianchuang-jianying-assistant.zip
# 解压后得到 jianchuang-jianying-assistant/ 目录；
# 打包内容与 .github/workflows/ci.yml 的发布包保持一致：
#   SKILL.md、README.md、_icon.png、references/、scripts/
# 不包含 .git、.github、LICENSE、zipit.sh 及本地临时文件。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_NAME="jianchuang-jianying-assistant"
OUT_ZIP="$SCRIPT_DIR/$PKG_NAME.zip"

# 需要进入发布包的顶层文件与目录（新增内容时同步修改 ci.yml）
PKG_FILES=(
  "SKILL.md"
  "README.md"
  "_icon.png"
)
PKG_DIRS=(
  "references"
  "scripts"
)

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

# 先拷贝到暂存目录，顶层目录名即为 jianchuang-jianying-assistant
mkdir -p "$STAGE_DIR/$PKG_NAME"
for f in "${PKG_FILES[@]}"; do
  if [[ ! -f "$SCRIPT_DIR/$f" ]]; then
    echo "错误：缺少待打包文件 $f" >&2
    exit 1
  fi
  cp -p "$SCRIPT_DIR/$f" "$STAGE_DIR/$PKG_NAME/"
done
for d in "${PKG_DIRS[@]}"; do
  if [[ ! -d "$SCRIPT_DIR/$d" ]]; then
    echo "错误：缺少待打包目录 $d" >&2
    exit 1
  fi
  cp -R "$SCRIPT_DIR/$d" "$STAGE_DIR/$PKG_NAME/"
done

# 入口文件必须在包内
if [[ ! -f "$STAGE_DIR/$PKG_NAME/SKILL.md" ]]; then
  echo "错误：暂存目录中缺少 SKILL.md" >&2
  exit 1
fi

# 在暂存目录内打包，避免把输出文件自身或临时文件路径带进压缩包
rm -f "$OUT_ZIP"
(cd "$STAGE_DIR" && zip -rqX "$OUT_ZIP" "$PKG_NAME")

# 校验包内顶层只有一个 "<PKG_NAME>/"，不会出现重复嵌套
TOP_LEVEL="$(zipinfo -1 "$OUT_ZIP" | awk -F/ '{print $1}' | sort -u)"
if [[ "$TOP_LEVEL" != "$PKG_NAME" ]]; then
  echo "错误：压缩包顶层目录异常（应为 ${PKG_NAME}/），实际为: $TOP_LEVEL" >&2
  exit 1
fi

COUNT="$(zipinfo -1 "$OUT_ZIP" | grep -vc '/$' || true)"
echo "已生成: $OUT_ZIP"
echo "包内文件: $COUNT 个"
