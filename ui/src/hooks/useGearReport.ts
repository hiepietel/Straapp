import { useCallback, useEffect, useState } from "react";
import { fetchGearReport } from "../services/gearApi";
import type { GearReport } from "../types/gear";
import { getErrorMessage } from "../utils/errors";

export type GearReportStatus = "loading" | "ready" | "error";

/** The gear report: one request, everything the gear page shows. */
export function useGearReport(today: string): {
  report: GearReport | null;
  status: GearReportStatus;
  error: string | null;
  retry: () => void;
} {
  const [report, setReport] = useState<GearReport | null>(null);
  const [status, setStatus] = useState<GearReportStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchGearReport(today)
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
  }, [today, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { report, status, error, retry };
}
