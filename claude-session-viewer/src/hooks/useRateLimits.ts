import { useEffect, useState } from "react";
import type { RateLimitState } from "../types/domain";
import { getRateLimits } from "../lib/tauri";

const POLL_INTERVAL_MS = 30_000;

export function useRateLimits(): RateLimitState | null {
  const [rateLimits, setRateLimits] = useState<RateLimitState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => getRateLimits().then((r) => !cancelled && setRateLimits(r));
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return rateLimits;
}
