import type { RateLimitState } from "../../types/domain";
import { formatPercentage, formatResetTime } from "../../lib/format";

type Props = {
  rateLimits: RateLimitState;
};

export function RateLimitHeader({ rateLimits }: Props) {
  if (rateLimits.availability === "unavailable") {
    return (
      <div className="rate-limit-bar" data-testid="rate-limit-unavailable">
        <span className="rate-limit-unavailable" title={rateLimits.unavailableReason}>
          Rate limit: Unavailable（ローカルで取得可能な公式情報がありません）
        </span>
      </div>
    );
  }

  return (
    <div className="rate-limit-bar" data-testid="rate-limit-bar">
      {rateLimits.fiveHour && (
        <span className="rate-limit-window">
          5 hours {formatPercentage(rateLimits.fiveHour.usedPercentage)} · Reset{" "}
          {formatResetTime(rateLimits.fiveHour.resetsAt)}
        </span>
      )}
      {rateLimits.sevenDay && (
        <span className="rate-limit-window">
          7 days {formatPercentage(rateLimits.sevenDay.usedPercentage)} · Reset{" "}
          {formatResetTime(rateLimits.sevenDay.resetsAt)}
        </span>
      )}
    </div>
  );
}
