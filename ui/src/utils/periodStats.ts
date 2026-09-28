import { formatDistance, formatElevation } from "./format";

/*
 * Measures for comparing a period with the one before it. The totals themselves come
 * from the API (see types/statistics.ts).
 */

export type Metric = "distance" | "time" | "elevation" | "count";

export const METRIC_LABELS: Record<Metric, string> = {
  distance: "Distance",
  time: "Time",
  elevation: "Elevation",
  count: "Activities",
};

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

/** A total, in the metric's own unit. */
export function formatMetric(metric: Metric, value: number): string {
  switch (metric) {
    case "distance":
      return formatDistance(value);
    case "time":
      return formatHours(value);
    case "elevation":
      return formatElevation(value);
    case "count":
      return Math.round(value).toLocaleString();
  }
}

/** A shorter form for axis ticks. */
export function formatMetricTick(metric: Metric, value: number): string {
  switch (metric) {
    case "distance":
      return `${Math.round(value / 1000).toLocaleString()} km`;
    case "time":
      return `${Math.round(value / 3600)} h`;
    case "elevation":
      return `${Math.round(value).toLocaleString()} m`;
    case "count":
      return String(Math.round(value));
  }
}

/**
 * "Now" on the same wall-clock-as-UTC scale as Strava's start_date_local (the athlete's local
 * time labelled as UTC), so it is read with the UTC getters whatever this browser's time zone is.
 */
export const localNow = (): Date => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);

/** Relative change from `before` to `now`; null when there's nothing to compare against. */
export const change = (now: number, before: number): number | null => (before > 0 ? (now - before) / before : null);
