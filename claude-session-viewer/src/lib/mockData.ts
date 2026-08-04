import type { ClaudeSession, RateLimitState } from "../types/domain";

/**
 * A small scripted sequence used only when the UI is opened outside of the
 * real Tauri app (plain browser `vite dev`, component tests). It exists so
 * layout/styling work doesn't require a running Claude Code session. This is
 * NOT the `npm run simulate` tool — that one drives the real Rust backend
 * through genuine NDJSON/JSONL files, see simulator/simulate.ts and README.
 */

const now = () => new Date().toISOString();

function frontendSession(overrides: Partial<ClaudeSession>): ClaudeSession {
  return {
    id: "mock-frontend",
    projectName: "frontend",
    cwd: "~/projects/frontend",
    model: "Opus 5",
    status: "thinking",
    statusSource: "official_hook",
    statusConfidence: "high",
    startedAt: now(),
    lastActivityAt: now(),
    context: {
      usedTokens: 144_000,
      maxTokens: 200_000,
      usedPercentage: 72,
      inputTokens: 2,
      outputTokens: 1682,
      cacheReadTokens: 0,
      cacheWriteTokens: 51392,
      compactionCount: 0,
      source: "transcript",
      confidence: "medium",
    },
    subagents: [
      {
        id: "sub-1",
        parentSessionId: "mock-frontend",
        type: "Explore",
        status: "running",
        startedAt: new Date(Date.now() - 84_000).toISOString(),
        source: "transcript",
      },
      {
        id: "sub-2",
        parentSessionId: "mock-frontend",
        type: "Test Runner",
        status: "completed",
        startedAt: new Date(Date.now() - 200_000).toISOString(),
        stoppedAt: new Date(Date.now() - 157_000).toISOString(),
        durationMs: 43_000,
        source: "transcript",
      },
    ],
    isStale: false,
    ...overrides,
  };
}

function backendSession(overrides: Partial<ClaudeSession>): ClaudeSession {
  return {
    id: "mock-backend",
    projectName: "backend",
    cwd: "~/projects/backend",
    model: "Sonnet 5",
    status: "waiting_user",
    statusSource: "official_hook",
    statusConfidence: "high",
    startedAt: now(),
    lastActivityAt: now(),
    context: {
      usedTokens: 82_000,
      maxTokens: 200_000,
      usedPercentage: 41,
      source: "transcript",
      confidence: "medium",
    },
    subagents: [],
    isStale: false,
    ...overrides,
  };
}

const frames: ClaudeSession[][] = [
  [frontendSession({}), backendSession({})],
  [frontendSession({ status: "using_tool", statusSource: "official_hook" }), backendSession({})],
  [
    frontendSession({ status: "waiting_permission", statusSource: "official_hook" }),
    backendSession({}),
  ],
  [frontendSession({}), backendSession({ status: "thinking" })],
];

let index = 0;
export const mockSessionSequence = {
  current(): ClaudeSession[] {
    return frames[index];
  },
  next(): ClaudeSession[] {
    index = (index + 1) % frames.length;
    return frames[index];
  },
};

export const mockRateLimits: RateLimitState = {
  availability: "unavailable",
  unavailableReason:
    "Claude Code / Claude.ai の利用制限をローカルかつオフラインで取得できる公式な方法が確認できていないため非表示です。",
  source: "estimated",
};
