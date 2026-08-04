import { useEffect, useState } from "react";
import type { NotificationSettings } from "../../types/domain";
import {
  applyClaudeSetup,
  clearAllData,
  getHistoryEnabled,
  getNotificationSettings,
  getSqlitePath,
  previewClaudeSetup,
  revertClaudeSetup,
  setHistoryEnabled,
  setNotificationSettings,
  type SetupPreview,
} from "../../lib/tauri";

const NOTIFICATION_LABELS: Record<keyof NotificationSettings, { title: string; desc: string }> = {
  waiting_permission: { title: "Permission待ち", desc: "権限確認が必要になったとき" },
  stalled_session: { title: "セッション停止", desc: "しばらく活動が確認できないとき" },
  subagent_completed: { title: "サブエージェント完了", desc: "サブエージェントが完了したとき" },
  rate_limit_warning: { title: "Rate limit 80%超過", desc: "利用制限が80%を超えたとき" },
  rate_limit_reached: { title: "Rate limit 到達", desc: "利用制限に到達したとき" },
};

export function SettingsPanel() {
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [historyEnabled, setHistoryEnabledState] = useState(true);
  const [sqlitePath, setSqlitePath] = useState("");
  const [preview, setPreview] = useState<SetupPreview | null>(null);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);

  useEffect(() => {
    getNotificationSettings().then(setNotifications);
    getHistoryEnabled().then(setHistoryEnabledState);
    getSqlitePath().then(setSqlitePath);
  }, []);

  async function toggleNotification(key: keyof NotificationSettings) {
    if (!notifications) return;
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    await setNotificationSettings(next);
  }

  async function toggleHistory() {
    const next = !historyEnabled;
    setHistoryEnabledState(next);
    await setHistoryEnabled(next);
  }

  async function handleClearData() {
    await clearAllData();
    setSetupMessage("ローカルデータを削除しました");
  }

  async function handlePreview() {
    const result = await previewClaudeSetup();
    setPreview(result);
    setSetupMessage(null);
  }

  async function handleApply() {
    await applyClaudeSetup();
    setSetupMessage("~/.claude/settings.json を更新しました（変更前の内容はバックアップ済みです）");
    setPreview(null);
  }

  async function handleRevert() {
    const result = await revertClaudeSetup();
    setSetupMessage(
      result.reverted ? "設定を元に戻しました" : (result.reason ?? "元に戻せませんでした"),
    );
  }

  return (
    <div className="settings-panel" data-testid="settings-panel">
      <section className="settings-section">
        <h3>Claude Code 連携</h3>
        <p className="settings-row-desc">
          hooks / statusLine を ~/.claude/settings.json
          に追加します。既存の設定は壊さず、変更前に必ずバックアップします。
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={handlePreview}>
            差分を確認
          </button>
          <button className="btn primary" onClick={handleApply}>
            セットアップを適用
          </button>
          <button className="btn danger" onClick={handleRevert}>
            元に戻す
          </button>
        </div>
        {preview && (
          <div className="diff-box mono" data-testid="setup-preview">
            settings: {preview.settingsPath}
            {"\n"}追加される hooks: {preview.summary.hooksAdded.join(", ") || "(none)"}
            {"\n"}既に設定済み: {preview.summary.hooksAlreadyPresent.join(", ") || "(none)"}
            {"\n"}statusLine:{" "}
            {preview.summary.statusLineApplied ? "追加" : preview.summary.statusLineSkippedReason}
          </div>
        )}
        {setupMessage && <p className="settings-row-desc">{setupMessage}</p>}
      </section>

      <section className="settings-section">
        <h3>通知</h3>
        {notifications &&
          (Object.keys(NOTIFICATION_LABELS) as (keyof NotificationSettings)[]).map((key) => (
            <label className="settings-row" key={key}>
              <span className="settings-row-label">
                <span>{NOTIFICATION_LABELS[key].title}</span>
                <span className="settings-row-desc">{NOTIFICATION_LABELS[key].desc}</span>
              </span>
              <input
                type="checkbox"
                checked={notifications[key]}
                onChange={() => toggleNotification(key)}
              />
            </label>
          ))}
      </section>

      <section className="settings-section">
        <h3>プライバシー</h3>
        <label className="settings-row">
          <span className="settings-row-label">
            <span>履歴の保存</span>
            <span className="settings-row-desc">
              無効にすると再起動時にセッション一覧は復元されません
            </span>
          </span>
          <input type="checkbox" checked={historyEnabled} onChange={toggleHistory} />
        </label>
        <div className="settings-row">
          <span className="settings-row-label">
            <span>SQLite 保存場所</span>
            <span className="settings-row-desc mono">{sqlitePath}</span>
          </span>
        </div>
        <button className="btn danger" onClick={handleClearData}>
          ローカルデータを削除
        </button>
      </section>
    </div>
  );
}
