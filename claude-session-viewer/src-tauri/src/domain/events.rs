//! Raw observations produced by collectors. These are the *inputs* to the
//! merge engine in `domain::merge` — collectors never write `ClaudeSession`
//! directly, they only ever describe "I observed X about session Y, from
//! source Z, at time T", and the merge engine decides whether that wins.

use chrono::{DateTime, Utc};

use super::types::{Confidence, ContextUsage, DataSource, SessionStatus, SubagentRunStatus};

/// A single fact learned from a collector. `event_id` must be stable and
/// unique per underlying occurrence so re-delivery (e.g. a filesystem watcher
/// firing twice for one write, or replaying the hook log after a restart) is
/// a safe no-op.
#[derive(Debug, Clone)]
pub struct RawEvent {
    pub event_id: String,
    pub source: DataSource,
    /// When the underlying fact happened, per the source (hook payload time,
    /// transcript line timestamp, process sample time, ...). Used to decide
    /// ordering when two observations come from the same source out of order.
    pub timestamp: DateTime<Utc>,
    pub session_id: String,
    pub kind: RawEventKind,
}

#[derive(Debug, Clone)]
pub enum RawEventKind {
    /// A session is known to exist. Fields are best-effort and only fill in
    /// gaps — they never overwrite a more-trusted existing value.
    SessionSeen {
        pid: Option<u32>,
        cwd: Option<String>,
        project_name: Option<String>,
        model: Option<String>,
        started_at: Option<DateTime<Utc>>,
    },
    StatusUpdate {
        status: SessionStatus,
        confidence: Confidence,
    },
    ModelUpdate {
        model: String,
    },
    /// Bumps last_activity_at without asserting a status.
    ActivityPing,
    ContextUpdate(ContextUsage),
    SubagentStarted {
        subagent_id: String,
        agent_type: Option<String>,
        transcript_path: Option<String>,
    },
    SubagentStopped {
        subagent_id: String,
        status: SubagentRunStatus,
    },
    SessionStopped,
}
