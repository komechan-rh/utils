//! Wires the collectors, the merge engine, and storage together, and owns
//! the background thread that keeps everything up to date. This is the only
//! module allowed to know about all the other layers at once; commands and
//! collectors themselves stay decoupled from each other.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use chrono::Utc;
use notify::RecursiveMode;
use tauri::{AppHandle, Emitter};

use crate::claude_config;
use crate::collectors::{filesystem, hooks, processes, status_line, tail::NdjsonTailReader, transcripts};
use crate::domain::events::{RawEvent, RawEventKind};
use crate::domain::merge::SessionStore;
use crate::domain::types::{ClaudeSession, DataSource, RateLimitState};
use crate::notifications::{Deduplicator, NotificationKind, NotificationSettings};
use crate::storage::Database;

const PROCESS_POLL_INTERVAL: Duration = Duration::from_secs(5);
const SWEEP_INTERVAL: Duration = Duration::from_secs(15);
const DB_FLUSH_INTERVAL: Duration = Duration::from_secs(10);
const FS_DRAIN_TIMEOUT: Duration = Duration::from_millis(1000);
const STALE_AFTER: chrono::Duration = chrono::Duration::minutes(10);
const DEAD_AFTER: chrono::Duration = chrono::Duration::hours(6);

pub struct AppPaths {
    pub app_data_dir: PathBuf,
    pub claude_home: PathBuf,
}

impl AppPaths {
    pub fn claude_projects_dir(&self) -> PathBuf {
        self.claude_home.join("projects")
    }
    pub fn claude_settings_path(&self) -> PathBuf {
        self.claude_home.join("settings.json")
    }
    pub fn hooks_log(&self) -> PathBuf {
        self.app_data_dir.join("hooks.ndjson")
    }
    pub fn status_line_log(&self) -> PathBuf {
        self.app_data_dir.join("statusline.ndjson")
    }
}

pub struct AppStateInner {
    pub store: Mutex<SessionStore>,
    pub db: Mutex<Database>,
    pub dedup: Mutex<Deduplicator>,
    pub notification_settings: Mutex<NotificationSettings>,
    pub paths: AppPaths,
    pub rate_limits: Mutex<RateLimitState>,
    pub history_enabled: Mutex<bool>,
}

pub type AppState = Arc<AppStateInner>;

pub fn init_state(app_data_dir: PathBuf, claude_home: PathBuf) -> AppState {
    let db_path = crate::storage::default_db_path(&app_data_dir);
    let db = Database::open(&db_path).expect("failed to open local sqlite database");
    let mut store = SessionStore::new();

    let history_enabled = db
        .get_setting("history_enabled")
        .ok()
        .flatten()
        .map(|v| v != "false")
        .unwrap_or(true);

    if history_enabled {
        if let Ok(sessions) = db.load_snapshot() {
            // Restored sessions are marked stale-eligible immediately; the
            // next process/transcript scan will confirm which are still
            // alive and clear staleness, and sweep_dead will retire the
            // rest. This is what "アプリ再起動後に状態を復元できる" means in
            // practice: we show last-known state right away rather than an
            // empty list, then reconcile against reality within one poll
            // cycle.
            for s in sessions {
                seed_session(&mut store, s);
            }
        }
        if let Ok(ids) = db.load_recent_processed_event_ids(20_000) {
            store.seed_processed_event_ids(ids);
        }
    }

    Arc::new(AppStateInner {
        store: Mutex::new(store),
        db: Mutex::new(db),
        dedup: Mutex::new(Deduplicator::new()),
        notification_settings: Mutex::new(NotificationSettings::default_conservative()),
        paths: AppPaths {
            app_data_dir,
            claude_home,
        },
        rate_limits: Mutex::new(RateLimitState::unavailable(
            "Claude Code / Claude.ai の利用制限をローカルかつオフラインで取得できる公式な方法が確認できていないため非表示です。詳細は README の「rate limit表示」を参照してください。",
        )),
        history_enabled: Mutex::new(history_enabled),
    })
}

fn seed_session(store: &mut SessionStore, session: ClaudeSession) {
    // Re-inject a restored session as a single SessionSeen + StatusUpdate
    // pair sourced as `Filesystem` (it came from our own on-disk snapshot,
    // not a fresh live observation) so any live source can freely override
    // it once real events start flowing again.
    let now = Utc::now();
    store.apply(RawEvent {
        event_id: format!("restore:{}:{}", session.id, now.timestamp_millis()),
        source: DataSource::Filesystem,
        timestamp: session
            .last_activity_at
            .as_deref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or(now),
        session_id: session.id.clone(),
        kind: RawEventKind::SessionSeen {
            pid: session.pid,
            cwd: session.cwd.clone(),
            project_name: Some(session.project_name.clone()),
            model: session.model.clone(),
            started_at: session
                .started_at
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|d| d.with_timezone(&Utc)),
        },
    });
}

