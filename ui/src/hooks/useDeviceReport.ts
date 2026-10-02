import { useCallback, useEffect, useState } from "react";
import { fetchDeviceReport } from "../services/devicesApi";
import type { DeviceReport } from "../types/devices";
import { getErrorMessage } from "../utils/errors";

export type DeviceReportStatus = "loading" | "ready" | "error";

export function useDeviceReport(today: string): {
  report: DeviceReport | null;
  status: DeviceReportStatus;
  error: string | null;
  retry: () => void;
} {
  const [report, setReport] = useState<DeviceReport | null>(null);
  const [status, setStatus] = useState<DeviceReportStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchDeviceReport(today)
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