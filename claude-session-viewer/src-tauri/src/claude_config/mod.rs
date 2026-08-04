//! Safely wires Claude Code's hooks + statusLine to our collectors, without
//! ever overwriting the user's existing `~/.claude/settings.json` wholesale.
//!
//! Rules enforced here (per the task's "Claude Code連携" requirements):
//! - back up the existing file before touching it
//! - merge only the specific keys we need, never overwrite the whole file
//! - never remove an existing hook entry that isn't ours
//! - never replace an existing `statusLine` the user already configured
//! - idempotent: running setup twice does not add duplicate hook entries
//! - revertible: `revert` restores the exact pre-setup file (or removes it,
//!   if it did not exist before)

use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde_json::{json, Map, Value};

/// Hook events we register a relay command for. `SubagentStop` is included
/// only as a secondary activity signal — see collectors::hooks doc comment
/// for why we don't use it as the primary subagent-completion source.
pub const HOOK_EVENTS: &[&str] = &[
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "Notification",
    "PreCompact",
    "Stop",
    "SubagentStop",
    "SessionEnd",
];

pub const HOOK_RELAY_SCRIPT: &str = include_str!("../../../scripts/hook-relay.sh");
pub const STATUS_LINE_SCRIPT: &str = include_str!("../../../scripts/status-line.sh");

#[derive(Debug, Default, Clone, serde::Serialize)]
pub struct ApplySummary {
    pub hooks_added: Vec<String>,
    pub hooks_already_present: Vec<String>,
    pub status_line_applied: bool,
    pub status_line_skipped_reason: Option<String>,
    pub backup_path: Option<String>,
    pub changed: bool,
}

fn shell_quote(path: &Path) -> String {
    let s = path.to_string_lossy();
    format!("'{}'", s.replace('\'', "'\\''"))
}

fn relay_command(app_data_dir: &Path, event_name: &str) -> String {
    let script = app_data_dir.join("hook-relay.sh");
    format!("sh {} {}", shell_quote(&script), event_name)
}

fn status_line_command(app_data_dir: &Path) -> String {
    let script = app_data_dir.join("status-line.sh");
    format!("sh {}", shell_quote(&script))
}

/// Writes our relay scripts into `app_data_dir` (idempotent, always
/// refreshed to the version bundled with the running app) and marks them
/// executable.
pub fn install_relay_scripts(app_data_dir: &Path) -> std::io::Result<()> {
    fs::create_dir_all(app_data_dir)?;
    let hook_path = app_data_dir.join("hook-relay.sh");
    let status_path = app_data_dir.join("status-line.sh");
    fs::write(&hook_path, HOOK_RELAY_SCRIPT)?;
    fs::write(&status_path, STATUS_LINE_SCRIPT)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&hook_path, fs::Permissions::from_mode(0o755))?;
        fs::set_permissions(&status_path, fs::Permissions::from_mode(0o755))?;
    }
    Ok(())
}

fn read_settings(path: &Path) -> std::io::Result<Value> {
    match fs::read_to_string(path) {
        Ok(s) if !s.trim().is_empty() => {
            Ok(serde_json::from_str(&s).unwrap_or_else(|_| Value::Object(Map::new())))
        }
        _ => Ok(Value::Object(Map::new())),
    }
}

fn ensure_object(v: &mut Value) -> &mut Map<String, Value> {
    if !v.is_object() {
        *v = Value::Object(Map::new());
    }
    v.as_object_mut().unwrap()
}

/// Adds our command to `settings["hooks"][event]`, appending a new matcher
/// group `{"hooks":[{"type":"command","command": ...}]}` only if no existing
/// group already contains that exact command string.
fn merge_hooks(root: &mut Value, app_data_dir: &Path, summary: &mut ApplySummary) {
    let hooks_obj = ensure_object(root.entry_or_insert("hooks"));
    for event in HOOK_EVENTS {
        let cmd = relay_command(app_data_dir, event);
        let groups = hooks_obj
            .entry(event.to_string())
            .or_insert_with(|| Value::Array(vec![]));
        if !groups.is_array() {
            // Unexpected shape (user hand-edited it into something else) —
            // don't touch it, just skip adding ours for this event.
            continue;
        }
        let already_present = groups.as_array().unwrap().iter().any(|group| {
            group
                .get("hooks")
                .and_then(Value::as_array)
                .map(|hs| {
                    hs.iter()
                        .any(|h| h.get("command").and_then(Value::as_str) == Some(cmd.as_str()))
                })
                .unwrap_or(false)
        });
        if already_present {
            summary.hooks_already_present.push(event.to_string());
            continue;
        }
        groups.as_array_mut().unwrap().push(json!({
            "matcher": "",
            "hooks": [{ "type": "command", "command": cmd }]
        }));
        summary.hooks_added.push(event.to_string());
    }
}

