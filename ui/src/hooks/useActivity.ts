import { useCallback, useEffect, useState } from "react";
import { fetchActivity } from "../services/activitiesApi";
import { getErrorMessage } from "../utils/errors";
import type { ActivityDetail } from "../types/strava";

export type ActivityStatus = "loading" | "ready" | "error";

export interface UseActivityResult {
  status: ActivityStatus;
  activity: ActivityDetail | null;
  error: string | null;
  retry: () => void;
}

export function useActivity(id: number): UseActivityResult {
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [status, setStatus] = useState<ActivityStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Bumped by retry() to re-run the effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);

    fetchActivity(id)
      .then((data) => {
        if (!active) return;
        setActivity(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getErrorMessage(err));
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, activity, error, retry };
}
