import type { DataSource } from "../types/domain";
import { dataSourceTier } from "../types/domain";
import { SOURCE_TIER_LABEL } from "../lib/status";

const TIER_COLOR_VAR: Record<string, string> = {
  official: "--tier-official",
  observed: "--tier-observed",
  estimated: "--tier-estimated",
  unavailable: "--tier-unavailable",
};

type Props = {
  source: DataSource;
};

/** Small pill making clear whether a value is Official / Observed / Estimated / Unavailable. */
export function SourceBadge({ source }: Props) {
  const tier = dataSourceTier(source);
  return (
    <span
      className="source-badge"
      style={{ color: `var(${TIER_COLOR_VAR[tier]})` }}
      title={`データ取得元: ${source}`}
      data-testid="source-badge"
    >
      {SOURCE_TIER_LABEL[tier]}
    </span>
  );
}