fn merge_status_line(root: &mut Value, app_data_dir: &Path, summary: &mut ApplySummary) {
    let obj = ensure_object(root);
    match obj.get("statusLine") {
        None | Some(Value::Null) => {
            obj.insert(
                "statusLine".to_string(),
                json!({ "type": "command", "command": status_line_command(app_data_dir) }),
            );
            summary.status_line_applied = true;
        }
        Some(_) => {
            summary.status_line_skipped_reason =
                Some("既存の statusLine 設定を上書きしないため未変更".to_string());
        }
    }
}

/// Small helper: `serde_json::Map::entry` for a top-level object value.
trait EntryOrInsert {
    fn entry_or_insert(&mut self, key: &str) -> &mut Value;
}
impl EntryOrInsert for Value {
    fn entry_or_insert(&mut self, key: &str) -> &mut Value {
        let obj = ensure_object(self);
        obj.entry(key.to_string()).or_insert_with(|| Value::Object(Map::new()))
    }
}

pub fn backups_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("backups")
}

/// Computes the merged settings and a human-readable summary WITHOUT writing
/// anything, so the caller (UI or CLI) can show a diff before confirming.
pub fn preview(settings_path: &Path, app_data_dir: &Path) -> std::io::Result<(Value, Value, ApplySummary)> {
    let before = read_settings(settings_path)?;
    let mut after = before.clone();
    let mut summary = ApplySummary::default();
    merge_hooks(&mut after, app_data_dir, &mut summary);
    merge_status_line(&mut after, app_data_dir, &mut summary);
    summary.changed = before != after;
    Ok((before, after, summary))
}

