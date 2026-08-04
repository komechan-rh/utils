import { useEffect, useState } from "react";
import type { ClaudeSession } from "../types/domain";
import { getSessions, onSessionsUpdated } from "../lib/tauri";

export function useSessions(): ClaudeSession[] {
  const [sessions, setSessions] = useState<ClaudeSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    getSessions().then((initial) => {
      if (!cancelled) setSessions(initial);
    });

    const unlistenPromise = onSessionsUpdated((updated) => {
      if (!cancelled) setSessions(updated);
    });

    return () => {
      cancelled = true;
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return sessions;
}
