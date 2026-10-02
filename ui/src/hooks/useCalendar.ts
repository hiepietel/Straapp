import { useCallback, useEffect, useState } from "react";
import { fetchCalendarReport } from "../services/calendarApi";
import type { CalendarReport } from "../types/calendar";
import { getErrorMessage } from "../utils/errors";

export type CalendarStatus = "loading" | "ready" | "error";

export function useCalendar(from: string, to: string): {
  report: CalendarReport | null;
  status: CalendarStatus;
  error: string | null;
  retry: () => void;
} {
  const [report, setReport] = useState<CalendarReport | null>(null);
  const [status, setStatus] = useState<CalendarStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchCalendarReport(from, to)
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