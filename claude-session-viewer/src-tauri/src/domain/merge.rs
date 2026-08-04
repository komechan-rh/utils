//! The state-merge engine. This is the one place allowed to mutate session
//! state, so all of the tricky concurrency/ordering requirements from the
//! spec live here:
//!
//! - duplicate events (same `event_id`) are no-ops
//! - out-of-order events never let a stale fact overwrite a fresher one
//! - a low-trust source (e.g. `Estimated`) can never clobber a value already
//!   set by a higher-trust source, even if the low-trust event is newer
//! - unknown subagent/session linkage is stored as `unknown`, never guessed

use std::collections::{HashSet, VecDeque};

use chrono::{DateTime, Utc};

use super::events::{RawEvent, RawEventKind};
use super::types::{
    ClaudeSession, Confidence, ContextUsage, DataSource, SessionStatus, Subagent,
    SubagentRunStatus,
};

/// Provenance for a single mutable field: who last set it and when, so a
/// later, less-trusted observation can be rejected.
#[derive(Debug, Clone, Copy)]
struct FieldMeta {
    source: DataSource,
    at: DateTime<Utc>,
}

impl FieldMeta {
    /// Whether an incoming observation from `source` at `at` is allowed to
    /// overwrite the field currently owned by `self`.
    fn accepts(&self, source: DataSource, at: DateTime<Utc>) -> bool {
        if source.priority() < self.source.priority() {
            return true; // strictly more trusted source always wins
        }
        if source.priority() == self.source.priority() {
            return at >= self.at; // same trust: newer wins, ties keep existing
        }
        false // less trusted source may never clobber a more trusted one
    }
}

#[derive(Debug, Clone)]
struct Record {
    session: ClaudeSession,
    status_meta: FieldMeta,
    model_meta: Option<FieldMeta>,
    context_meta: Option<FieldMeta>,
    cwd_meta: Option<FieldMeta>,
    activity_meta: Option<FieldMeta>,
}

const MAX_PROCESSED_EVENT_MEMORY: usize = 20_000;

