#!/usr/bin/env bash
# 정적 사이트를 빌드해 gh-pages 브랜치로 배포합니다.
#   npm run deploy
# GitHub Pages 설정: Settings → Pages → Deploy from a branch → gh-pages / (root)
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="$(git remote get-url origin)"
NAME="$(git config user.name || echo chris-jaehoon)"
EMAIL="$(git config user.email || echo chris-jaehoon@users.noreply.github.com)"

echo "▸ 빌드"
npm run build

echo "▸ gh-pages 준비"
TMP="$(mktemp -d)"
cp -a out/. "$TMP"/
cd "$TMP"
git init -q -b gh-pages
git config user.name "$NAME"
git config user.email "$EMAIL"
git add -A
git commit -q -m "배포: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -f "$REMOTE" gh-pages
cd - >/dev/null
rm -rf "$TMP"

echo "▸ 완료 — https://chris-jaehoon.github.io/My-Record/ (반영까지 1분 내외)"
