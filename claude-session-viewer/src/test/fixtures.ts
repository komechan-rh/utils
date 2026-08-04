import type { ClaudeSession } from "../types/domain";

export function makeSession(overrides: Partial<ClaudeSession> = {}): ClaudeSession {
  return {
    id: "s1",
    projectName: "demo-project",
    cwd: "/Users/demo/demo-project",
    model: "Sonnet 5",
    status: "thinking",
    statusSource: "official_hook",
    statusConfidence: "high",
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    subagents: [],
    isStale: false,
    ...overrides,
  };
}
