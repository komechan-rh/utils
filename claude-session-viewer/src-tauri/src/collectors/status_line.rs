//! Parses events written by our installed `statusLine` command.
//!
//! Claude Code's `statusLine` setting runs a command repeatedly (roughly
//! once per UI redraw) and feeds it a JSON object on stdin describing the
//! current session — documented fields include at least `session_id`,
//! `transcript_path`, `cwd`, `model.display_name`, and `version`; some
//! Claude Code versions additionally include a `cost` block and an
//! `exceeds_200k_tokens` flag. The command's stdout is what gets displayed
//! in the terminal's status line.
//!
//! Our installed script (see `scripts/status-line.sh`) does both jobs: it
//! prints a plain-text status line for Claude Code to display, *and* it
//! appends the same JSON payload (plus a `received_at` timestamp) as one
//! line to `<app data dir>/statusline.ndjson`, which this module tails.
//!
//! Because the exact optional fields vary by Claude Code version, every
//! field below except `session_id` is read defensively and simply omitted
//! from the resulting event if absent — we never fabricate a value.

use chrono::{DateTime, Utc};
use serde_json::Value;

use crate::domain::events::{RawEvent, RawEventKind};
use crate::domain::types::DataSource;

pub fn parse_status_line_entry(line: &str) -> Vec<RawEvent> {
    let Ok(v) = serde_json::from_str::<Value>(line) else {
        return vec![];
    };
    let Some(session_id) = v.get("session_id").and_then(Value::as_str) else {
        return vec![];
    };
    let observed_at = v
        .get("received_at")
        .and_then(Value::as_str)
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    let mut events = Vec::new();

    let model = v
        .get("model")
        .and_then(|m| m.get("display_name").or_else(|| m.get("id")))
        .and_then(Value::as_str)
        .map(|s| s.to_string());
    let cwd = v
        .get("cwd")
        .or_else(|| v.get("workspace").and_then(|w| w.get("current_dir")))
        .and_then(Value::as_str)
        .map(|s| s.to_string());
    let project_name = cwd
        .as_deref()
        .and_then(|c| c.rsplit('/').find(|s| !s.is_empty()).map(|s| s.to_string()));

    if model.is_some() || cwd.is_some() {
        events.push(RawEvent {
            event_id: format!("{session_id}:{}:statusline-seen", observed_at.timestamp_millis()),
            source: DataSource::StatusLine,
            timestamp: observed_at,
            session_id: session_id.to_string(),
            kind: RawEventKind::SessionSeen {
                pid: None,
                cwd,
                project_name,
                model,
                started_at: None,
            },
        });
    }

    events.push(RawEvent {
        event_id: format!("{session_id}:{}:statusline-activity", observed_at.timestamp_millis()),
        source: DataSource::StatusLine,
        timestamp: observed_at,
        session_id: session_id.to_string(),
        kind: RawEventKind::ActivityPing,
    });

    events
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_model_and_cwd_when_present() {
        let line = serde_json::json!({
            "session_id": "s1",
            "model": {"display_name": "Sonnet 5", "id": "claude-sonnet-5"},
            "cwd": "/Users/alice/proj",
            "received_at": "2026-01-01T00:00:00Z"
        })
        .to_string();
        let events = parse_status_line_entry(&line);
        assert!(events
            .iter()
            .any(|e| matches!(&e.kind, RawEventKind::SessionSeen { model: Some(m), .. } if m == "Sonnet 5")));
    }

    #[test]
    fn tolerates_missing_optional_fields() {
        let line = serde_json::json!({"session_id": "s1", "received_at": "2026-01-01T00:00:00Z"}).to_string();
        let events = parse_status_line_entry(&line);
        assert_eq!(events.len(), 1, "only the activity ping, nothing fabricated");
    }
}
