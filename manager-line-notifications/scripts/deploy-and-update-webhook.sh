#!/usr/bin/env bash
# clasp でデプロイし、発行された Web アプリ URL を LINE Developers の
# Webhook URL に自動反映する。
#
# 前提:
#   - clasp CLI にログイン済みであること
#   - LINE_CHANNEL_ACCESS_TOKEN, CLASP_USER を環境変数（または .env）で設定していること
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${LINE_CHANNEL_ACCESS_TOKEN:?LINE_CHANNEL_ACCESS_TOKEN is not set}"
: "${CLASP_USER:?CLASP_USER is not set}"

echo "==> ビルド"
pnpm run build

echo "==> Apps Script へ push"
clasp push -u "$CLASP_USER"

echo "==> デプロイ"
DEPLOY_JSON="$(clasp deploy -u "$CLASP_USER" --json)"
echo "$DEPLOY_JSON"

DEPLOYMENT_ID="$(node -e '
  const json = JSON.parse(process.argv[1]);
  if (!json.deploymentId) process.exit(1);
  console.log(json.deploymentId);
' "$DEPLOY_JSON")"

WEBHOOK_URL="https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec"
echo "==> Webhook URL: ${WEBHOOK_URL}"

echo "==> LINE Developers の Webhook URL を更新"
UPDATE_RESPONSE="$(curl -sS -o /dev/stderr -w '%{http_code}' -X PUT \
  "https://api.line.me/v2/bot/channel/webhook/endpoint" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LINE_CHANNEL_ACCESS_TOKEN}" \
  -d "{\"endpoint\": \"${WEBHOOK_URL}\"}")"

if [ "$UPDATE_RESPONSE" != "200" ]; then
  echo "LINE Webhook URL の更新に失敗しました (HTTP ${UPDATE_RESPONSE})" >&2
  exit 1
fi

echo "==> Webhook 疎通確認"
curl -sS -X POST "https://api.line.me/v2/bot/channel/webhook/test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LINE_CHANNEL_ACCESS_TOKEN}" \
  -d "{\"endpoint\": \"${WEBHOOK_URL}\"}"
echo

echo "==> 完了: Webhook URL を ${WEBHOOK_URL} に更新しました"
