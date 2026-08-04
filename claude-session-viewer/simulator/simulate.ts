#!/usr/bin/env -S npx tsx
/**
 * Development event simulator (`npm run simulate`).
 *
 * Writes real hook NDJSON lines, a real statusline NDJSON line, and a real
 * Claude Code-shaped transcript JSONL file into a sandbox directory, so the
 * Rust backend's actual collectors (not a mocked-up substitute) can be
 * exercised without ever launching a real Claude Code session.
 *
 * Usage:
 *   npm run simulate                 # runs the scripted timeline once
 *   npm run simulate -- --loop       # repeats the timeline every 45s
 *
 * To point a dev build of the app at the sandbox this writes to:
 *   CLAUDE_SESSION_VIEWER_DATA_DIR=$(pwd)/simulator/.sandbox/app-data \
 *   CLAUDE_CONFIG_DIR=$(pwd)/simulator/.sandbox/claude-home \
 *   npm run tauri dev
 *
 * Covers: session start, thinking, tool use, permission wait, subagent
 * start/end, context growth, session end.
 *
 * Not covered: rate limit growth. The app has no local/offline source for
 * Claude subscription rate limits (see README "rate limit表示") and by
 * design never fabricates one, so there is no collector pathway for this
 * simulator to feed — faking it here would contradict that policy.
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const SANDBOX_ROOT = join(import.meta.dirname, ".sandbox");
const CLAUDE_HOME = join(SANDBOX_ROOT, "claude-home");
const APP_DATA_DIR = join(SANDBOX_ROOT, "app-data");
const CWD = "/Users/demo/simulated-project";
const SESSION_ID = randomUUID();

function encodeProjectDir(cwd: string): string {
  return cwd.replaceAll("/", "-");
}

const PROJECTS_DIR = join(CLAUDE_HOME, "projects", encodeProjectDir(CWD));
const TRANSCRIPT_PATH = join(PROJECTS_DIR, `${SESSION_ID}.jsonl`);
const HOOKS_LOG = join(APP_DATA_DIR, "hooks.ndjson");
const STATUS_LOG = join(APP_DATA_DIR, "statusline.ndjson");

function ensureDirs() {
  mkdirSync(PROJECTS_DIR, { recursive: true });
  mkdirSync(APP_DATA_DIR, { recursive: true });
}

function appendJsonLine(path: string, obj: unknown) {
  appendFileSync(path, `${JSON.stringify(obj)}\n`);
}

function appendHookEvent(eventName: string, extra: Record<string, unknown> = {}) {
  appendJsonLine(HOOKS_LOG, {
    hook_event_name: eventName,
    received_at: new Date().toISOString(),
    session_id: SESSION_ID,
    cwd: CWD,
    transcript_path: TRANSCRIPT_PATH,
    ...extra,
  });
}

function appendStatusLine(extra: Record<string, unknown> = {}) {
  appendJsonLine(STATUS_LOG, {
    received_at: new Date().toISOString(),
    session_id: SESSION_ID,
    cwd: CWD,
    model: { display_name: "Sonnet 5", id: "claude-sonnet-5" },
    ...extra,
  });
}

function appendAssistantTurn(usedTokens: number, toolUse?: { id: string; name: string; input: unknown }) {
  const content: unknown[] = [{ type: "text", text: "(simulated assistant turn)" }];
  if (toolUse) {
    content.push({ type: "tool_use", id: toolUse.id, name: toolUse.name, input: toolUse.input });
  }
  appendJsonLine(TRANSCRIPT_PATH, {
    type: "assistant",
    sessionId: SESSION_ID,
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    cwd: CWD,
    message: {
      model: "claude-sonnet-5",
      usage: {
        input_tokens: 50,
        output_tokens: 800,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: usedTokens,
      },
      content,
    },
  });
}

function appendToolResult(toolUseId: string, isError = false) {
  appendJsonLine(TRANSCRIPT_PATH, {
    type: "user",
    sessionId: SESSION_ID,
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    cwd: CWD,
    message: { content: [{ type: "tool_result", tool_use_id: toolUseId, is_error: isError }] },
  });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTimeline() {
  ensureDirs();
  console.log(`[simulate] session ${SESSION_ID}`);
  console.log(`[simulate] transcript: ${TRANSCRIPT_PATH}`);
  console.log(`[simulate] hooks log: ${HOOKS_LOG}`);
  console.log(`[simulate] statusline log: ${STATUS_LOG}`);

  appendHookEvent("SessionStart", { source: "startup" });
  await sleep(500);

  appendHookEvent("UserPromptSubmit", { prompt: "(simulated — never stored by the real app)" });
  appendStatusLine();
  appendAssistantTurn(20_000);
  await sleep(800);

  const bashToolId = `toolu_${randomUUID().slice(0, 8)}`;
  appendHookEvent("PreToolUse", { tool_name: "Bash" });
  appendAssistantTurn(35_000, { id: bashToolId, name: "Bash", input: { command: "npm test" } });
  await sleep(600);
  appendToolResult(bashToolId);
  appendHookEvent("PostToolUse", { tool_name: "Bash" });
  await sleep(500);

  appendHookEvent("Notification", { message: "Claude needs your permission to use Write" });
  await sleep(1200);

  const taskToolId = `toolu_${randomUUID().slice(0, 8)}`;
  appendAssistantTurn(60_000, {
    id: taskToolId,
    name: "Task",
    input: { subagent_type: "Explore", description: "Explore" },
  });
  appendHookEvent("PreToolUse", { tool_name: "Task" });
  await sleep(1500);
  appendToolResult(taskToolId);
  appendHookEvent("SubagentStop", {});
  await sleep(500);

  appendAssistantTurn(90_000);
  appendHookEvent("PreCompact", { trigger: "auto" });
  await sleep(500);

  appendHookEvent("Stop", {});
  await sleep(300);

  appendHookEvent("SessionEnd", { reason: "simulated" });
  console.log("[simulate] timeline complete");
}

async function main() {
  const loop = process.argv.includes("--loop");
  do {
    await runTimeline();
    if (loop) {
      console.log("[simulate] looping again in 45s (Ctrl+C to stop)...");
      await sleep(45_000);
    }
  } while (loop);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
