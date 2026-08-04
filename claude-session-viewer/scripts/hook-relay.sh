#!/bin/sh
# Installed by Claude Session Viewer's setup flow as the `command` for
# Claude Code hooks it registers in ~/.claude/settings.json. Claude Code
# invokes this once per hook event and pipes the hook's JSON payload on
# stdin (documented fields: session_id, transcript_path, cwd,
# hook_event_name, plus event-specific fields such as tool_name/message).
#
# We do exactly one thing: append that JSON, with a hook_event_name and a
# received_at timestamp we add ourselves, as one line to hooks.ndjson next
# to this script. We never inspect tool arguments/output beyond passing the
# JSON through — no prompt or file content is written anywhere by this
# script; see README.md "セキュリティとプライバシー".
#
# $1 is the hook event name, passed by us at registration time (Claude Code
# hook payloads for some event types do not repeat the event name, so we
# supply it positionally to be sure it's always present).

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
EVENT_NAME="${1:-Unknown}"
OUT_FILE="$SCRIPT_DIR/hooks.ndjson"

payload=$(cat)
received_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Merge in hook_event_name/received_at without a JSON tool dependency: strip
# the payload's outer braces and splice our fields in. This assumes the
# payload is a JSON object (Claude Code's documented hook contract) — if it
# isn't, we still record something rather than silently dropping the event.
case "$payload" in
  "{"*"}") body="${payload#\{}"; body="${body%\}}" ;;
  *) body="" ;;
esac

if [ -n "$body" ]; then
  printf '{"hook_event_name":"%s","received_at":"%s",%s}\n' "$EVENT_NAME" "$received_at" "$body" >> "$OUT_FILE"
else
  printf '{"hook_event_name":"%s","received_at":"%s"}\n' "$EVENT_NAME" "$received_at" >> "$OUT_FILE"
fi

# Never fail Claude Code's own flow because our logging hiccuped.
exit 0