pub fn spawn_background_workers(app: AppHandle, state: AppState) {
    let _ = claude_config::install_relay_scripts(&state.paths.app_data_dir);

    std::thread::spawn(move || run_loop(app, state));
}

fn run_loop(app: AppHandle, state: AppState) {
    let watch_targets = vec![
        (state.paths.claude_projects_dir(), RecursiveMode::Recursive),
        (state.paths.app_data_dir.clone(), RecursiveMode::NonRecursive),
    ];
    let watcher = filesystem::watch_paths(&watch_targets).ok();

    let mut transcript_tail = NdjsonTailReader::new();
    let mut hooks_tail = NdjsonTailReader::new();
    let mut status_tail = NdjsonTailReader::new();

    let mut last_process_poll = Instant::now() - PROCESS_POLL_INTERVAL;
    let mut last_sweep = Instant::now() - SWEEP_INTERVAL;
    let mut last_flush = Instant::now() - DB_FLUSH_INTERVAL;

    // First pass immediately so the UI isn't empty on launch.
    poll_processes(&state, &mut last_process_poll, true);
    if let Ok(entries) = std::fs::read_dir(state.paths.claude_projects_dir()) {
        for entry in entries.flatten() {
            scan_dir_for_jsonl(&entry.path(), &mut transcript_tail, &state);
        }
    }
    emit_snapshot(&app, &state);

    loop {
        let changed = watcher
            .as_ref()
            .map(|w| filesystem::drain_with_timeout(&w.changes, FS_DRAIN_TIMEOUT))
            .unwrap_or_default();
        if changed.is_empty() {
            std::thread::sleep(FS_DRAIN_TIMEOUT.min(Duration::from_millis(200)));
        }

        let mut dirty = false;
        for path in &changed {
            if path == &state.paths.hooks_log() {
                dirty |= consume_ndjson(&mut hooks_tail, path, &state, hooks::parse_hook_line);
            } else if path == &state.paths.status_line_log() {
                dirty |= consume_ndjson(&mut status_tail, path, &state, status_line::parse_status_line_entry);
            } else if filesystem::is_jsonl(path) {
                let transcript_path = path.to_string_lossy().to_string();
                dirty |= consume_ndjson(&mut transcript_tail, path, &state, move |line| {
                    transcripts::parse_transcript_line(line, &transcript_path)
                });
            } else if path.is_dir() || path.extension().is_none() {
                scan_dir_for_jsonl(path, &mut transcript_tail, &state);
            }
        }

        if last_process_poll.elapsed() >= PROCESS_POLL_INTERVAL {
            dirty |= poll_processes(&state, &mut last_process_poll, false);
        }
        if last_sweep.elapsed() >= SWEEP_INTERVAL {
            dirty |= sweep(&state);
            last_sweep = Instant::now();
        }
        if last_flush.elapsed() >= DB_FLUSH_INTERVAL {
            flush_db(&state);
            last_flush = Instant::now();
        }

        if dirty {
            dispatch_notifications(&app, &state);
            emit_snapshot(&app, &state);
        }
    }
}

fn scan_dir_for_jsonl(dir: &Path, tail: &mut NdjsonTailReader, state: &AppState) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if filesystem::is_jsonl(&path) {
            let transcript_path = path.to_string_lossy().to_string();
            consume_ndjson(tail, &path, state, move |line| {
                transcripts::parse_transcript_line(line, &transcript_path)
            });
        }
    }
}

fn consume_ndjson(
    tail: &mut NdjsonTailReader,
    path: &Path,
    state: &AppState,
    parse: impl Fn(&str) -> Vec<RawEvent>,
) -> bool {
    let Ok(lines) = tail.read_new_lines(path) else { return false };
    let mut dirty = false;
    let mut store = state.store.lock().unwrap();
    for line in lines {
        for event in parse(&line) {
            if store.apply(event).is_some() {
                dirty = true;
            }
        }
    }
    dirty
}

