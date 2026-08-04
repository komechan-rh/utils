import { useState } from "react";
import { useSessions } from "../hooks/useSessions";
import { useRateLimits } from "../hooks/useRateLimits";
import { SessionList } from "../features/sessions/SessionList";
import { RateLimitHeader } from "../features/rate-limits/RateLimitHeader";
import { SettingsPanel } from "../features/settings/SettingsPanel";

export function App() {
  const sessions = useSessions();
  const rateLimits = useRateLimits();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title-row">
          <span className="app-title">Claude Session Viewer</span>
          <button
            className="icon-button"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="settings"
            data-testid="settings-toggle"
          >
            {showSettings ? "✕" : "⚙"}
          </button>
        </div>
        {rateLimits && <RateLimitHeader rateLimits={rateLimits} />}
      </header>

      {showSettings ? <SettingsPanel /> : <SessionList sessions={sessions} />}
    </div>
  );
}
