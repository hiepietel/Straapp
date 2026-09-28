import { useCallback, useEffect, useState } from "react";
import { fetchActivities } from "../services/stravaApi";
import { getErrorMessage } from "../utils/errors";
import type { Activity } from "../types/strava";

const PER_PAGE = 200; // Strava's max

export type SinceStatus = "loading" | "ready" | "error";

/**
 * Every activity since `after` (epoch seconds), fetched page by page until Strava runs out.
 * Statistics need the whole period, not just the first page the list shows.
 */
export function useActivitiesSince(after: number): {
  activities: Activity[];
  status: SinceStatus;
  error: string | null;
  /** How many have arrived so far, for a progress message on long histories. */
  loaded: number;
  retry: () => void;
} {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [status, setStatus] = useState<SinceStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setLoaded(0);

    (async () => {
      const all: Activity[] = [];
      for (let page = 1; ; page++) {
        const batch = await fetchActivities({ page, perPage: PER_PAGE, after });
        if (cancelled) return;
        all.push(...batch);
        setLoaded(all.length);
        if (batch.length < PER_PAGE) break;
      }
      setActivities(all);
      setStatus("ready");
    })().catch((err: unknown) => {
      if (cancelled) return;
      setError(getErrorMessage(err));
      setStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [after, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { activities, status, error, loaded, retry };
}
