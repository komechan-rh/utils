#!/bin/sh
# Installed as Claude Code's `statusLine` command (~/.claude/settings.json ->
# statusLine.command) by Claude Session Viewer's setup flow, IF the user did
# not already have one configured (we never overwrite an existing
# statusLine — see claude_config::merge_status_line).
#
# Claude Code runs this repeatedly and feeds it a JSON object on stdin
# describing the current session (session_id, cwd, model, and on some
# versions cost/context fields — the exact optional fields vary by version,
# see collectors::status_line.rs). Its stdout is shown as Claude Code's own
# terminal status line, so this script has two jobs:
#   1. print a short human-readable status line (required — this is the
#      actual statusLine contract)
#   2. append the same JSON, plus received_at, to statusline.ndjson next to
#      this script, so Claude Session Viewer can read it too
#
# No prompt or file content ever passes through here — the statusLine
# payload does not contain it.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUT_FILE="$SCRIPT_DIR/statusline.ndjson"

payload=$(cat)
received_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

case "$payload" in
  "{"*"}") body="${payload#\{}"; body="${body%\}}" ;;
  *) body="" ;;
esac

if [ -n "$body" ]; then
  printf '{"received_at":"%s",%s}\n' "$received_at" "$body" >> "$OUT_FILE"
else
  printf '{"received_at":"%s"}\n' "$received_at" >> "$OUT_FILE"
fi

# Minimal human-readable line for Claude Code's own status bar. Extracted
# with a tiny inline parse rather than a JSON tool dependency; falls back to
# a static label if fields are missing/unparseable.
model_name=$(printf '%s' "$payload" | sed -n 's/.*"display_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
cwd_base=$(printf '%s' "$payload" | sed -n 's/.*"current_dir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
cwd_base=$(basename "${cwd_base:-.}" 2>/dev/null || echo "")

if [ -n "$model_name" ]; then
  printf 'Claude Session Viewer | %s%s\n' "$model_name" "${cwd_base:+ | $cwd_base}"
else
  printf 'Claude Session Viewer\n'
fi

exit 0
