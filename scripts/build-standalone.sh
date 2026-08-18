#!/usr/bin/env bash
# 构建可部署的 standalone 产物（输出在 .next/standalone）。
# 用法：NEXT_PUBLIC_BASE_PATH=/vibehard bash scripts/build-standalone.sh
# 说明：Next standalone 在 pnpm 布局下会漏拷 @swc/helpers 的 esm 目录
#（运行期 require-hook 需要），这里在构建后补齐，并拷入 static 与 public。
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm build

SWC_SRC=$(ls -d node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers | head -1)
SWC_DST=$(ls -d .next/standalone/node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers | head -1)
if [ -d "$SWC_SRC/esm" ] && [ ! -d "$SWC_DST/esm" ]; then
  cp -r "$SWC_SRC/esm" "$SWC_DST/"
  echo "[build-standalone] 已补齐 @swc/helpers/esm"
fi

rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
rm -rf .next/standalone/public
cp -r public .next/standalone/public
echo "[build-standalone] standalone 产物就绪：.next/standalone（node server.js 启动）"
