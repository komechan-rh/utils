import type { DataSourceTier, SessionStatus } from "../types/domain";

export const STATUS_LABEL: Record<SessionStatus, string> = {
  starting: "Starting",
  thinking: "Thinking",
  using_tool: "Using tool",
  waiting_permission: "Waiting for permission",
  waiting_user: "Waiting",
  compacting: "Compacting",
  rate_limited: "Rate limited",
  idle: "Idle",
  stopped: "Stopped",
  unknown: "Unknown",
};

/** CSS custom property name carrying this status's accent color; see index.css. */
export const STATUS_COLOR_VAR: Record<SessionStatus, string> = {
  starting: "--status-info",
  thinking: "--status-active",
  using_tool: "--status-active",
  waiting_permission: "--status-warning",
  waiting_user: "--status-attention",
  compacting: "--status-info",
  rate_limited: "--status-danger",
  idle: "--status-neutral",
  stopped: "--status-neutral",
  unknown: "--status-neutral",
};

/** Filled dot vs hollow ring vs static square — status must never rely on color alone. */
export const STATUS_GLYPH: Record<SessionStatus, string> = {
  starting: "◐",
  thinking: "●",
  using_tool: "◆",
  waiting_permission: "▲",
  waiting_user: "○",
  compacting: "◐",
  rate_limited: "■",
  idle: "○",
  stopped: "□",
  unknown: "?",
};

export const SOURCE_TIER_LABEL: Record<DataSourceTier, string> = {
  official: "Official",
  observed: "Observed",
  estimated: "Estimated",
  unavailable: "Unavailable",
};
