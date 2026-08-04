/**
 * Domain types shared conceptually with `src-tauri/src/domain/types.rs`.
 * Keep the two in sync manually — Tauri commands serialize the Rust structs
 * as JSON and this file describes the shape the frontend receives.
 */

export type SessionStatus =
  | "starting"
  | "thinking"
  | "using_tool"
  | "waiting_permission"
  | "waiting_user"
  | "compacting"
  | "rate_limited"
  | "idle"
  | "stopped"
  | "unknown";

/**
 * Where a piece of data came from, ordered by trust (index 0 = most trusted).
 * See src-tauri/src/domain/types.rs::DataSource for the authoritative order
 * and README.md "データ取得元" for what each source can and cannot see.
 */
export type DataSource =
  "official_hook" | "status_line" | "transcript" | "filesystem" | "process" | "estimated";

export const DATA_SOURCE_PRIORITY: readonly DataSource[] = [
  "official_hook",
  "status_line",
  "transcript",
  "filesystem",
  "process",
  "estimated",
];

/** Human-facing grouping of DataSource, matching the spec's Official/Observed/Estimated/Unavailable labels. */
export type DataSourceTier = "official" | "observed" | "estimated" | "unavailable";

export function dataSourceTier(source: DataSource): DataSourceTier {
  switch (source) {
    case "official_hook":
    case "status_line":
      return "official";
    case "transcript":
    case "filesystem":
    case "process":
      return "observed";
    case "estimated":
      return "estimated";
  }
}

export type Confidence = "high" | "medium" | "low";

export type ObservedValue<T> = {
  value: T;
  source: DataSource;
  observedAt: string;
  confidence: Confidence;
};

export type ContextUsage = {
  usedTokens?: number;
  maxTokens?: number;
  usedPercentage?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  compactionCount?: number;
  source: DataSource;
  confidence: Confidence;
};

export type SubagentRunStatus = "running" | "completed" | "failed" | "unknown";

export type Subagent = {
  id: string;
  parentSessionId: string;
  type?: string;
  status: SubagentRunStatus;
  startedAt?: string;
  stoppedAt?: string;
  durationMs?: number;
  transcriptPath?: string;
  source: DataSource;
};

export type ClaudeSession = {
  id: string;
  pid?: number;
  projectName: string;
  cwd?: string;
  model?: string;
  status: SessionStatus;
  statusSource: DataSource;
  statusConfidence: Confidence;
  startedAt?: string;
  lastActivityAt?: string;
  stoppedAt?: string;
  context?: ContextUsage;
  subagents: Subagent[];
  /** true once no live process/transcript activity has been seen past the staleness window. */
  isStale: boolean;
};

export type RateLimitWindow = {
  usedPercentage?: number;
  resetsAt?: string;
};

export type RateLimitAvailability = "available" | "unavailable";

export type RateLimitState = {
  availability: RateLimitAvailability;
  /** Why rate limits are unavailable, shown verbatim in the UI. Empty when availability === "available". */
  unavailableReason?: string;
  fiveHour?: RateLimitWindow;
  sevenDay?: RateLimitWindow;
  source: DataSource;
  observedAt?: string;
};

export type NotificationKind =
  | "waiting_permission"
  | "stalled_session"
  | "subagent_completed"
  | "rate_limit_warning"
  | "rate_limit_reached";

export type NotificationSettings = Record<NotificationKind, boolean>;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  waiting_permission: true,
  stalled_session: false,
  subagent_completed: false,
  rate_limit_warning: true,
  rate_limit_reached: true,
};
