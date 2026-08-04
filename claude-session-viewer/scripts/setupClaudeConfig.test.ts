import { describe, expect, it } from "vitest";
import { HOOK_EVENTS, mergeClaudeSettings } from "./setupClaudeConfig";

const hookCmd = (event: string) => `sh '/data/hook-relay.sh' ${event}`;
const statusCmd = "sh '/data/status-line.sh'";

describe("mergeClaudeSettings", () => {
  it("adds every hook event and the status line to an empty settings file", () => {
    const { after, summary } = mergeClaudeSettings({}, hookCmd, statusCmd);
    expect(summary.hooksAdded).toHaveLength(HOOK_EVENTS.length);
    expect(summary.statusLineApplied).toBe(true);
    expect(after.hooks.PreToolUse[0].hooks[0].command).toBe(hookCmd("PreToolUse"));
  });

  it("preserves unrelated keys and existing user hooks", () => {
    const existing = {
      permissions: { allow: ["Bash(git *)"] },
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo custom" }] }] },
    };
    const { after } = mergeClaudeSettings(existing, hookCmd, statusCmd);
    expect(after.permissions.allow).toEqual(["Bash(git *)"]);
    expect(after.hooks.PreToolUse).toHaveLength(2);
  });

  it("does not overwrite an existing statusLine", () => {
    const existing = { statusLine: { type: "command", command: "my-custom" } };
    const { after, summary } = mergeClaudeSettings(existing, hookCmd, statusCmd);
    expect(summary.statusLineApplied).toBe(false);
    expect(after.statusLine.command).toBe("my-custom");
  });

  it("is idempotent", () => {
    const { after } = mergeClaudeSettings({}, hookCmd, statusCmd);
    const { summary: summary2 } = mergeClaudeSettings(after, hookCmd, statusCmd);
    expect(summary2.changed).toBe(false);
    expect(summary2.hooksAlreadyPresent).toHaveLength(HOOK_EVENTS.length);
  });
});
