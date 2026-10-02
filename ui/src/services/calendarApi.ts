import { apiGet } from "./api";
import type { CalendarReport } from "../types/calendar";

/** Activity history and daily totals for a local-date range; the end date is exclusive. */
export function fetchCalendarReport(from: string, to: string): Promise<CalendarReport> {
  return apiGet<CalendarReport>("/api/calendar", { from, to });
}