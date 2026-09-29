import { useCallback, useEffect, useState } from "react";
import { fetchStatistics } from "../services/statisticsApi";
import type { StatisticsQuery } from "../services/statisticsApi";
import type { StatisticsReport } from "../types/statistics";
import { getErrorMessage } from "../utils/errors";

export type StatisticsStatus = "loading" | "ready" | "error";

/**
 * The statistics report for a year and sport. When either changes, the previous report stays
 * on screen until the new one arrives, so the page doesn't flash a spinner on every click.
 */
export function useStatistics({ year, compareYears, sportTypes, today }: StatisticsQuery): {
  report: StatisticsReport | null;
  status: StatisticsStatus;
  /** A newer report is on its way while `report` is still the old one. */
  refreshing: boolean;
  error: string | null;
  retry: () => void;
} {
  const [report, setReport] = useState<StatisticsReport | null>(null);
  const [status, setStatus] = useState<StatisticsStatus>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A new array arrives on every render: fetch again only when the years themselves change.
  const comparedKey = compareYears.join(",");
  const typesKey = [...sportTypes].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    setError(null);

    fetchStatistics({
      year,
      compareYears: comparedKey ? comparedKey.split(",").map(Number) : [],
      sportTypes: typesKey ? typesKey.split(",") : [],
      today,
    })
      .then((next) => {
        if (cancelled) return;
        setReport(next);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
        setStatus((current) => (current === "ready" ? "ready" : "error"));
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year, comparedKey, typesKey, today, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { report, status, refreshing, error, retry };
}
