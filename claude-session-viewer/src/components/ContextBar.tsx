import type { ContextUsage } from "../types/domain";
import { formatPercentage, formatTokens } from "../lib/format";
import { SourceBadge } from "./SourceBadge";

type Props = {
  context: ContextUsage;
};

export function ContextBar({ context }: Props) {
  const pct =
    context.usedPercentage ??
    (context.usedTokens && context.maxTokens
      ? (context.usedTokens / context.maxTokens) * 100
      : undefined);

  const fillClass =
    pct !== undefined && pct >= 90
      ? "is-critical"
      : pct !== undefined && pct >= 75
        ? "is-high"
        : "";

  return (
    <div className="context-block" data-testid="context-bar">
      <div className="context-label-row">
        <span>
          Context
          {context.usedTokens !== undefined && context.maxTokens !== undefined
            ? ` ${formatTokens(context.usedTokens)} / ${formatTokens(context.maxTokens)}`
            : ""}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {formatPercentage(pct)}
          <SourceBadge source={context.source} />
        </span>
      </div>
      <div className="context-bar-track">
        <div
          className={`context-bar-fill ${fillClass}`}
          style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
          role="progressbar"
          aria-valuenow={pct !== undefined ? Math.round(pct) : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
