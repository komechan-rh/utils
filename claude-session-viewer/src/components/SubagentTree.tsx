import type { Subagent } from "../types/domain";
import { formatDuration } from "../lib/format";
import { useNow } from "../hooks/useNow";

type Props = {
  subagents: Subagent[];
};

const STATUS_LABEL: Record<Subagent["status"], string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  unknown: "Unknown",
};

export function SubagentTree({ subagents }: Props) {
  const hasRunning = subagents.some((s) => s.status === "running");
  // Only subscribe to the ticking clock when something is actually running,
  // so a card with only completed subagents never re-renders on a timer.
  const now = useNow(hasRunning ? 1000 : 60_000);

  if (subagents.length === 0) {
    return <div className="no-subagents">No active subagents</div>;
  }

  return (
    <div className="subagent-tree" data-testid="subagent-tree">
      <div className="subagent-tree-title">Subagents</div>
      {subagents.map((sub) => {
        const duration =
          sub.durationMs ??
          (sub.status === "running" && sub.startedAt
            ? now - new Date(sub.startedAt).getTime()
            : undefined);
        return (
          <div className="subagent-row" key={sub.id} data-testid="subagent-row">
            <span className="subagent-type">{sub.type ?? "unknown"}</span>
            <span className="subagent-status">{STATUS_LABEL[sub.status]}</span>
            <span className="subagent-duration">{formatDuration(duration)}</span>
          </div>
        );
      })}
    </div>
  );
}
