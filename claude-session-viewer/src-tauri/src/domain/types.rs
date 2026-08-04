//! Core domain types. Mirrors `src/types/domain.ts` on the frontend side —
//! keep the two in sync by hand when either changes.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Starting,
    Thinking,
    UsingTool,
    WaitingPermission,
    WaitingUser,
    Compacting,
    RateLimited,
    Idle,
    Stopped,
    Unknown,
}

/// Where a piece of data came from. Order here (top to bottom) is also the
/// trust order used by `domain::merge` to resolve conflicts: an
/// `OfficialHook` observation always wins over an `Estimated` one, and a
/// same-source observation wins only if it is newer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum DataSource {
    OfficialHook = 0,
    StatusLine = 1,
    Transcript = 2,
    Filesystem = 3,
    Process = 4,
    #[default]
    Estimated = 5,
}


impl DataSource {
    /// Lower is more trusted. Used to resolve conflicting observations.
    pub fn priority(self) -> u8 {
        self as u8
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum Confidence {
    High,
    Medium,
    #[default]
    Low,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservedValue<T> {
    pub value: T,
    pub source: DataSource,
    pub observed_at: String,
    pub confidence: Confidence,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ContextUsage {
    pub used_tokens: Option<u64>,
    pub max_tokens: Option<u64>,
    pub used_percentage: Option<f32>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>,
    pub cache_write_tokens: Option<u64>,
    pub compaction_count: Option<u32>,
    #[serde(default = "default_estimated_source")]
    pub source: DataSource,
    #[serde(default = "default_low_confidence")]
    pub confidence: Confidence,
}

fn default_estimated_source() -> DataSource {
    DataSource::Estimated
}
fn default_low_confidence() -> Confidence {
    Confidence::Low
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SubagentRunStatus {
    Running,
    Completed,
    Failed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subagent {
    pub id: String,
    pub parent_session_id: String,
    #[serde(rename = "type")]
    pub agent_type: Option<String>,
    pub status: SubagentRunStatus,
    pub started_at: Option<String>,
    pub stopped_at: Option<String>,
    pub duration_ms: Option<i64>,
    pub transcript_path: Option<String>,
    pub source: DataSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSession {
    pub id: String,
    pub pid: Option<u32>,
    pub project_name: String,
    pub cwd: Option<String>,
    pub model: Option<String>,
    pub status: SessionStatus,
    pub status_source: DataSource,
    pub status_confidence: Confidence,
    pub started_at: Option<String>,
    pub last_activity_at: Option<String>,
    pub stopped_at: Option<String>,
    pub context: Option<ContextUsage>,
    pub subagents: Vec<Subagent>,
    pub is_stale: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RateLimitWindow {
    pub used_percentage: Option<f32>,
    pub resets_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RateLimitAvailability {
    Available,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitState {
    pub availability: RateLimitAvailability,
    pub unavailable_reason: Option<String>,
    pub five_hour: Option<RateLimitWindow>,
    pub seven_day: Option<RateLimitWindow>,
    pub source: DataSource,
    pub observed_at: Option<String>,
}

impl RateLimitState {
    /// The MVP has no confirmed local, offline source for Claude subscription
    /// rate limits (see README "rate limit表示"). Rather than guess, we say so.
    pub fn unavailable(reason: impl Into<String>) -> Self {
        Self {
            availability: RateLimitAvailability::Unavailable,
            unavailable_reason: Some(reason.into()),
            five_hour: None,
            seven_day: None,
            source: DataSource::Estimated,
            observed_at: None,
        }
    }
}
