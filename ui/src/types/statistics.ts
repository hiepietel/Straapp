/**
 * `GET /api/statistics`: ready-made totals computed by the API from the synced activities.
 * Dates are local calendar days ("2026-09-28"); every range's end is exclusive.
 */

import type { SportGroupId } from "../utils/sports";

/** Every measure at once, so switching between them needs no new request. */
export interface Totals {
  count: number;
  /** Metres. */
  distance: number;
  /** Seconds. */
  movingTime: number;
  /** Metres. */
  elevation: number;
}

/** A period so far, against the previous one up to the same day. */
export interface PeriodComparison {
  period: "week" | "month" | "year";
  start: string;
  end: string;
  current: Totals;
  previousStart: string;
  previousEnd: string;
  previous: Totals;
}

export interface MonthTotals {
  /** 1–12. */
  month: number;
  /** Null for months that haven't started yet. */
  current: Totals | null;
  /** The same month of each year being compared with, in `compareYears` order. */
  compared: Totals[];
  /** The month before; for January, December of the year before. */
  previousMonth: Totals;
}

/** An ISO week (Monday start). */
export interface WeekTotals {
  week: number;
  /** The Monday. */
  start: string;
  /** Null for weeks that haven't started yet. */
  current: Totals | null;
  /** The same week number in each year being compared with, in `compareYears` order; null when it has none (week 53). */
  compared: (Totals | null)[];
  /** For week 1, the last week of the year before. */
  previousWeek: Totals;
}

export interface YearTotals {
  year: number;
  /** The whole year (so far, for the current one). */
  total: Totals;
  /** 1 January up to today's date in that year, for comparing a year in progress fairly. */
  toDate: Totals;
}

export interface StatisticsReport {
  year: number;
  /** The years months and weeks are compared with, newest first. */
  compareYears: number[];
  /** Null means all sports. */
  sport: SportGroupId | null;
  today: string;
  /** Sports with any stored activity, for the filter. */
  sports: SportGroupId[];
  /** Years with any stored activity, newest first, plus the current year. */
  availableYears: number[];
  /** This week, month and year so far. */
  toDate: PeriodComparison[];
  months: MonthTotals[];
  weeks: WeekTotals[];
  /** Every year from the first stored activity to now, oldest first. */
  years: YearTotals[];
}
