import type { ClaudeSession } from "../../types/domain";
import { SessionCard } from "./SessionCard";
import { EmptyState } from "../../components/EmptyState";

type Props = {
  sessions: ClaudeSession[];
};

/** Running sessions first, then stopped ones, each group newest-activity-first. */
function sortSessions(sessions: ClaudeSession[]): ClaudeSession[] {
  return [...sessions].sort((a, b) => {
    if (a.status === "stopped" && b.status !== "stopped") return 1;
    if (a.status !== "stopped" && b.status === "stopped") return -1;
    const aTime = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const bTime = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    return bTime - aTime;
  });
}

export function SessionList({ sessions }: Props) {
  if (sessions.length === 0) {
    return <EmptyState />;
  }
  return (
    <div className="session-list" data-testid="session-list">
      {sortSessions(sessions).map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}
