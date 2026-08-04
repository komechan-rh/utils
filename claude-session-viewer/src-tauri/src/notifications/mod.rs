//! OS notification dispatch with deduplication.
//!
//! The spec is explicit that notifications must not repeat for an unchanged
//! condition ("同じ状態で通知を繰り返さないよう、deduplicationを実装してください")
//! and must be off by default except for the two cases that are genuinely
//! urgent (waiting for a permission decision, rate limit reached). This
//! module only decides *whether* to fire; actually showing the OS
//! notification is done by the caller via `tauri_plugin_notification`, kept
//! separate so this logic is unit-testable without a running Tauri app.

use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum NotificationKind {
    WaitingPermission,
    StalledSession,
    SubagentCompleted,
    RateLimitWarning,
    RateLimitReached,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct NotificationSettings {
    pub waiting_permission: bool,
    pub stalled_session: bool,
    pub subagent_completed: bool,
    pub rate_limit_warning: bool,
    pub rate_limit_reached: bool,
}

impl NotificationSettings {
    /// Defaults per spec: only the two urgent, action-needed cases are on;
    /// everything else opt-in, so a fresh install is not noisy.
    pub fn default_conservative() -> Self {
        Self {
            waiting_permission: true,
            stalled_session: false,
            subagent_completed: false,
            rate_limit_warning: true,
            rate_limit_reached: true,
        }
    }

    fn enabled(&self, kind: NotificationKind) -> bool {
        match kind {
            NotificationKind::WaitingPermission => self.waiting_permission,
            NotificationKind::StalledSession => self.stalled_session,
            NotificationKind::SubagentCompleted => self.subagent_completed,
            NotificationKind::RateLimitWarning => self.rate_limit_warning,
            NotificationKind::RateLimitReached => self.rate_limit_reached,
        }
    }
}

/// Tracks the last "fingerprint" delivered per (session, kind) so the same
/// underlying condition never re-fires. A fingerprint is any string the
/// caller derives from the condition's identity — e.g. for
/// `WaitingPermission` that's the session id alone (fires once per
/// permission wait, not once per poll tick); for `SubagentCompleted` it's
/// the subagent id (fires once per subagent, however many sessions/polls
/// observe its completion).
#[derive(Default)]
pub struct Deduplicator {
    last_fingerprint: HashMap<(String, NotificationKind), String>,
}

impl Deduplicator {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns true if this (key, kind, fingerprint) has not been delivered
    /// yet, and records it as delivered. A changed fingerprint for the same
    /// key+kind (e.g. rate limit crossing from 80% back down and up again)
    /// is treated as a new, notifiable occurrence.
    pub fn should_notify(&mut self, key: &str, kind: NotificationKind, fingerprint: &str) -> bool {
        let map_key = (key.to_string(), kind);
        if self.last_fingerprint.get(&map_key).map(String::as_str) == Some(fingerprint) {
            return false;
        }
        self.last_fingerprint
            .insert(map_key, fingerprint.to_string());
        true
    }

    /// Clears dedup state for a key (e.g. once a session's permission wait
    /// resolves), so the *next* wait on the same session notifies again.
    pub fn clear(&mut self, key: &str, kind: NotificationKind) {
        self.last_fingerprint.remove(&(key.to_string(), kind));
    }
}

pub fn should_fire(
    settings: &NotificationSettings,
    dedup: &mut Deduplicator,
    key: &str,
    kind: NotificationKind,
    fingerprint: &str,
) -> bool {
    settings.enabled(kind) && dedup.should_notify(key, kind, fingerprint)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_condition_does_not_notify_twice() {
        let mut dedup = Deduplicator::new();
        assert!(dedup.should_notify("s1", NotificationKind::WaitingPermission, "waiting"));
        assert!(!dedup.should_notify("s1", NotificationKind::WaitingPermission, "waiting"));
    }

    #[test]
    fn different_sessions_notify_independently() {
        let mut dedup = Deduplicator::new();
        assert!(dedup.should_notify("s1", NotificationKind::WaitingPermission, "waiting"));
        assert!(dedup.should_notify("s2", NotificationKind::WaitingPermission, "waiting"));
    }

    #[test]
    fn changed_fingerprint_notifies_again() {
        let mut dedup = Deduplicator::new();
        assert!(dedup.should_notify("s1", NotificationKind::RateLimitWarning, "80"));
        assert!(!dedup.should_notify("s1", NotificationKind::RateLimitWarning, "80"));
        assert!(dedup.should_notify("s1", NotificationKind::RateLimitWarning, "90"));
    }

    #[test]
    fn disabled_kind_never_fires_regardless_of_dedup() {
        let settings = NotificationSettings::default_conservative();
        let mut dedup = Deduplicator::new();
        assert!(!should_fire(
            &settings,
            &mut dedup,
            "s1",
            NotificationKind::StalledSession,
            "stalled"
        ));
    }

    #[test]
    fn default_settings_are_conservative() {
        let settings = NotificationSettings::default_conservative();
        assert!(settings.waiting_permission);
        assert!(settings.rate_limit_reached);
        assert!(!settings.stalled_session);
        assert!(!settings.subagent_completed);
    }
}
