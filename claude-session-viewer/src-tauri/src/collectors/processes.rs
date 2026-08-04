//! OS process detection (source: `DataSource::Process`).
//!
//! We deliberately do NOT shell out to `ps`/`lsof` and parse text: that path
//! requires string-splitting untrusted process command lines and is easy to
//! get subtly wrong or, worse, tempts string-concatenation into a shell
//! command later. Instead we use the `sysinfo` crate, which reads process
//! tables directly (via macOS `libproc`/`sysctl` under the hood, `/proc` on
//! Linux) with no shell involved and no argument-injection surface.
//!
//! Identification is intentionally conservative: matching only on "the
//! process name contains 'claude'" would also catch unrelated tools (a
//! project called `claude-utils`, an editor plugin process, etc). We require
//! the executable's *basename* to be exactly `claude` (the real Claude Code
//! CLI binary name), and we exclude our own process.
//!
//! What we can't do from here alone: know a process's Claude Code session
//! id, its model, or its conversational status. Those require correlating
//! with the transcript file(s) under `~/.claude/projects/**` (see
//! `collectors::transcripts::encode_project_dir`), which is best-effort and
//! only works when exactly one session's declared cwd matches the process's
//! cwd.

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chrono::{DateTime, Utc};
use sysinfo::{Pid, System};

use crate::collectors::{filesystem, transcripts};
use crate::domain::events::{RawEvent, RawEventKind};
use crate::domain::types::DataSource;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectedProcess {
    pub pid: u32,
    pub ppid: Option<u32>,
    pub cwd: Option<String>,
    /// Process start time, seconds since Unix epoch. Combined with `pid`
    /// this forms a collision-resistant synthetic id (`proc:<pid>:<start>`)
    /// so PID reuse across process lifetimes is never mistaken for the same
    /// session — see domain::merge's pid-reuse test.
    pub started_at_unix: u64,
}

impl DetectedProcess {
    pub fn synthetic_id(&self) -> String {
        format!("proc:{}:{}", self.pid, self.started_at_unix)
    }
}

fn is_claude_cli_binary(exe: Option<&std::path::Path>, name: &str) -> bool {
    if let Some(exe) = exe {
        if let Some(basename) = exe.file_name().and_then(|s| s.to_str()) {
            return basename == "claude";
        }
    }
    name == "claude"
}

pub fn detect_claude_processes() -> Vec<DetectedProcess> {
    let mut system = System::new();
    system.refresh_all();

    let self_pid = std::process::id();

    system
        .processes()
        .values()
        .filter(|p| p.pid().as_u32() != self_pid)
        .filter(|p| is_claude_cli_binary(p.exe(), &p.name().to_string_lossy()))
        .map(|p| DetectedProcess {
            pid: p.pid().as_u32(),
            ppid: p.parent().map(|pp| pp.as_u32()),
            cwd: p.cwd().map(|c| c.to_string_lossy().to_string()),
            started_at_unix: p.start_time(),
        })
        .collect()
}

/// Confirms whether a previously-seen pid is still alive and, if so, that it
/// is still the *same* process occupying that pid (guarded by start time, to
/// catch PID reuse rather than silently treating a new process as the old
/// session's continuation).
pub fn is_same_process_still_running(pid: u32, expected_start_unix: u64) -> bool {
    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);
    match system.process(Pid::from_u32(pid)) {
        Some(p) => p.start_time() == expected_start_unix,
        None => false,
    }
}

/// Best-effort session id for a detected process: if its cwd matches
/// exactly one transcript directory under `~/.claude/projects`, use that
/// transcript's own session id (so process and transcript data merge into
/// the same session record); otherwise fall back to the PID/start-time
/// synthetic id rather than guessing among several candidates.
pub fn resolve_session_id(proc: &DetectedProcess, projects_dir: &Path) -> String {
    if let Some(cwd) = &proc.cwd {
        let dir = projects_dir.join(transcripts::encode_project_dir(cwd));
        if let Ok(entries) = std::fs::read_dir(&dir) {
            let jsonl: Vec<_> = entries
                .flatten()
                .filter(|e| filesystem::is_jsonl(&e.path()))
                .collect();
            if jsonl.len() == 1 {
                if let Some(stem) = jsonl[0].path().file_stem() {
                    return stem.to_string_lossy().to_string();
                }
            }
        }
    }
    proc.synthetic_id()
}