pub struct SessionStore {
    records: Vec<Record>,
    /// Bounded ring of recently processed event ids for idempotency. Backed
    /// additionally by the `processed_events` SQLite table for durability
    /// across restarts (see storage::db); this in-memory copy just avoids a
    /// DB round trip on the hot path.
    processed_event_ids: HashSet<String>,
    processed_event_order: VecDeque<String>,
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            records: Vec::new(),
            processed_event_ids: HashSet::new(),
            processed_event_order: VecDeque::new(),
        }
    }

    /// Seed already-processed event ids after loading from SQLite, so a
    /// restarted app doesn't reapply (harmlessly, but wastefully) events it
    /// already saw before the crash/restart.
    pub fn seed_processed_event_ids(&mut self, ids: impl IntoIterator<Item = String>) {
        for id in ids {
            self.remember_event_id(id);
        }
    }

    fn remember_event_id(&mut self, id: String) {
        if self.processed_event_ids.insert(id.clone()) {
            self.processed_event_order.push_back(id);
            if self.processed_event_order.len() > MAX_PROCESSED_EVENT_MEMORY {
                if let Some(old) = self.processed_event_order.pop_front() {
                    self.processed_event_ids.remove(&old);
                }
            }
        }
    }

    /// Applies one raw observation. Returns `Some(session)` (post-update) if
    /// it changed anything an observer would care about, `None` if it was a
    /// duplicate or was rejected by provenance rules.
    pub fn apply(&mut self, ev: RawEvent) -> Option<ClaudeSession> {
        if self.processed_event_ids.contains(&ev.event_id) {
            return None;
        }

        let idx = self.find_or_create(&ev.session_id);
        let changed = {
            let record = &mut self.records[idx];
            apply_to_record(record, &ev)
        };

        self.remember_event_id(ev.event_id.clone());

        if changed {
            Some(self.records[idx].session.clone())
        } else {
            None
        }
    }

    fn find_or_create(&mut self, session_id: &str) -> usize {
        if let Some(i) = self.records.iter().position(|r| r.session.id == session_id) {
            return i;
        }
        let session = ClaudeSession {
            id: session_id.to_string(),
            pid: None,
            project_name: "unknown".to_string(),
            cwd: None,
            model: None,
            status: SessionStatus::Unknown,
            status_source: DataSource::Estimated,
            status_confidence: Confidence::Low,
            started_at: None,
            last_activity_at: None,
            stopped_at: None,
            context: None,
            subagents: Vec::new(),
            is_stale: false,
        };
        self.records.push(Record {
            session,
            status_meta: FieldMeta {
                source: DataSource::Estimated,
                at: DateTime::<Utc>::MIN_UTC,
            },
            model_meta: None,
            context_meta: None,
            cwd_meta: None,
            activity_meta: None,
        });
        self.records.len() - 1
    }

    pub fn all_sessions(&self) -> Vec<ClaudeSession> {
        self.records.iter().map(|r| r.session.clone()).collect()
    }

    pub fn get(&self, session_id: &str) -> Option<ClaudeSession> {
        self.records
            .iter()
            .find(|r| r.session.id == session_id)
            .map(|r| r.session.clone())
    }

    /// Any session whose `last_activity_at` (or `started_at` if never seen
    /// active) is older than `threshold` and isn't already `stopped` gets
    /// flagged `is_stale`. Callers decide what stale means in the UI; we also
    /// downgrade a stale, unconfirmed-stopped session's status to `idle` only
    /// when its current status source is itself low-trust (`Estimated`), so
    /// we never override an official "stopped" hook or a fresher official
    /// status with a guess.
    pub fn sweep_stale(&mut self, now: DateTime<Utc>, threshold: chrono::Duration) -> Vec<String> {
        let mut changed = Vec::new();
        for record in &mut self.records {
            if matches!(record.session.status, SessionStatus::Stopped) {
                continue;
            }
            let Some(last) = last_known_signal_at(record) else { continue };
            let is_stale = now - last > threshold;
            if is_stale != record.session.is_stale {
                record.session.is_stale = is_stale;
                changed.push(record.session.id.clone());
            }
        }
        changed
    }

    /// Transitions long-inactive sessions to `Stopped`, sourced as
    /// `Estimated` (we did not observe a stop event — we inferred it from
    /// silence). Never overrides a status set by a higher-trust source, so
    /// an official hook's last word always stands even if activity ping
    /// bookkeeping stalls.
    pub fn sweep_dead(&mut self, now: DateTime<Utc>, threshold: chrono::Duration) -> Vec<String> {
        let mut changed = Vec::new();
        for record in &mut self.records {
            if matches!(record.session.status, SessionStatus::Stopped) {
                continue;
            }
            let Some(last) = last_known_signal_at(record) else { continue };
            if now - last > threshold && record.status_meta.accepts(DataSource::Estimated, now) {
                record.session.status = SessionStatus::Stopped;
                record.session.status_source = DataSource::Estimated;
                record.session.status_confidence = Confidence::Low;
                record.session.stopped_at = Some(now.to_rfc3339());
                record.status_meta = FieldMeta {
                    source: DataSource::Estimated,
                    at: now,
                };
                changed.push(record.session.id.clone());
            }
        }
        changed
    }

    /// Marks a session `stopped` because its owning OS process is confirmed
    /// gone (see collectors::processes). This is allowed to override any
    /// status source because "the process no longer exists" is itself an
    /// official, first-party observation (`DataSource::Process`) of the
    /// strongest possible kind for this fact specifically.
    pub fn mark_process_gone(&mut self, session_id: &str, at: DateTime<Utc>) -> bool {
        if let Some(record) = self.records.iter_mut().find(|r| r.session.id == session_id) {
            if !matches!(record.session.status, SessionStatus::Stopped) {
                record.session.status = SessionStatus::Stopped;
                record.session.status_source = DataSource::Process;
                record.session.status_confidence = Confidence::High;
                record.session.stopped_at = Some(at.to_rfc3339());
                record.status_meta = FieldMeta {
                    source: DataSource::Process,
                    at,
                };
                return true;
            }
        }
        false
    }
}

