//! Maps a Claude Code hook event name (and, for `Notification`, its message)
//! to our normalized `SessionStatus`. This is the "official_hook" source —
//! the highest-trust source we have, since it comes directly from Claude
//! Code invoking our registered hook command.
//!
//! Hook event names and payload shape are per Claude Code's documented hooks
//! feature (`~/.claude/settings.json` -> `hooks`). See README.md "hooks設定"
//! for the exact fields we rely on and which are best-effort.

use super::types::{Confidence, SessionStatus};

pub fn status_for_hook(event_name: &str, message: Option<&str>) -> (SessionStatus, Confidence) {
    match event_name {
        "SessionStart" => (SessionStatus::Starting, Confidence::High),
        "UserPromptSubmit" => (SessionStatus::Thinking, Confidence::High),
        "PreToolUse" => (SessionStatus::UsingTool, Confidence::High),
        "PostToolUse" => (SessionStatus::Thinking, Confidence::Medium),
        "PreCompact" => (SessionStatus::Compacting, Confidence::High),
        "Stop" => (SessionStatus::WaitingUser, Confidence::High),
        "SessionEnd" => (SessionStatus::Stopped, Confidence::High),
        "Notification" => {
            let text = message.unwrap_or_default().to_lowercase();
            if text.contains("permission") {
                (SessionStatus::WaitingPermission, Confidence::High)
            } else {
                (SessionStatus::WaitingUser, Confidence::Medium)
            }
        }
        _ => (SessionStatus::Unknown, Confidence::Low),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_hook_events() {
        assert_eq!(
            status_for_hook("PreToolUse", None).0,
            SessionStatus::UsingTool
        );
        assert_eq!(
            status_for_hook("Notification", Some("Claude needs your permission to use Bash"))
                .0,
            SessionStatus::WaitingPermission
        );
        assert_eq!(status_for_hook("Stop", None).0, SessionStatus::WaitingUser);
    }

    #[test]
    fn unknown_event_name_is_unknown_not_guessed() {
        assert_eq!(status_for_hook("SomethingNew", None).0, SessionStatus::Unknown);
    }
}
