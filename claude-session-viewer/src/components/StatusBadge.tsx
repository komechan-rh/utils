import type { SessionStatus } from "../types/domain";
import { STATUS_COLOR_VAR, STATUS_GLYPH, STATUS_LABEL } from "../lib/status";

type Props = {
  status: SessionStatus;
  isEstimated?: boolean;
};

export function StatusBadge({ status, isEstimated }: Props) {
  return (
    <span
      className="status-pill"
      style={{ color: `var(${STATUS_COLOR_VAR[status]})` }}
      data-testid="status-badge"
    >
      <span className="status-glyph" aria-hidden="true">
        {STATUS_GLYPH[status]}
      </span>
      <span>{STATUS_LABEL[status]}</span>
      {isEstimated && (
        <span title="この状態は推定値です" aria-label="estimated">
          ~
        </span>
      )}
    </span>
  );
}