/// The most recent timestamp we have any reason to believe this session was
/// touched: parsed `last_activity_at`/`started_at`, or (falling back, for a
/// session that has only ever received e.g. a bare `SessionSeen`) the
/// newest provenance timestamp among its tracked fields. Returns `None`
/// only for a session we have literally no timestamped information about.
fn last_known_signal_at(record: &Record) -> Option<DateTime<Utc>> {
    let mut candidates: Vec<DateTime<Utc>> = Vec::new();
    if let Some(d) = record
        .session
        .last_activity_at
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
    {
        candidates.push(d.with_timezone(&Utc));
    }
    if let Some(d) = record
        .session
        .started_at
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
    {
        candidates.push(d.with_timezone(&Utc));
    }
    if record.status_meta.at != DateTime::<Utc>::MIN_UTC {
        candidates.push(record.status_meta.at);
    }
    for meta in [
        record.model_meta,
        record.context_meta,
        record.cwd_meta,
        record.activity_meta,
    ]
    .into_iter()
    .flatten()
    {
        candidates.push(meta.at);
    }
    candidates.into_iter().max()
}

fn apply_to_record(record: &mut Record, ev: &RawEvent) -> bool {
    let mut changed = false;
    match &ev.kind {
        RawEventKind::SessionSeen {
            pid,
            cwd,
            project_name,
            model,
            started_at,
        } => {
            if let Some(pid) = pid {
                if record.session.pid != Some(*pid) {
                    record.session.pid = Some(*pid);
                    changed = true;
                }
            }
            if let Some(cwd) = cwd {
                let accept = record
                    .cwd_meta
                    .map(|m| m.accepts(ev.source, ev.timestamp))
                    .unwrap_or(true);
                if accept && record.session.cwd.as_deref() != Some(cwd.as_str()) {
                    record.session.cwd = Some(cwd.clone());
                    record.cwd_meta = Some(FieldMeta {
                        source: ev.source,
                        at: ev.timestamp,
                    });
                    changed = true;
                }
            }
            if let Some(name) = project_name {
                if record.session.project_name == "unknown" || record.session.project_name.is_empty()
                {
                    record.session.project_name = name.clone();
                    changed = true;
                }
            }
            if let Some(model) = model {
                changed |= set_model(record, ev.source, ev.timestamp, model.clone());
            }
            if let Some(started_at) = started_at {
                if record.session.started_at.is_none() {
                    record.session.started_at = Some(started_at.to_rfc3339());
                    changed = true;
                }
            }
        }
        RawEventKind::StatusUpdate { status, confidence } => {
            if record.status_meta.accepts(ev.source, ev.timestamp) {
                let differs = record.session.status != *status
                    || record.session.status_source != ev.source;
                if differs {
                    record.session.status = *status;
                    record.session.status_source = ev.source;
                    record.session.status_confidence = *confidence;
                    record.status_meta = FieldMeta {
                        source: ev.source,
                        at: ev.timestamp,
                    };
                    changed = true;
                }
            }
        }
        RawEventKind::ModelUpdate { model } => {
            changed |= set_model(record, ev.source, ev.timestamp, model.clone());
        }
        RawEventKind::ActivityPing => {
            changed |= bump_activity(record, ev.source, ev.timestamp);
        }
        RawEventKind::ContextUpdate(usage) => {
            let accept = record
                .context_meta
                .map(|m| m.accepts(ev.source, ev.timestamp))
                .unwrap_or(true);
            if accept {
                record.session.context = Some(usage.clone());
                record.context_meta = Some(FieldMeta {
                    source: ev.source,
                    at: ev.timestamp,
                });
                changed = true;
            }
            changed |= bump_activity(record, ev.source, ev.timestamp);
        }
        RawEventKind::SubagentStarted {
            subagent_id,
            agent_type,
            transcript_path,
        } => {
            if !record.session.subagents.iter().any(|s| &s.id == subagent_id) {
                record.session.subagents.push(Subagent {
                    id: subagent_id.clone(),
                    parent_session_id: record.session.id.clone(),
                    agent_type: agent_type.clone(),
                    status: SubagentRunStatus::Running,
                    started_at: Some(ev.timestamp.to_rfc3339()),
                    stopped_at: None,
                    duration_ms: None,
                    transcript_path: transcript_path.clone(),
                    source: ev.source,
                });
                changed = true;
            }
            changed |= bump_activity(record, ev.source, ev.timestamp);
        }
        RawEventKind::SubagentStopped { subagent_id, status } => {
            if let Some(sub) = record
                .session
                .subagents
                .iter_mut()
                .find(|s| &s.id == subagent_id)
            {
                if sub.status == SubagentRunStatus::Running {
                    sub.status = *status;
                    sub.stopped_at = Some(ev.timestamp.to_rfc3339());
                    if let Some(started) = sub
                        .started_at
                        .as_deref()
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    {
                        sub.duration_ms =
                            Some((ev.timestamp - started.with_timezone(&Utc)).num_milliseconds());
                    }
                    changed = true;
                }
            }
            // A stop event for a subagent we never saw start is NOT guessed
            // into existence — per spec we must not fabricate linkage.
            changed |= bump_activity(record, ev.source, ev.timestamp);
        }
        RawEventKind::SessionStopped => {
            if record.status_meta.accepts(ev.source, ev.timestamp) {
                record.session.status = SessionStatus::Stopped;
                record.session.status_source = ev.source;
                record.session.status_confidence = Confidence::High;
                record.session.stopped_at = Some(ev.timestamp.to_rfc3339());
                record.status_meta = FieldMeta {
                    source: ev.source,
                    at: ev.timestamp,
                };
                changed = true;
            }
        }
    }
    changed
}

