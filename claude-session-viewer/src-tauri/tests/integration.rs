//! Integration tests exercising the collector -> merge -> storage pipeline
//! end to end, using real files on disk (no mocked I/O), the way the app
//! actually behaves — just without a running Tauri window.

use std::fs;
use std::io::Write;

use chrono::Utc;
use claude_session_viewer_lib::collectors::tail::NdjsonTailReader;
use claude_session_viewer_lib::collectors::{hooks, processes, transcripts};
use claude_session_viewer_lib::domain::merge::SessionStore;
use claude_session_viewer_lib::domain::types::SessionStatus;
use claude_session_viewer_lib::storage::Database;

#[test]
fn hook_events_written_to_disk_are_reflected_in_session_state() {
    let dir = tempfile::tempdir().unwrap();
    let log_path = dir.path().join("hooks.ndjson");
    fs::write(
        &log_path,
        format!(
            "{}\n",
            serde_json::json!({
                "hook_event_name": "PreToolUse",
                "session_id": "s1",
                "cwd": "/Users/demo/proj",
                "tool_name": "Bash",
                "received_at": "2026-01-01T00:00:00Z"
            })
        ),
    )
    .unwrap();

    let mut tail = NdjsonTailReader::new();
    let mut store = SessionStore::new();
    for line in tail.read_new_lines(&log_path).unwrap() {
        for event in hooks::parse_hook_line(&line) {
            store.apply(event);
        }
    }

    let session = store.get("s1").expect("session should now exist");
    assert_eq!(session.status, SessionStatus::UsingTool);
    assert_eq!(session.cwd.as_deref(), Some("/Users/demo/proj"));
}

#[test]
fn appending_to_a_transcript_file_is_picked_up_incrementally() {
    let dir = tempfile::tempdir().unwrap();
    let transcript_path = dir.path().join("session.jsonl");
    let mut file = fs::File::create(&transcript_path).unwrap();

    let line = |tokens: u64| {
        serde_json::json!({
            "type": "assistant",
            "sessionId": "s1",
            "uuid": uuid::Uuid::new_v4().to_string(),
            "timestamp": "2026-01-01T00:00:00Z",
            "cwd": "/Users/demo/proj",
            "message": {
                "model": "claude-sonnet-5",
                "usage": {"input_tokens": tokens, "output_tokens": 10, "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0},
                "content": []
            }
        })
        .to_string()
    };

    writeln!(file, "{}", line(1000)).unwrap();
    let mut tail = NdjsonTailReader::new();
    let mut store = SessionStore::new();
    let transcript_path_str = transcript_path.to_string_lossy().to_string();

    for l in tail.read_new_lines(&transcript_path).unwrap() {
        for event in transcripts::parse_transcript_line(&l, &transcript_path_str) {
            store.apply(event);
        }
    }
    let first_used = store.get("s1").unwrap().context.unwrap().used_tokens;
    assert_eq!(first_used, Some(1000));

    // No new lines yet -> no new events.
    assert!(tail.read_new_lines(&transcript_path).unwrap().is_empty());

    writeln!(file, "{}", line(5000)).unwrap();
    let mut new_lines = 0;
    for l in tail.read_new_lines(&transcript_path).unwrap() {
        new_lines += 1;
        for event in transcripts::parse_transcript_line(&l, &transcript_path_str) {
            store.apply(event);
        }
    }
    assert_eq!(new_lines, 1, "only the newly appended line should be read");
    let second_used = store.get("s1").unwrap().context.unwrap().used_tokens;
    assert_eq!(second_used, Some(5000));
}

#[test]
fn a_hand_built_process_list_produces_a_session_without_calling_the_real_os() {
    let dir = tempfile::tempdir().unwrap();
    let detected = vec![processes::DetectedProcess {
        pid: 4242,
        ppid: None,
        cwd: Some("/Users/demo/my-app".into()),
        started_at_unix: 1_700_000_000,
    }];

    let mut store = SessionStore::new();
    for event in processes::events_from_processes(&detected, dir.path(), Utc::now()) {
        store.apply(event);
    }

    let sessions = store.all_sessions();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].pid, Some(4242));
    assert_eq!(sessions[0].project_name, "my-app");
}

#[test]
fn state_survives_a_simulated_app_restart_via_sqlite() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("sessions.sqlite3");

    // "Run 1": build up some state and persist it, as the flush timer would.
    {
        let mut store = SessionStore::new();
        for event in hooks::parse_hook_line(
            &serde_json::json!({
                "hook_event_name": "Stop",
                "session_id": "s1",
                "cwd": "/Users/demo/proj",
                "received_at": "2026-01-01T00:00:00Z"
            })
            .to_string(),
        ) {
            store.apply(event);
        }
        let mut db = Database::open(&db_path).unwrap();
        db.persist_snapshot(&store.all_sessions()).unwrap();
        db.record_processed_events(&[("evt-1".to_string(), "official_hook".to_string())])
            .unwrap();
    }

    // "Run 2": a fresh process opens the same database file.
    {
        let db = Database::open(&db_path).unwrap();
        let restored = db.load_snapshot().unwrap();
        assert_eq!(restored.len(), 1);
        assert_eq!(restored[0].id, "s1");
        assert_eq!(restored[0].status, SessionStatus::WaitingUser);

        let ids = db.load_recent_processed_event_ids(10).unwrap();
        assert_eq!(ids, vec!["evt-1".to_string()]);
    }
}
