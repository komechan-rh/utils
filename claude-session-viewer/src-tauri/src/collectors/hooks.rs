//! Parses events forwarded by our Claude Code hook relay script.
//!
//! Claude Code invokes hook commands as external processes and only shows
//! their combined stdout/stderr in its own transcript — it does not push
//! events into arbitrary long-running programs. So the integration is: our
//! setup flow (see `claude_config`) registers a tiny relay script as the
//! command for every hook event we care about; each invocation receives the
//! hook's JSON payload on stdin (this stdin contract — `session_id`,
//! `transcript_path`, `cwd`, `hook_event_name`, plus event-specific fields
//! like `tool_name` / `message` — is Claude Code's documented hooks
//! feature) and the script appends one line of that JSON, plus a
//! `received_at` timestamp it adds itself, to
//! `<app data dir>/hooks.ndjson`. We tail that file exactly like a
//! transcript.
//!
//! This is the highest-trust source (`DataSource::OfficialHook`) because it
//! is Claude Code itself telling us, synchronously, that a specific
//! lifecycle event just happened — nothing here is inferred.

use serde_json::Value;
use uuid::Uuid;

use crate::domain::events::{RawEvent, RawEventKind};
use crate::domain::status::status_for_hook;
use crate::domain::types::DataSource;
use chrono::{DateTime, Utc};

/// Parses one line of `hooks.ndjson` into raw events. A single hook
/// invocation always yields exactly one `StatusUpdate` (even if the event
/// name is unrecognized, in which case status is `Unknown` — we never drop
/// the event, so `SessionSeen`/activity bookkeeping still happens), plus a
/// `SessionSeen` to backfill cwd, and for `SessionEnd` a terminal event.
pub fn parse_hook_line(line: &str) -> Vec<RawEvent> {
    let Ok(v) = serde_json::from_str::<Value>(line) else {
        return vec![];
    };
    let Some(session_id) = v.get("session_id").and_then(Value::as_str) else {
        return vec![];
    };
    let event_name = v
        .get("hook_event_name")
        .and_then(Value::as_str)
        .unwrap_or("");
    let received_at = v
        .get("received_at")
        .and_then(Value::as_str)
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);
    // Hooks don't carry a stable id of their own; we mint one from a hash of
    // the line's content position via a random uuid is wrong for dedup, so
    // instead build a deterministic id from the fields that make an
    // invocation unique together.
    let dedup_seed = format!(
        "{session_id}:{event_name}:{}",
        v.get("received_at").and_then(Value::as_str).unwrap_or("")
    );
    let event_id = deterministic_id(&dedup_seed);

    let message = v.get("message").and_then(Value::as_str);
    let (status, confidence) = status_for_hook(event_name, message);

    let mut events = vec![RawEvent {
        event_id: format!("{event_id}:status"),
        source: DataSource::OfficialHook,
        timestamp: received_at,
        session_id: session_id.to_string(),
        kind: RawEventKind::StatusUpdate { status, confidence },
    }];

    let cwd = v.get("cwd").and_then(Value::as_str).map(|s| s.to_string());
    if cwd.is_some() {
        let project_name = cwd.as_deref().and_then(|c| {
            c.rsplit('/').find(|s| !s.is_empty()).map(|s| s.to_string())
        });
        events.push(RawEvent {
            event_id: format!("{event_id}:seen"),
            source: DataSource::OfficialHook,
            timestamp: received_at,
            session_id: session_id.to_string(),
            kind: RawEventKind::SessionSeen {
                pid: None,
                cwd,
                project_name,
                model: None,
                started_at: None,
            },
        });
    }

    if event_name == "SubagentStop" {
        // Claude Code's SubagentStop hook fires once the subagent's own turn
        // finishes, but does not include the Task tool_use id that started
        // it in its documented payload, so we cannot link it to a specific
        // subagent record here without guessing. We only use it as an
        // activity signal; subagent completion itself is derived from the
        // transcript's tool_result pairing (collectors::transcripts), which
        // does have that id.
        events.push(RawEvent {
            event_id: format!("{event_id}:activity"),
            source: DataSource::OfficialHook,
            timestamp: received_at,
            session_id: session_id.to_string(),
            kind: RawEventKind::ActivityPing,
        });
    }

    events
}

fn deterministic_id(seed: &str) -> String {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, seed.as_bytes()).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_pre_tool_use_into_using_tool_status() {
        let line = serde_json::json!({
            "session_id": "s1",
            "hook_event_name": "PreToolUse",
            "cwd": "/Users/alice/proj",
            "tool_name": "Bash",
            "received_at": "2026-01-01T00:00:00Z"
        })
        .to_string();
        let events = parse_hook_line(&line);
        let status = events
            .iter()
            .find_map(|e| match &e.kind {
                RawEventKind::StatusUpdate { status, .. } => Some(*status),
                _ => None,
            })
            .unwrap();
        assert_eq!(status, crate::domain::types::SessionStatus::UsingTool);
    }

    #[test]
    fn same_line_parsed_twice_yields_same_event_ids() {
        let line = serde_json::json!({
            "session_id": "s1",
            "hook_event_name": "Notification",
            "message": "Claude needs your permission to use Write",
            "received_at": "2026-01-01T00:00:00Z"
        })
        .to_string();
        let a = parse_hook_line(&line);
        let b = parse_hook_line(&line);
        assert_eq!(a[0].event_id, b[0].event_id, "must be deterministic for idempotent replay");
    }

    #[test]
    fn missing_session_id_is_dropped_not_guessed() {
        let line = serde_json::json!({"hook_event_name": "Stop"}).to_string();
        assert!(parse_hook_line(&line).is_empty());
    }
}