fn set_model(record: &mut Record, source: DataSource, at: DateTime<Utc>, model: String) -> bool {
    let accept = record
        .model_meta
        .map(|m| m.accepts(source, at))
        .unwrap_or(true);
    if accept && record.session.model.as_deref() != Some(model.as_str()) {
        record.session.model = Some(model);
        record.model_meta = Some(FieldMeta { source, at });
        return true;
    }
    false
}

fn bump_activity(record: &mut Record, source: DataSource, at: DateTime<Utc>) -> bool {
    let accept = record
        .activity_meta
        .map(|m| m.accepts(source, at))
        .unwrap_or(true);
    if !accept {
        return false;
    }
    let current = record
        .session
        .last_activity_at
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok());
    if current.map(|c| at > c).unwrap_or(true) {
        record.session.last_activity_at = Some(at.to_rfc3339());
        record.activity_meta = Some(FieldMeta { source, at });
        if record.session.is_stale {
            record.session.is_stale = false;
        }
        true
    } else {
        false
    }
}

#[allow(dead_code)]
pub fn context_used_percentage(usage: &ContextUsage) -> Option<f32> {
    match (usage.used_tokens, usage.max_tokens) {
        (Some(used), Some(max)) if max > 0 => Some((used as f32 / max as f32) * 100.0),
        _ => usage.used_percentage,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn t(offset_secs: i64) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc)
            + Duration::seconds(offset_secs)
    }

    fn status_event(id: &str, session: &str, source: DataSource, at: DateTime<Utc>, status: SessionStatus) -> RawEvent {
        RawEvent {
            event_id: id.to_string(),
            source,
            timestamp: at,
            session_id: session.to_string(),
            kind: RawEventKind::StatusUpdate {
                status,
                confidence: Confidence::High,
            },
        }
    }

    #[test]
    fn hook_event_produces_status() {
        let mut store = SessionStore::new();
        let session = store
            .apply(status_event(
                "e1",
                "s1",
                DataSource::OfficialHook,
                t(0),
                SessionStatus::Thinking,
            ))
            .expect("should change state");
        assert_eq!(session.status, SessionStatus::Thinking);
        assert_eq!(session.status_source, DataSource::OfficialHook);
    }

    #[test]
    fn duplicate_event_id_is_a_no_op() {
        let mut store = SessionStore::new();
        let ev = status_event("dup-1", "s1", DataSource::OfficialHook, t(0), SessionStatus::Thinking);
        assert!(store.apply(ev.clone()).is_some());
        assert!(store.apply(ev).is_none(), "second delivery must be ignored");
        assert_eq!(store.all_sessions().len(), 1);
    }

    #[test]
    fn out_of_order_events_do_not_let_stale_facts_win() {
        let mut store = SessionStore::new();
        // Newer event arrives first...
        store
            .apply(status_event(
                "e-late",
                "s1",
                DataSource::OfficialHook,
                t(100),
                SessionStatus::WaitingUser,
            ))
            .unwrap();
        // ...then an older, same-source event arrives late over the wire.
        let result = store.apply(status_event(
            "e-early",
            "s1",
            DataSource::OfficialHook,
            t(10),
            SessionStatus::Thinking,
        ));
        assert!(result.is_none(), "an older same-source event must not overwrite a newer one");
        assert_eq!(store.get("s1").unwrap().status, SessionStatus::WaitingUser);
    }

    #[test]
    fn lower_trust_source_never_overrides_higher_trust_source() {
        let mut store = SessionStore::new();
        store
            .apply(status_event(
                "official",
                "s1",
                DataSource::OfficialHook,
                t(0),
                SessionStatus::WaitingPermission,
            ))
            .unwrap();
        // A much later, but lower-trust, estimate must not clobber it.
        let result = store.apply(status_event(
            "guess",
            "s1",
            DataSource::Estimated,
            t(1_000_000),
            SessionStatus::Idle,
        ));
        assert!(result.is_none());
        assert_eq!(store.get("s1").unwrap().status, SessionStatus::WaitingPermission);
    }

    #[test]
    fn pid_reuse_is_not_misattributed_because_sessions_are_keyed_by_session_id() {
        let mut store = SessionStore::new();
        let ev1 = RawEvent {
            event_id: "seen-1".into(),
            source: DataSource::Process,
            timestamp: t(0),
            session_id: "proc:4242:1000".into(),
            kind: RawEventKind::SessionSeen {
                pid: Some(4242),
                cwd: Some("/Users/alice/proj-a".into()),
                project_name: Some("proj-a".into()),
                model: None,
                started_at: Some(t(0)),
            },
        };
        store.apply(ev1).unwrap();
        // Process 4242 exits and a new, unrelated process later reuses the
        // same PID. Because it has a different process-start-time it gets a
        // distinct synthetic session id, so it must not merge into proj-a.
        let ev2 = RawEvent {
            event_id: "seen-2".into(),
            source: DataSource::Process,
            timestamp: t(500),
            session_id: "proc:4242:1600".into(),
            kind: RawEventKind::SessionSeen {
                pid: Some(4242),
                cwd: Some("/Users/alice/proj-b".into()),
                project_name: Some("proj-b".into()),
                model: None,
                started_at: Some(t(500)),
            },
        };
        store.apply(ev2).unwrap();

        let sessions = store.all_sessions();
        assert_eq!(sessions.len(), 2, "PID reuse must not merge two distinct sessions");
        let a = sessions.iter().find(|s| s.id == "proc:4242:1000").unwrap();
        let b = sessions.iter().find(|s| s.id == "proc:4242:1600").unwrap();
        assert_eq!(a.cwd.as_deref(), Some("/Users/alice/proj-a"));
        assert_eq!(b.cwd.as_deref(), Some("/Users/alice/proj-b"));
    }

    #[test]
    fn subagent_links_to_its_parent_session() {
        let mut store = SessionStore::new();
        let start = RawEvent {
            event_id: "sub-start".into(),
            source: DataSource::Transcript,
            timestamp: t(0),
            session_id: "s1".into(),
            kind: RawEventKind::SubagentStarted {
                subagent_id: "toolu_1".into(),
                agent_type: Some("Explore".into()),
                transcript_path: Some("/tmp/s1.jsonl".into()),
            },
        };
        store.apply(start).unwrap();
        let session = store.get("s1").unwrap();
        assert_eq!(session.subagents.len(), 1);
        assert_eq!(session.subagents[0].parent_session_id, "s1");
        assert_eq!(session.subagents[0].status, SubagentRunStatus::Running);

        let stop = RawEvent {
            event_id: "sub-stop".into(),
            source: DataSource::Transcript,
            timestamp: t(30),
            session_id: "s1".into(),
            kind: RawEventKind::SubagentStopped {
                subagent_id: "toolu_1".into(),
                status: SubagentRunStatus::Completed,
            },
        };
        store.apply(stop).unwrap();
        let session = store.get("s1").unwrap();
        assert_eq!(session.subagents[0].status, SubagentRunStatus::Completed);
        assert_eq!(session.subagents[0].duration_ms, Some(30_000));
    }

    #[test]
    fn unlinkable_subagent_stop_is_not_fabricated_into_existence() {
        let mut store = SessionStore::new();
        let stop = RawEvent {
            event_id: "orphan-stop".into(),
            source: DataSource::Transcript,
            timestamp: t(0),
            session_id: "s1".into(),
            kind: RawEventKind::SubagentStopped {
                subagent_id: "toolu_unknown".into(),
                status: SubagentRunStatus::Completed,
            },
        };
        store.apply(stop);
        let session = store.get("s1").unwrap();
        assert!(
            session.subagents.is_empty(),
            "a stop event with no matching start must not invent a subagent record"
        );
    }

    #[test]
    fn context_usage_percentage_is_computed_from_tokens() {
        let usage = ContextUsage {
            used_tokens: Some(137_500),
            max_tokens: Some(200_000),
            used_percentage: None,
            input_tokens: Some(2),
            output_tokens: Some(1682),
            cache_read_tokens: Some(0),
            cache_write_tokens: Some(51_392),
            compaction_count: Some(0),
            source: DataSource::Transcript,
            confidence: Confidence::Medium,
        };
        let pct = context_used_percentage(&usage).unwrap();
        assert!((pct - 68.75).abs() < 0.01);
    }

    #[test]
    fn context_usage_falls_back_to_precomputed_percentage_when_tokens_missing() {
        let usage = ContextUsage {
            used_percentage: Some(42.0),
            ..Default::default()
        };
        assert_eq!(context_used_percentage(&usage), Some(42.0));
    }

    #[test]
    fn stale_session_transitions_to_stopped_without_overriding_official_status() {
        let mut store = SessionStore::new();
        store
            .apply(status_event(
                "e1",
                "s1",
                DataSource::Estimated,
                t(0),
                SessionStatus::Idle,
            ))
            .unwrap();
        let changed = store.sweep_dead(t(10_000), Duration::seconds(1000));
        assert_eq!(changed, vec!["s1".to_string()]);
        assert_eq!(store.get("s1").unwrap().status, SessionStatus::Stopped);
        assert_eq!(store.get("s1").unwrap().status_source, DataSource::Estimated);

        // An officially-sourced status must never be overridden by the sweep.
        let mut store2 = SessionStore::new();
        store2
            .apply(status_event(
                "e2",
                "s2",
                DataSource::OfficialHook,
                t(0),
                SessionStatus::WaitingUser,
            ))
            .unwrap();
        let changed2 = store2.sweep_dead(t(10_000), Duration::seconds(1000));
        assert!(changed2.is_empty());
        assert_eq!(store2.get("s2").unwrap().status, SessionStatus::WaitingUser);
    }

    #[test]
    fn duplicate_notifications_can_be_deduplicated_by_caller_using_status_fingerprint() {
        // The merge layer exposes `changed` only when a value actually
        // changes, which is what notifications::dedup keys off of — applying
        // the identical status twice in a row must not report a change the
        // second time.
        let mut store = SessionStore::new();
        let ev = status_event(
            "wp-1",
            "s1",
            DataSource::OfficialHook,
            t(0),
            SessionStatus::WaitingPermission,
        );
        assert!(store.apply(ev).is_some());
        let ev2 = status_event(
            "wp-2",
            "s1",
            DataSource::OfficialHook,
            t(1),
            SessionStatus::WaitingPermission,
        );
        assert!(
            store.apply(ev2).is_none(),
            "re-asserting the same status must not be reported as a change"
        );
    }
}