/// Applies the merge computed by `preview`, backing up the original file
/// first (or writing a `did-not-exist` marker if there was none).
pub fn apply(settings_path: &Path, app_data_dir: &Path) -> std::io::Result<ApplySummary> {
    install_relay_scripts(app_data_dir)?;
    let (before, after, mut summary) = preview(settings_path, app_data_dir)?;
    if !summary.changed {
        return Ok(summary);
    }

    let backups = backups_dir(app_data_dir);
    fs::create_dir_all(&backups)?;
    let stamp = Utc::now().format("%Y%m%dT%H%M%S%.3fZ");
    let backup_file = backups.join(format!("settings.json.{stamp}.bak"));
    if settings_path.exists() {
        fs::write(&backup_file, serde_json::to_string_pretty(&before)?)?;
    } else {
        fs::write(&backup_file, "__DID_NOT_EXIST__")?;
    }
    summary.backup_path = Some(backup_file.to_string_lossy().to_string());

    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(settings_path, serde_json::to_string_pretty(&after)? + "\n")?;

    // Remember the latest backup path so `revert` can find it without the
    // caller having to pass it back in.
    fs::write(app_data_dir.join("last-backup-path.txt"), backup_file.to_string_lossy().to_string())?;

    Ok(summary)
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RevertResult {
    pub reverted: bool,
    pub reason: Option<String>,
}

/// Restores `settings_path` from the most recent backup this app made. Does
/// nothing (and says so) if we never applied a change, or the backup file
/// has since been removed.
pub fn revert(settings_path: &Path, app_data_dir: &Path) -> std::io::Result<RevertResult> {
    let marker = app_data_dir.join("last-backup-path.txt");
    let Ok(backup_path) = fs::read_to_string(&marker) else {
        return Ok(RevertResult {
            reverted: false,
            reason: Some("設定を変更した記録が見つかりません".to_string()),
        });
    };
    let backup_path = PathBuf::from(backup_path.trim());
    let Ok(contents) = fs::read_to_string(&backup_path) else {
        return Ok(RevertResult {
            reverted: false,
            reason: Some("バックアップファイルが見つかりません".to_string()),
        });
    };

    if contents == "__DID_NOT_EXIST__" {
        if settings_path.exists() {
            fs::remove_file(settings_path)?;
        }
    } else {
        fs::write(settings_path, contents)?;
    }
    let _ = fs::remove_file(&marker);
    Ok(RevertResult {
        reverted: true,
        reason: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn adds_hooks_and_status_line_to_empty_settings() {
        let dir = tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");
        let app_data = dir.path().join("appdata");

        let summary = apply(&settings_path, &app_data).unwrap();
        assert_eq!(summary.hooks_added.len(), HOOK_EVENTS.len());
        assert!(summary.status_line_applied);
        assert!(settings_path.exists());

        let written: Value = serde_json::from_str(&fs::read_to_string(&settings_path).unwrap()).unwrap();
        assert!(written["hooks"]["PreToolUse"].is_array());
        assert!(written["statusLine"]["command"].is_string());
    }

    #[test]
    fn preserves_existing_unrelated_keys_and_user_hooks() {
        let dir = tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");
        let app_data = dir.path().join("appdata");
        fs::write(
            &settings_path,
            serde_json::to_string(&json!({
                "permissions": {"allow": ["Bash(git *)"]},
                "hooks": {
                    "PreToolUse": [
                        {"matcher": "Bash", "hooks": [{"type": "command", "command": "echo custom"}]}
                    ]
                }
            }))
            .unwrap(),
        )
        .unwrap();

        apply(&settings_path, &app_data).unwrap();
        let written: Value = serde_json::from_str(&fs::read_to_string(&settings_path).unwrap()).unwrap();
        assert_eq!(written["permissions"]["allow"][0], "Bash(git *)");
        let pre_tool_groups = written["hooks"]["PreToolUse"].as_array().unwrap();
        assert_eq!(pre_tool_groups.len(), 2, "must keep the user's own hook and add ours");
        assert!(pre_tool_groups
            .iter()
            .any(|g| g["hooks"][0]["command"] == "echo custom"));
    }

    #[test]
    fn does_not_overwrite_existing_status_line() {
        let dir = tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");
        let app_data = dir.path().join("appdata");
        fs::write(
            &settings_path,
            serde_json::to_string(&json!({"statusLine": {"type": "command", "command": "my-custom-status"}})).unwrap(),
        )
        .unwrap();

        let summary = apply(&settings_path, &app_data).unwrap();
        assert!(!summary.status_line_applied);
        assert!(summary.status_line_skipped_reason.is_some());
        let written: Value = serde_json::from_str(&fs::read_to_string(&settings_path).unwrap()).unwrap();
        assert_eq!(written["statusLine"]["command"], "my-custom-status");
    }

    #[test]
    fn applying_twice_is_idempotent() {
        let dir = tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");
        let app_data = dir.path().join("appdata");

        apply(&settings_path, &app_data).unwrap();
        let after_first = fs::read_to_string(&settings_path).unwrap();
        let summary2 = apply(&settings_path, &app_data).unwrap();
        let after_second = fs::read_to_string(&settings_path).unwrap();

        assert_eq!(after_first, after_second);
        assert!(!summary2.changed);
        assert_eq!(summary2.hooks_already_present.len(), HOOK_EVENTS.len());
    }

    #[test]
    fn revert_restores_original_file_exactly() {
        let dir = tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");
        let app_data = dir.path().join("appdata");
        let original = json!({"permissions": {"allow": ["Bash(ls)"]}});
        fs::write(&settings_path, serde_json::to_string_pretty(&original).unwrap()).unwrap();

        apply(&settings_path, &app_data).unwrap();
        assert_ne!(fs::read_to_string(&settings_path).unwrap(), serde_json::to_string_pretty(&original).unwrap());

        let result = revert(&settings_path, &app_data).unwrap();
        assert!(result.reverted);
        let restored: Value = serde_json::from_str(&fs::read_to_string(&settings_path).unwrap()).unwrap();
        assert_eq!(restored, original);
    }

    #[test]
    fn revert_removes_file_that_did_not_exist_before() {
        let dir = tempdir().unwrap();
        let settings_path = dir.path().join("settings.json");
        let app_data = dir.path().join("appdata");

        apply(&settings_path, &app_data).unwrap();
        assert!(settings_path.exists());
        let result = revert(&settings_path, &app_data).unwrap();
        assert!(result.reverted);
        assert!(!settings_path.exists());
    }
}
