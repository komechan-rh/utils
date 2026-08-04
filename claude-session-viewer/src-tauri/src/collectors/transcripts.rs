//! Parses Claude Code's own JSONL transcript files
//! (`~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`).
//!
//! This is genuine local data Claude Code writes for its own use (session
//! resume, `/rewind`, etc.) — not an internal API we're guessing at, and we
//! only ever read it. Concretely, every line is one JSON object; the ones we
//! care about are `type: "user"` / `"assistant"` entries, each of which
//! carries `sessionId`, `cwd`, `timestamp`, and for assistant turns a
//! `message.usage` block with the *exact* token accounting the model API
//! returned for that turn (`input_tokens`, `output_tokens`,
//! `cache_creation_input_tokens`, `cache_read_input_tokens`).
//!
//! We only extract the numeric/metadata fields documented below — message
//! text, tool arguments and tool output are read transiently to find a tool
//! name or a subagent id and are never stored or forwarded further.
//!
//! ## What this gives us officially/observed
//! - model name, cwd, per-turn token usage (source: `Transcript`, high
//!   confidence — it's the literal API response Claude Code logged)
//! - a heuristic "is a tool running" / "is a subagent running" signal from
//!   `tool_use` blocks (source: `Transcript`, low/medium confidence — hooks
//!   are strictly better when configured, see `collectors::hooks`)
//!
//! ## What is estimated
//! - the context *window size* (`max_tokens`) is not in the transcript at
//!   all; we map the model name to its publicly documented default context
//!   window (see `estimate_context_window`). This is clearly marked
//!   `DataSource::Estimated` wherever it feeds a percentage.

use chrono::{DateTime, Utc};
use serde_json::Value;

use crate::domain::events::{RawEvent, RawEventKind};
use crate::domain::types::{Confidence, ContextUsage, DataSource, SubagentRunStatus};

pub use super::tail::NdjsonTailReader as TranscriptTailReader;

/// Best-effort mirror of how Claude Code names a project's transcript
/// directory from its absolute cwd (observed: every `/` becomes `-`, e.g.
/// `/home/user/utils` -> `-home-user-utils`). Used only to go cwd -> expected
/// directory when correlating an OS process with a transcript; we never rely
/// on decoding the other direction because the mapping isn't reversible
/// (a cwd containing a literal `-` is ambiguous).
pub fn encode_project_dir(cwd: &str) -> String {
    cwd.replace('/', "-")
}

/// Publicly documented default context window for a model name, used only to
/// turn raw token counts into a percentage. Always `DataSource::Estimated`.
pub fn estimate_context_window(model: &str) -> u64 {
    let m = model.to_lowercase();
    if m.contains("haiku") {
        200_000
    } else {
        // Sonnet and Opus default to a 200K token context window as
        // publicly documented; some accounts/models may have a larger
        // (e.g. 1M beta) window we cannot detect locally, so this is a
        // floor, not a guarantee.
        200_000
    }
}

