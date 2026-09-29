import { useCallback, useEffect, useState } from "react";
import { fetchInsights } from "../services/insightsApi";
import type { InsightsReport } from "../types/insights";
import { getErrorMessage } from "../utils/errors";

export type InsightsStatus = "loading" | "ready" | "error";

/** Every activity's headline figures: one request; the page counts from it. */
export function useInsights(): { report: InsightsReport | null; status: InsightsStatus; error: string | null; retry: () => void } {
  const [report, setReport] = useState<InsightsReport | null>(null);
  const [status, setStatus] = useState<InsightsStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    fetchInsights()
      .then((next) => {
        if (cancelled) return;
        setReport(next);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { report, status, error, retry };
}