/// Turns a list of detected processes into `SessionSeen` observations. Pure
/// and side-effect-free (aside from the read-only directory listing in
/// `resolve_session_id`) so it can be exercised in tests with a hand-built
/// process list instead of real OS process enumeration.
pub fn events_from_processes(
    detected: &[DetectedProcess],
    projects_dir: &Path,
    now: DateTime<Utc>,
) -> Vec<RawEvent> {
    detected
        .iter()
        .map(|proc| {
            let session_id = resolve_session_id(proc, projects_dir);
            let project_name = proc
                .cwd
                .as_deref()
                .and_then(|c| c.rsplit('/').find(|s| !s.is_empty()))
                .map(|s| s.to_string());
            RawEvent {
                event_id: format!(
                    "proc-seen:{}:{}:{}",
                    proc.pid,
                    proc.started_at_unix,
                    now.timestamp() / 5
                ),
                source: DataSource::Process,
                timestamp: now,
                session_id,
                kind: RawEventKind::SessionSeen {
                    pid: Some(proc.pid),
                    cwd: proc.cwd.clone(),
                    project_name,
                    model: None,
                    started_at: None,
                },
            }
        })
        .collect()
}

#[allow(dead_code)]
pub fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

#[allow(dead_code)]
pub fn current_exe() -> Option<PathBuf> {
    std::env::current_exe().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_basename_match_only() {
        assert!(is_claude_cli_binary(
            Some(std::path::Path::new("/usr/local/bin/claude")),
            "claude"
        ));
        assert!(!is_claude_cli_binary(
            Some(std::path::Path::new("/usr/local/bin/claude-utils")),
            "claude-utils"
        ));
        assert!(!is_claude_cli_binary(
            Some(std::path::Path::new("/Applications/claude-session-viewer")),
            "claude-session-viewer"
        ));
    }

    #[test]
    fn events_from_processes_generates_a_session_seen_event_per_process() {
        let dir = tempfile::tempdir().unwrap();
        let detected = vec![DetectedProcess {
            pid: 999,
            ppid: None,
            cwd: Some("/Users/demo/some-project".into()),
            started_at_unix: 12345,
        }];
        let now = Utc::now();
        let events = events_from_processes(&detected, dir.path(), now);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].source, DataSource::Process);
        match &events[0].kind {
            RawEventKind::SessionSeen { pid, cwd, project_name, .. } => {
                assert_eq!(*pid, Some(999));
                assert_eq!(cwd.as_deref(), Some("/Users/demo/some-project"));
                assert_eq!(project_name.as_deref(), Some("some-project"));
            }
            other => panic!("expected SessionSeen, got {other:?}"),
        }
    }

    #[test]
    fn resolve_session_id_prefers_the_matching_transcript_session_id() {
        let dir = tempfile::tempdir().unwrap();
        let cwd = "/Users/demo/proj";
        let project_dir = dir.path().join(transcripts::encode_project_dir(cwd));
        std::fs::create_dir_all(&project_dir).unwrap();
        std::fs::write(project_dir.join("abc-session-id.jsonl"), "").unwrap();

        let proc = DetectedProcess {
            pid: 1,
            ppid: None,
            cwd: Some(cwd.into()),
            started_at_unix: 1,
        };
        assert_eq!(resolve_session_id(&proc, dir.path()), "abc-session-id");
    }

    #[test]
    fn resolve_session_id_falls_back_to_synthetic_id_when_ambiguous() {
        let dir = tempfile::tempdir().unwrap();
        let cwd = "/Users/demo/proj";
        let project_dir = dir.path().join(transcripts::encode_project_dir(cwd));
        std::fs::create_dir_all(&project_dir).unwrap();
        std::fs::write(project_dir.join("a.jsonl"), "").unwrap();
        std::fs::write(project_dir.join("b.jsonl"), "").unwrap();

        let proc = DetectedProcess {
            pid: 7,
            ppid: None,
            cwd: Some(cwd.into()),
            started_at_unix: 42,
        };
        assert_eq!(resolve_session_id(&proc, dir.path()), proc.synthetic_id());
    }

    #[test]
    fn synthetic_id_encodes_pid_and_start_time_for_reuse_safety() {
        let a = DetectedProcess {
            pid: 100,
            ppid: None,
            cwd: None,
            started_at_unix: 1000,
        };
        let b = DetectedProcess {
            pid: 100,
            ppid: None,
            cwd: None,
            started_at_unix: 2000,
        };
        assert_ne!(a.synthetic_id(), b.synthetic_id());
    }
}