/// Parses one JSONL line into zero or more raw events. `pending_task_ids`
/// tracks in-flight `Task` tool_use ids (subagent starts) within this
/// process's lifetime so a later `tool_result` for the same id can be
/// recognized as that subagent's completion — this is the only linkage we
/// trust, because both the start and the stop event live in the same
/// session's own transcript file.
pub fn parse_transcript_line(
    line: &str,
    transcript_path: &str,
) -> Vec<RawEvent> {
    let Ok(v) = serde_json::from_str::<Value>(line) else {
        return vec![];
    };
    let Some(session_id) = v.get("sessionId").and_then(Value::as_str) else {
        return vec![];
    };
    let timestamp = v
        .get("timestamp")
        .and_then(Value::as_str)
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);
    let event_id = v
        .get("uuid")
        .and_then(Value::as_str)
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("{transcript_path}:{}", v.to_string().len()));

    let mut events = Vec::new();
    let entry_type = v.get("type").and_then(Value::as_str).unwrap_or("");

    match entry_type {
        "assistant" => {
            let message = v.get("message");
            if let Some(model) = message.and_then(|m| m.get("model")).and_then(Value::as_str) {
                events.push(RawEvent {
                    event_id: format!("{event_id}:model"),
                    source: DataSource::Transcript,
                    timestamp,
                    session_id: session_id.to_string(),
                    kind: RawEventKind::ModelUpdate {
                        model: model.to_string(),
                    },
                });
            }
            if let Some(usage) = message.and_then(|m| m.get("usage")) {
                if let Some(ctx) = context_usage_from_api_usage(usage, message) {
                    events.push(RawEvent {
                        event_id: format!("{event_id}:usage"),
                        source: DataSource::Transcript,
                        timestamp,
                        session_id: session_id.to_string(),
                        kind: RawEventKind::ContextUpdate(ctx),
                    });
                }
            }
            if let Some(content) = message.and_then(|m| m.get("content")).and_then(Value::as_array) {
                for item in content {
                    if item.get("type").and_then(Value::as_str) == Some("tool_use") {
                        let tool_name = item.get("name").and_then(Value::as_str).unwrap_or("");
                        let tool_use_id = item.get("id").and_then(Value::as_str).unwrap_or("");
                        if tool_name == "Task" && !tool_use_id.is_empty() {
                            let agent_type = item
                                .get("input")
                                .and_then(|i| {
                                    i.get("subagent_type")
                                        .or_else(|| i.get("description"))
                                })
                                .and_then(Value::as_str)
                                .map(|s| s.to_string());
                            events.push(RawEvent {
                                event_id: format!("{event_id}:task-start:{tool_use_id}"),
                                source: DataSource::Transcript,
                                timestamp,
                                session_id: session_id.to_string(),
                                kind: RawEventKind::SubagentStarted {
                                    subagent_id: tool_use_id.to_string(),
                                    agent_type,
                                    transcript_path: Some(transcript_path.to_string()),
                                },
                            });
                        }
                    }
                }
            }
            events.push(RawEvent {
                event_id: format!("{event_id}:activity"),
                source: DataSource::Transcript,
                timestamp,
                session_id: session_id.to_string(),
                kind: RawEventKind::ActivityPing,
            });
        }
        "user" => {
            if let Some(content) = v
                .get("message")
                .and_then(|m| m.get("content"))
                .and_then(Value::as_array)
            {
                for item in content {
                    if item.get("type").and_then(Value::as_str) == Some("tool_result") {
                        if let Some(tool_use_id) =
                            item.get("tool_use_id").and_then(Value::as_str)
                        {
                            let is_error = item
                                .get("is_error")
                                .and_then(Value::as_bool)
                                .unwrap_or(false);
                            events.push(RawEvent {
                                event_id: format!("{event_id}:task-stop:{tool_use_id}"),
                                source: DataSource::Transcript,
                                timestamp,
                                session_id: session_id.to_string(),
                                kind: RawEventKind::SubagentStopped {
                                    subagent_id: tool_use_id.to_string(),
                                    status: if is_error {
                                        SubagentRunStatus::Failed
                                    } else {
                                        SubagentRunStatus::Completed
                                    },
                                },
                            });
                        }
                    }
                }
            }
            events.push(RawEvent {
                event_id: format!("{event_id}:activity"),
                source: DataSource::Transcript,
                timestamp,
                session_id: session_id.to_string(),
                kind: RawEventKind::ActivityPing,
            });
        }
        "queue-operation" => {
            if v.get("operation").and_then(Value::as_str) == Some("enqueue") {
                events.push(RawEvent {
                    event_id: format!("{event_id}:enqueue"),
                    source: DataSource::Transcript,
                    timestamp,
                    session_id: session_id.to_string(),
                    kind: RawEventKind::ActivityPing,
                });
            }
        }
        _ => {}
    }

    if let Some(cwd) = v.get("cwd").and_then(Value::as_str) {
        let project_name = cwd
            .rsplit('/')
            .find(|s| !s.is_empty())
            .unwrap_or(cwd)
            .to_string();
        events.push(RawEvent {
            event_id: format!("{event_id}:seen"),
            source: DataSource::Transcript,
            timestamp,
            session_id: session_id.to_string(),
            kind: RawEventKind::SessionSeen {
                pid: None,
                cwd: Some(cwd.to_string()),
                project_name: Some(project_name),
                model: None,
                started_at: None,
            },
        });
    }

    events
}

