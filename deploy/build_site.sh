#!/usr/bin/env bash
# 把网站成品放到 _site/：只包含网页需要的文件，JS 压缩，不带 tools/、docs/、脚本和提交历史。
# 由 .github/workflows/publish.yml 调用，结果推送到公开仓库 koshokai/nihonggo-dojo（GitHub Pages）。
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site && mkdir _site
# -z：文件名里有中文时不转义
git ls-files -z | grep -zvE '^(tools/|docs/|deploy/|supabase/|\.github/|README\.md$|\.gitignore$)' | tar --null -T - -cf - | tar -xf - -C _site
# 压缩网页脚本（vendor/ 里已经是压缩过的第三方库）
for f in _site/*.js; do
  npx --yes esbuild@0.24.0 "$f" --minify --legal-comments=none --target=es2020 --log-level=warning --outfile="$f.min" && mv "$f.min" "$f"
done
# 公开仓库自己的工作流（每小时的学习提醒）
cp -r deploy/public/.github _site/
touch _site/.nojekyll
echo "site files: $(find _site -type f | wc -l)"
