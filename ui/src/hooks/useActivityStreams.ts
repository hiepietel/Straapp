import { useCallback, useEffect, useState } from "react";
import { fetchActivityStreams } from "../services/activitiesApi";
import { getErrorMessage } from "../utils/errors";
import type { ActivityStreams } from "../types/strava";

export type StreamsStatus = "loading" | "ready" | "error";

export interface UseActivityStreamsResult {
  status: StreamsStatus;
  streams: ActivityStreams | null;
  error: string | null;
  retry: () => void;
}

// Kept separate from useActivity: the charts are a nice-to-have layered on top of the
// activity itself, so a streams failure (or an activity with none, e.g. no GPS) shouldn't
// block anything else on the page.
export function useActivityStreams(id: number): UseActivityStreamsResult {
  const [streams, setStreams] = useState<ActivityStreams | null>(null);
  const [status, setStatus] = useState<StreamsStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Bumped by retry() to re-run the effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);

    fetchActivityStreams(id)
      .then((data) => {
        if (!active) return;
        setStreams(data);
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

  return { status, streams, error, retry };
}