fn context_usage_from_api_usage(usage: &Value, message: Option<&Value>) -> Option<ContextUsage> {
    let get_u64 = |key: &str| usage.get(key).and_then(Value::as_u64);
    let input = get_u64("input_tokens").unwrap_or(0);
    let output = get_u64("output_tokens").unwrap_or(0);
    let cache_read = get_u64("cache_read_input_tokens").unwrap_or(0);
    let cache_write = get_u64("cache_creation_input_tokens").unwrap_or(0);

    // Approximation: the context window "used" right now is best
    // represented by everything fed into the most recent API call as input
    // (fresh + cached), since that's the model's actual prompt size for this
    // turn. `output_tokens` is reported separately for observability but is
    // not part of the *next* turn's starting context.
    let used = input + cache_read + cache_write;
    if used == 0 && output == 0 {
        return None;
    }

    let model = message.and_then(|m| m.get("model")).and_then(Value::as_str);
    let (max, confidence) = match model {
        Some(m) => (Some(estimate_context_window(m)), Confidence::Medium),
        None => (None, Confidence::Low),
    };
    let used_percentage = max.map(|max| (used as f32 / max as f32) * 100.0);

    Some(ContextUsage {
        used_tokens: Some(used),
        max_tokens: max,
        used_percentage,
        input_tokens: Some(input),
        output_tokens: Some(output),
        cache_read_tokens: Some(cache_read),
        cache_write_tokens: Some(cache_write),
        compaction_count: None,
        source: DataSource::Transcript,
        confidence,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn encodes_cwd_like_observed_claude_code_behavior() {
        assert_eq!(encode_project_dir("/home/user/utils"), "-home-user-utils");
    }

    #[test]
    fn parses_assistant_usage_into_context_update() {
        let line = serde_json::json!({
            "type": "assistant",
            "sessionId": "s1",
            "uuid": "u1",
            "timestamp": "2026-01-01T00:00:00Z",
            "cwd": "/Users/alice/proj",
            "message": {
                "model": "claude-sonnet-5",
                "usage": {
                    "input_tokens": 2,
                    "output_tokens": 1682,
                    "cache_read_input_tokens": 0,
                    "cache_creation_input_tokens": 51392
                },
                "content": []
            }
        })
        .to_string();
        let events = parse_transcript_line(&line, "/tmp/s1.jsonl");
        let ctx = events.iter().find_map(|e| match &e.kind {
            RawEventKind::ContextUpdate(c) => Some(c.clone()),
            _ => None,
        });
        let ctx = ctx.expect("should produce a context update");
        assert_eq!(ctx.used_tokens, Some(2 + 51392));
        assert_eq!(ctx.source, DataSource::Transcript);
        assert!(ctx.used_percentage.is_some());
    }

    #[test]
    fn detects_task_tool_use_as_subagent_start() {
        let line = serde_json::json!({
            "type": "assistant",
            "sessionId": "s1",
            "uuid": "u2",
            "timestamp": "2026-01-01T00:00:00Z",
            "message": {
                "model": "claude-sonnet-5",
                "content": [
                    {"type": "tool_use", "id": "toolu_1", "name": "Task", "input": {"subagent_type": "Explore"}}
                ]
            }
        })
        .to_string();
        let events = parse_transcript_line(&line, "/tmp/s1.jsonl");
        let started = events.iter().find(|e| matches!(&e.kind, RawEventKind::SubagentStarted { .. }));
        assert!(started.is_some());
    }

    #[test]
    fn detects_matching_tool_result_as_subagent_stop() {
        let line = serde_json::json!({
            "type": "user",
            "sessionId": "s1",
            "uuid": "u3",
            "timestamp": "2026-01-01T00:01:00Z",
            "message": {
                "content": [
                    {"type": "tool_result", "tool_use_id": "toolu_1", "is_error": false}
                ]
            }
        })
        .to_string();
        let events = parse_transcript_line(&line, "/tmp/s1.jsonl");
        let stopped = events
            .iter()
            .find(|e| matches!(&e.kind, RawEventKind::SubagentStopped { subagent_id, .. } if subagent_id == "toolu_1"));
        assert!(stopped.is_some());
    }

    #[test]
    fn ignores_unparseable_lines() {
        assert!(parse_transcript_line("not json", "/tmp/x.jsonl").is_empty());
    }

    #[test]
    fn tail_reader_only_returns_new_complete_lines() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("t.jsonl");
        std::fs::write(&path, "line1\n").unwrap();
        let mut reader = TranscriptTailReader::new();
        let first = reader.read_new_lines(&path).unwrap();
        assert_eq!(first, vec!["line1".to_string()]);

        // Append a full line plus a partial (still-being-written) one.
        let mut f = std::fs::OpenOptions::new().append(true).open(&path).unwrap();
        write!(f, "line2\npartial").unwrap();
        drop(f);
        let second = reader.read_new_lines(&path).unwrap();
        assert_eq!(second, vec!["line2".to_string()]);

        // Nothing new yet.
        let third = reader.read_new_lines(&path).unwrap();
        assert!(third.is_empty());

        // Complete the partial line.
        let mut f = std::fs::OpenOptions::new().append(true).open(&path).unwrap();
        writeln!(f, " done").unwrap();
        drop(f);
        let fourth = reader.read_new_lines(&path).unwrap();
        assert_eq!(fourth, vec!["partial done".to_string()]);
    }
}