fn poll_processes(state: &AppState, last_poll: &mut Instant, _first: bool) -> bool {
    *last_poll = Instant::now();
    let detected = processes::detect_claude_processes();
    let projects_dir = state.paths.claude_projects_dir();
    let now = Utc::now();
    let mut dirty = false;
    let mut store = state.store.lock().unwrap();
    for event in processes::events_from_processes(&detected, &projects_dir, now) {
        if store.apply(event).is_some() {
            dirty = true;
        }
    }

    // Confirm previously-seen processes are still alive; mark gone ones
    // stopped immediately rather than waiting for the staleness sweep,
    // since "the process exited" is a certain fact, not an inference.
    for session in store.all_sessions() {
        if let Some(pid) = session.pid {
            let still_tracked = detected
                .iter()
                .any(|p| p.pid == pid && session.id == processes::resolve_session_id(p, &projects_dir));
            if !still_tracked
                && !matches!(session.status, crate::domain::types::SessionStatus::Stopped)
                && detected.iter().all(|p| p.pid != pid)
                && store.mark_process_gone(&session.id, now)
            {
                dirty = true;
            }
        }
    }

    dirty
}

fn sweep(state: &AppState) -> bool {
    let now = Utc::now();
    let mut store = state.store.lock().unwrap();
    let a = store.sweep_stale(now, STALE_AFTER);
    let b = store.sweep_dead(now, DEAD_AFTER);
    !a.is_empty() || !b.is_empty()
}

fn flush_db(state: &AppState) {
    let history_enabled = *state.history_enabled.lock().unwrap();
    if !history_enabled {
        return;
    }
    let sessions = state.store.lock().unwrap().all_sessions();
    if let Ok(mut db) = state.db.lock() {
        let _ = db.persist_snapshot(&sessions);
    }
}

fn emit_snapshot(app: &AppHandle, state: &AppState) {
    let sessions = state.store.lock().unwrap().all_sessions();
    let _ = app.emit("sessions-updated", &sessions);
    update_tray(app, &sessions);
}

fn update_tray(app: &AppHandle, sessions: &[ClaudeSession]) {
    use crate::domain::types::SessionStatus;
    let running = sessions
        .iter()
        .filter(|s| !matches!(s.status, SessionStatus::Stopped) && !s.is_stale)
        .count();
    let waiting_permission = sessions
        .iter()
        .any(|s| matches!(s.status, SessionStatus::WaitingPermission));
    let title = if running == 0 {
        String::new()
    } else if waiting_permission {
        format!("Claude {running} \u{26A0}") // warning sign
    } else {
        format!("Claude {running}")
    };
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_title(Some(title));
    }
}

fn dispatch_notifications(app: &AppHandle, state: &AppState) {
    use crate::domain::types::SessionStatus;
    use tauri_plugin_notification::NotificationExt;

    let sessions = state.store.lock().unwrap().all_sessions();
    let settings = *state.notification_settings.lock().unwrap();
    let mut dedup = state.dedup.lock().unwrap();

    for session in &sessions {
        if matches!(session.status, SessionStatus::WaitingPermission) {
            if crate::notifications::should_fire(
                &settings,
                &mut dedup,
                &session.id,
                NotificationKind::WaitingPermission,
                "waiting",
            ) {
                let _ = app
                    .notification()
                    .builder()
                    .title("Claude Code: permission待ち")
                    .body(format!("{} が権限確認待ちです", session.project_name))
                    .show();
            }
        } else {
            dedup.clear(&session.id, NotificationKind::WaitingPermission);
        }

        if session.is_stale {
            if crate::notifications::should_fire(
                &settings,
                &mut dedup,
                &session.id,
                NotificationKind::StalledSession,
                "stalled",
            ) {
                let _ = app
                    .notification()
                    .builder()
                    .title("Claude Code: セッションが停止している可能性")
                    .body(format!("{} でしばらく活動が確認できません", session.project_name))
                    .show();
            }
        } else {
            dedup.clear(&session.id, NotificationKind::StalledSession);
        }

        for sub in &session.subagents {
            if matches!(sub.status, crate::domain::types::SubagentRunStatus::Completed)
                && crate::notifications::should_fire(
                    &settings,
                    &mut dedup,
                    &sub.id,
                    NotificationKind::SubagentCompleted,
                    "completed",
                ) {
                    let _ = app
                        .notification()
                        .builder()
                        .title("Claude Code: サブエージェント完了")
                        .body(format!(
                            "{} ({})",
                            sub.agent_type.clone().unwrap_or_else(|| "subagent".into()),
                            session.project_name
                        ))
                        .show();
                }
        }
    }
}
