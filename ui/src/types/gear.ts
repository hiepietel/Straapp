/**
 * `GET /api/gear`: every bike and pair of shoes with its usage, prepared by the API from the
 * synced activities. Dates are local calendar days ("2026-09-28").
 */

import type { Totals } from "./statistics";

export type GearKind = "bike" | "shoes";

/** An activity worth pointing at, such as a bike's longest ride. */
export interface ActivityRef {
  id: number;
  name: string;
  date: string;
  /** Metres. */
  distance: number;
  /** Seconds. */
  movingTime: number;
  /** Metres. */
  elevation: number;
}

export interface GearItem {
  /** Strava's id: "b…" for bikes, "g…" for shoes. */
  id: string;
  name: string;
  kind: GearKind;
  nickname: string | null;
  brandName: string | null;
  modelName: string | null;
  description: string | null;
  primary: boolean;
  retired: boolean;
  /** False when activities mention it but its details haven't been synced yet (or it was deleted). */
  known: boolean;
  /** Strava's own lifetime total, metres; includes activities older than the synced history. */
  stravaDistance: number;
  /** Over the synced activities that used it. */
  totals: Totals;
  firstUsed: string | null;
  lastUsed: string | null;
  longest: ActivityRef | null;
  biggestClimb: ActivityRef | null;
  longestTime: ActivityRef | null;
  /** Per Strava sport type, most distance first. */
  sports: { sportType: string; totals: Totals }[];
  /** Oldest first. */
  years: { year: number; totals: Totals }[];
  /** Palette index, fixed by overall distance so colours don't change with filters. */
  color: number;
}

export interface GearReport {
  today: string;
  /** Most used first. */
  gear: GearItem[];
  /** Every month (first day) from the first use of any gear to now; gear unused that month is absent. */
  months: { month: string; gear: Record<string, Totals> }[];
  /** Each gear's running totals after every day it was used, oldest first. */
  timelines: { gearId: string; points: { date: string; totals: Totals }[] }[];
  /** Synced activities with no gear set. */
  withoutGear: Totals;
  /** The oldest synced activity; totals only cover the synced history. */
  historyFrom: string | null;
}
