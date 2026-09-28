import { useCallback, useEffect, useRef, useState } from "react";
import { fetchActivities } from "../services/stravaApi";
import { getErrorMessage } from "../utils/errors";
import type { Activity } from "../types/strava";

export type ActivitiesStatus = "loading" | "loadingMore" | "ready" | "error";

export interface UseActivitiesResult {
  activities: Activity[];
  status: ActivitiesStatus;
  error: string | null;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
}

export function useActivities(perPage = 200): UseActivitiesResult {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [status, setStatus] = useState<ActivitiesStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Guards against a page being fetched twice in a row before `page` state has caught up —
  // e.g. React StrictMode's dev-mode double-invoke, or a caller (like an effect that keeps
  // asking for more until a date range is covered) calling loadMore() again before the
  // previous call has resolved. A ref updates synchronously, so the second call sees it
  // immediately, unlike state which only takes effect on the next render.
  const loadingRef = useRef(false);

  const load = useCallback(
    async (nextPage: number): Promise<void> => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setStatus(nextPage === 1 ? "loading" : "loadingMore");
      setError(null);
      try {
        const batch = await fetchActivities({ page: nextPage, perPage });
        setActivities((prev) => (nextPage === 1 ? batch : [...prev, ...batch]));
        setPage(nextPage);
        setHasMore(batch.length === perPage);
        setStatus("ready");
      } catch (err: unknown) {
        setError(getErrorMessage(err));
        setStatus("error");
      } finally {
        loadingRef.current = false;
      }
    },
    [perPage]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const refresh = useCallback(() => void load(1), [load]);
  const loadMore = useCallback(() => void load(page + 1), [load, page]);

  return { activities, status, error, hasMore, refresh, loadMore };
}
