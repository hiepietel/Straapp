import { apiGet } from "./api";
import type { StatisticsReport } from "../types/statistics";
import type { SportGroupId } from "../utils/sports";

export interface StatisticsQuery {
  year: number;
  /** Any earlier year; the API defaults to the year before. */
  compareYear?: number | undefined;
  /** Leave out for all sports. */
  sport?: SportGroupId | undefined;
  /** The viewer's local date, "YYYY-MM-DD", so "this week" matches their calendar. */
  today: string;
}

/** Computed by the API from its database; never reaches Strava. */
export function fetchStatistics({ year, compareYear, sport, today }: StatisticsQuery): Promise<StatisticsReport> {
  return apiGet<StatisticsReport>("/api/statistics", { year, compareYear, sport, today });
}
