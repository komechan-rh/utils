import { useEffect, useState } from "react";

/** Ticks every `intervalMs` so components can show a live-updating duration
 * without calling `Date.now()` directly during render (which React's rules
 * of hooks/purity linting flags as an impure render). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
