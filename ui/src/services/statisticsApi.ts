import { apiGet } from "./api";
import type { StatisticsReport } from "../types/statistics";

export interface StatisticsQuery {
  year: number;
  /** Earlier years to compare with, newest first; the API defaults to the year before. */
  compareYears: readonly number[];
  /** Strava sport types to count; empty for all. */
  sportTypes: readonly string[];
  /** The viewer's local date, "YYYY-MM-DD", so "this week" matches their calendar. */
  today: string;
}

/** Computed by the API from its database; never reaches Strava. */
export function fetchStatistics({ year, compareYears, sportTypes, today }: StatisticsQuery): Promise<StatisticsReport> {
  return apiGet<StatisticsReport>("/api/statistics", { year, compareYears, sportTypes, today });
}
