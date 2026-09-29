import { useCallback, useEffect, useState } from "react";
import { fetchHeatmap } from "../services/heatmapApi";
import type { HeatmapQuery } from "../services/heatmapApi";
import type { HeatmapReport } from "../types/heatmap";
import { getErrorMessage } from "../utils/errors";

export type HeatmapStatus = "loading" | "ready" | "error";

/** Every route in the date range. The previous range's routes stay until the new ones arrive. */
export function useHeatmap({ from, to }: HeatmapQuery): {
  report: HeatmapReport | null;
  status: HeatmapStatus;
  error: string | null;
  retry: () => void;
} {
  const [report, setReport] = useState<HeatmapReport | null>(null);
  const [status, setStatus] = useState<HeatmapStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchHeatmap({ from, to })
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
  }, [from, to, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { report, status, error, retry };
}
