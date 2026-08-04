#!/usr/bin/env -S npx tsx
/**
 * `npm run setup:claude` / `npm run setup:claude:revert`
 *
 * Standalone CLI for wiring Claude Code's hooks + statusLine to this app,
 * without needing the Tauri binary built. Same in-app Settings screen does
 * the same thing (via src-tauri/src/claude_config/mod.rs) for users who
 * prefer a GUI; this CLI exists per the task's explicit "npm run
 * setup:claude" requirement and for headless/CI use.
 *
 * Always shows a diff and asks for confirmation before writing, always
 * backs up the previous file first, never overwrites unrelated keys.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
  unlinkSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { mergeClaudeSettings } from "./setupClaudeConfig.ts";

function claudeHome(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

function appDataDir(): string {
  if (process.env.CLAUDE_SESSION_VIEWER_DATA_DIR) return process.env.CLAUDE_SESSION_VIEWER_DATA_DIR;
  const id = "dev.komechan.claude-session-viewer";
  switch (platform()) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", id);
    case "win32":
      return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), id);
    default:
      return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), id);
  }
}

function shellQuote(path: string): string {
  return `'${path.replaceAll("'", "'\\''")}'`;
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf-8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function confirm(question: string): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

async function applySetup() {
  const dataDir = appDataDir();
  const settingsPath = join(claudeHome(), "settings.json");
  mkdirSync(dataDir, { recursive: true });

  const hookRelaySrc = join(dirname(new URL(import.meta.url).pathname), "hook-relay.sh");
  const statusLineSrc = join(dirname(new URL(import.meta.url).pathname), "status-line.sh");
  const hookRelayDest = join(dataDir, "hook-relay.sh");
  const statusLineDest = join(dataDir, "status-line.sh");
  copyFileSync(hookRelaySrc, hookRelayDest);
  copyFileSync(statusLineSrc, statusLineDest);
  chmodSync(hookRelayDest, 0o755);
  chmodSync(statusLineDest, 0o755);

  const existing = readJson(settingsPath);
  const { before, after, summary } = mergeClaudeSettings(
    existing,
    (event) => `sh ${shellQuote(hookRelayDest)} ${event}`,
    `sh ${shellQuote(statusLineDest)}`,
  );

  console.log(`settings.json: ${settingsPath}`);
  console.log(`追加される hooks: ${summary.hooksAdded.join(", ") || "(none)"}`);
  console.log(`既に設定済み: ${summary.hooksAlreadyPresent.join(", ") || "(none)"}`);
  console.log(
    `statusLine: ${summary.statusLineApplied ? "追加" : (summary.statusLineSkippedReason ?? "変更なし")}`,
  );

  if (!summary.changed) {
    console.log("変更はありません。");
    return;
  }

  console.log("\n--- 差分 (適用後の settings.json) ---");
  console.log(JSON.stringify(after, null, 2));

  const ok = await confirm("\nこの内容を ~/.claude/settings.json に書き込みますか？");
  if (!ok) {
    console.log("キャンセルしました。ファイルは変更されていません。");
    return;
  }

  const backupsDir = join(dataDir, "backups");
  mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupsDir, `settings.json.${stamp}.bak`);
  writeFileSync(backupPath, existsSync(settingsPath) ? JSON.stringify(before, null, 2) : "__DID_NOT_EXIST__");
  writeFileSync(join(dataDir, "last-backup-path.txt"), backupPath);

  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(after, null, 2)}\n`);
  console.log(`書き込みました。バックアップ: ${backupPath}`);
}

async function revertSetup() {
  const dataDir = appDataDir();
  const settingsPath = join(claudeHome(), "settings.json");
  const markerPath = join(dataDir, "last-backup-path.txt");
  if (!existsSync(markerPath)) {
    console.log("設定を変更した記録が見つかりません。");
    return;
  }
  const backupPath = readFileSync(markerPath, "utf-8").trim();
  if (!existsSync(backupPath)) {
    console.log("バックアップファイルが見つかりません。");
    return;
  }
  const contents = readFileSync(backupPath, "utf-8");
  const ok = await confirm(`${settingsPath} をバックアップから復元しますか？`);
  if (!ok) {
    console.log("キャンセルしました。");
    return;
  }
  if (contents === "__DID_NOT_EXIST__") {
    if (existsSync(settingsPath)) unlinkSync(settingsPath);
    console.log("導入前は settings.json が存在しなかったため削除しました。");
  } else {
    writeFileSync(settingsPath, contents);
    console.log("復元しました。");
  }
}

async function main() {
  if (process.argv.includes("--revert")) {
    await revertSetup();
  } else {
    await applySetup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
