//! Filesystem watching. This module only knows "a path changed" — it hands
//! that off to `transcripts`, `hooks`, or `status_line` to actually parse,
//! keeping "notice a change" and "understand a change" separate per the
//! spec's directory layout.
//!
//! Watching (rather than polling every file on an interval) is what keeps
//! idle CPU usage low: `notify` uses the OS's native file event API
//! (FSEvents on macOS) so we do no work at all between real changes.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};

pub struct FsWatcher {
    _watcher: RecommendedWatcher,
    pub changes: Receiver<PathBuf>,
}

/// Watches `paths` (each non-recursively or recursively per caller) and
/// forwards every changed file path on a channel. Errors setting up a
/// individual watch (e.g. a directory that doesn't exist yet, such as
/// `~/.claude/projects` before Claude Code has ever run) are logged and
/// skipped rather than failing the whole app — the polling fallback in
/// `state.rs` still covers that case, just at lower resolution.
pub fn watch_paths(paths: &[(PathBuf, RecursiveMode)]) -> notify::Result<FsWatcher> {
    let (tx, rx) = channel::<PathBuf>();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            for path in event.paths {
                let _ = tx.send(path);
            }
        }
    })?;

    for (path, mode) in paths {
        if !path.exists() {
            tracing::debug!(?path, "watch target does not exist yet, skipping");
            continue;
        }
        if let Err(err) = watcher.watch(path, *mode) {
            tracing::warn!(?path, ?err, "failed to watch path");
        }
    }

    Ok(FsWatcher {
        _watcher: watcher,
        changes: rx,
    })
}

pub fn drain_with_timeout(rx: &Receiver<PathBuf>, timeout: Duration) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(first) = rx.recv_timeout(timeout) {
        out.push(first);
        while let Ok(more) = rx.try_recv() {
            out.push(more);
        }
    }
    out
}

pub fn is_jsonl(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()) == Some("jsonl")
}
