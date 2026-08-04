import type { ClaudeSession } from "../../types/domain";
import { StatusBadge } from "../../components/StatusBadge";
import { SourceBadge } from "../../components/SourceBadge";
import { ContextBar } from "../../components/ContextBar";
import { SubagentTree } from "../../components/SubagentTree";
import { formatRelativeTime } from "../../lib/format";

type Props = {
  session: ClaudeSession;
};

export function SessionCard({ session }: Props) {
  const isStopped = session.status === "stopped";
  return (
    <article
      className={`session-card${isStopped ? " is-stopped" : ""}`}
      data-testid="session-card"
      data-status={session.status}
    >
      <div className="session-header-row">
        <span className="session-project-name" title={session.projectName}>
          {session.projectName}
        </span>
        <SourceBadge source={session.statusSource} />
      </div>
      <div className="session-meta-line">
        <StatusBadge status={session.status} isEstimated={session.statusSource === "estimated"} />
        <span>·</span>
        <span>{session.model ?? "model unknown"}</span>
        {session.pid !== undefined && (
          <>
            <span>·</span>
            <span>PID {session.pid}</span>
          </>
        )}
        {session.isStale && (
          <>
            <span>·</span>
            <span title="しばらく活動が確認できていません">stale</span>
          </>
        )}
      </div>
      {session.cwd && <div className="session-cwd">{session.cwd}</div>}
      <div className="session-meta-line" style={{ marginTop: 2 }}>
        <span>最終活動: {formatRelativeTime(session.lastActivityAt)}</span>
      </div>

      {session.context && <ContextBar context={session.context} />}

      <SubagentTree subagents={session.subagents} />
    </article>
  );
}
