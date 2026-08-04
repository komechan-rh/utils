import type { ClaudeSession, NotificationSettings, RateLimitState } from "../types/domain";
import { mockRateLimits, mockSessionSequence } from "./mockData";

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** `?empty=1` forces the mock path to report no sessions — used by the
 * empty-state E2E test, since the scripted mock sequence otherwise always
 * has sessions in it. */
function forceEmptyMock(): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("empty") === "1"
  );
}

export type Unlisten = () => void;

/**
 * Thin bridge over Tauri's `invoke`/`listen`. When the app is not actually
 * running inside Tauri (plain `vite dev` in a browser, Vitest, Storybook-ish
 * component preview), everything here falls back to a small in-memory
 * simulator so the UI is still developable — see mockData.ts. The real
 * `npm run simulate` CLI (simulator/simulate.ts) is a separate, more
 * thorough tool that writes real NDJSON/JSONL fixtures the Rust backend
 * itself parses; this in-browser fallback is just for fast UI iteration.
 */
export async function getSessions(): Promise<ClaudeSession[]> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<ClaudeSession[]>("get_sessions");
  }
  if (forceEmptyMock()) return [];
  return mockSessionSequence.current();
}

export async function getRateLimits(): Promise<RateLimitState> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<RateLimitState>("get_rate_limits");
  }
  return mockRateLimits;
}

export async function onSessionsUpdated(
  callback: (sessions: ClaudeSession[]) => void,
): Promise<Unlisten> {
  if (inTauri()) {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<ClaudeSession[]>("sessions-updated", (event) => callback(event.payload));
  }
  if (forceEmptyMock()) {
    return () => {};
  }
  const interval = setInterval(() => {
    callback(mockSessionSequence.next());
  }, 2500);
  return () => clearInterval(interval);
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<NotificationSettings>("get_notification_settings");
  }
  return {
    waiting_permission: true,
    stalled_session: false,
    subagent_completed: false,
    rate_limit_warning: true,
    rate_limit_reached: true,
  };
}

export async function setNotificationSettings(settings: NotificationSettings): Promise<void> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_notification_settings", { settings });
  }
}

export async function getHistoryEnabled(): Promise<boolean> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<boolean>("get_history_enabled");
  }
  return true;
}

export async function setHistoryEnabled(enabled: boolean): Promise<void> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_history_enabled", { enabled });
  }
}

export async function clearAllData(): Promise<void> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("clear_all_data");
  }
}

export async function getSqlitePath(): Promise<string> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("get_sqlite_path");
  }
  return "(not running inside the Tauri app)";
}

export type SetupPreview = {
  settingsPath: string;
  before: unknown;
  after: unknown;
  summary: {
    hooksAdded: string[];
    hooksAlreadyPresent: string[];
    statusLineApplied: boolean;
    statusLineSkippedReason?: string;
    changed: boolean;
  };
};

export async function previewClaudeSetup(): Promise<SetupPreview | null> {
  if (!inTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  const raw = await invoke<{
    settings_path: string;
    before: unknown;
    after: unknown;
    summary: {
      hooks_added: string[];
      hooks_already_present: string[];
      status_line_applied: boolean;
      status_line_skipped_reason?: string;
      changed: boolean;
    };
  }>("preview_claude_setup");
  return {
    settingsPath: raw.settings_path,
    before: raw.before,
    after: raw.after,
    summary: {
      hooksAdded: raw.summary.hooks_added,
      hooksAlreadyPresent: raw.summary.hooks_already_present,
      statusLineApplied: raw.summary.status_line_applied,
      statusLineSkippedReason: raw.summary.status_line_skipped_reason,
      changed: raw.summary.changed,
    },
  };
}

export async function applyClaudeSetup(): Promise<void> {
  if (!inTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("apply_claude_setup");
}

export async function revertClaudeSetup(): Promise<{ reverted: boolean; reason?: string }> {
  if (!inTauri()) return { reverted: false, reason: "not running inside the app" };
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("revert_claude_setup");
}

export function isRunningInTauri(): boolean {
  return inTauri();
}
