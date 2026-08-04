/**
 * Pure merge logic shared by the `npm run setup:claude` CLI
 * (scripts/setup-claude.ts). This mirrors the Rust implementation in
 * src-tauri/src/claude_config/mod.rs — same contract (additive only, never
 * overwrite an existing statusLine, idempotent), reimplemented here so the
 * CLI works standalone without requiring the Tauri binary to be built.
 *
 * Kept side-effect-free (no fs access) so it's unit-testable on its own;
 * scripts/setup-claude.ts does the actual file I/O.
 */

export const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "PreCompact",
  "Stop",
  "SubagentStop",
  "SessionEnd",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonObject = Record<string, any>;

export type MergeSummary = {
  hooksAdded: string[];
  hooksAlreadyPresent: string[];
  statusLineApplied: boolean;
  statusLineSkippedReason?: string;
  changed: boolean;
};

export function mergeClaudeSettings(
  existing: JsonObject,
  hookRelayCommand: (eventName: string) => string,
  statusLineCommand: string,
): { before: JsonObject; after: JsonObject; summary: MergeSummary } {
  const before = structuredClone(existing);
  const after: JsonObject = structuredClone(existing);
  const summary: MergeSummary = {
    hooksAdded: [],
    hooksAlreadyPresent: [],
    statusLineApplied: false,
    changed: false,
  };

  if (typeof after.hooks !== "object" || after.hooks === null || Array.isArray(after.hooks)) {
    after.hooks = {};
  }

  for (const event of HOOK_EVENTS) {
    const cmd = hookRelayCommand(event);
    if (!Array.isArray(after.hooks[event])) {
      after.hooks[event] = [];
    }
    const groups: JsonObject[] = after.hooks[event];
    const alreadyPresent = groups.some(
      (group) =>
        Array.isArray(group?.hooks) &&
        group.hooks.some((h: JsonObject) => h?.command === cmd),
    );
    if (alreadyPresent) {
      summary.hooksAlreadyPresent.push(event);
      continue;
    }
    groups.push({ matcher: "", hooks: [{ type: "command", command: cmd }] });
    summary.hooksAdded.push(event);
  }

  if (after.statusLine === undefined || after.statusLine === null) {
    after.statusLine = { type: "command", command: statusLineCommand };
    summary.statusLineApplied = true;
  } else {
    summary.statusLineSkippedReason = "既存の statusLine 設定を上書きしないため未変更";
  }

  summary.changed = JSON.stringify(before) !== JSON.stringify(after);
  return { before, after, summary };
}
