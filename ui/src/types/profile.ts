/**
 * `GET /api/profile/totals`: counted by the API from the synced activities, every sport included,
 * split by who can see the activities. Dates are local calendar days ("2026-09-28").
 */

import type { ActivityRef } from "./gear";
import type { Totals } from "./statistics";
import type { SportGroupId } from "../utils/sports";

export type TotalsPeriod = "recent" | "year" | "allTime";

export interface PeriodTotals {
  period: TotalsPeriod;
  /** First day counted; null for all time. */
  from: string | null;
  all: Totals;
  /** Sports with activities in the period, most distance first. */
  sports: { sport: SportGroupId; totals: Totals }[];
}

export interface VisibilityTotals {
  periods: PeriodTotals[];
  longest: ActivityRef | null;
  biggestClimb: ActivityRef | null;
  longestTime: ActivityRef | null;
}

export type Visibility = "all" | "public" | "private";

export interface ProfileTotals {
  today: string;
  all: VisibilityTotals;
  /** Visible to everyone or to followers. */
  public: VisibilityTotals;
  /** Visible only to the athlete. */
  private: VisibilityTotals;
}
