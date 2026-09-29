/*
 * The counting behind the general statistics page. Everything works on the activities the filters
 * let through, so a new filter is just a new call.
 */

import type { InsightActivity } from "../types/insights";

const DAY_MS = 24 * 3600 * 1000;

/** The local calendar day an activity started on, "2026-09-27". */
export const dayOf = (a: InsightActivity): string => a.start.slice(0, 10);

/** Local wall-clock time on a UTC scale, so calendar maths never meets a time zone. */
const wallClock = (a: InsightActivity) => new Date(`${a.start}Z`);

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Monday of the week the day is in. */
export const weekOf = (day: string): string => {
  const d = new Date(`${day}T00:00:00Z`);
  return addDays(day, -((d.getUTCDay() + 6) % 7));
};

// ---- Measures a histogram can count by

export type MeasureId = "distance" | "time" | "elevation" | "speed";

export interface Measure {
  id: MeasureId;
  label: string;
  unit: string;
  /** The value in `unit`, or null when the activity has none worth counting (no distance, say). */
  value: (a: InsightActivity) => number | null;
  /** Bucket widths on offer, in `unit`. */
  steps: readonly number[];
}

export const MEASURES: Record<MeasureId, Measure> = {
  distance: {
    id: "distance",
    label: "Distance",
    unit: "km",
    value: (a) => (a.distance > 0 ? a.distance / 1000 : null),
    steps: [0.5, 1, 2, 5, 10, 25],
  },
  time: {
    id: "time",
    label: "Moving time",
    unit: "min",
    value: (a) => (a.movingTime > 0 ? a.movingTime / 60 : null),
    steps: [5, 10, 15, 30, 60],
  },
  elevation: {
    id: "elevation",
    label: "Elevation gain",
    unit: "m",
    value: (a) => (a.distance > 0 ? a.elevation : null),
    steps: [10, 25, 50, 100, 250, 500],
  },
  speed: {
    id: "speed",
    label: "Average speed",
    unit: "km/h",
    value: (a) => (a.distance > 0 && a.averageSpeed > 0 ? a.averageSpeed * 3.6 : null),
    steps: [0.5, 1, 2, 5],
  },
};

/** The value at a percentile (0–1) of a sorted list. */
export const quantile = (sorted: readonly number[], p: number): number =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]! : 0;

/** A bucket width that gives at most `maxBins` bars over the range: the smallest on offer that does. */
export function autoStep(measure: Measure, from: number, to: number, maxBins = 60): number {
  return measure.steps.find((s) => (to - from) / s <= maxBins) ?? measure.steps[measure.steps.length - 1]!;
}

/** A sensible default range: from 0 up to where 98% of the values are, rounded out to the step. */
export function defaultRange(values: readonly number[], measure: Measure): { from: number; to: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const top = quantile(sorted, 0.98);
  const step = autoStep(measure, 0, top);
  return { from: 0, to: Math.max(step, Math.ceil(top / step) * step) };
}

export interface Bin {
  /** Inclusive. */
  from: number;
  /** Exclusive (the last bin also takes a value exactly at the range's end). */
  to: number;
  activities: InsightActivity[];
}

export interface Histogram {
  bins: Bin[];
  below: number;
  above: number;
  /** The fullest bin; the first of equals. */
  mode: Bin | null;
  median: number | null;
}

/** Counts activities per bucket of `step` from `from` to `to`, in the measure's unit. */
export function histogram(
  activities: readonly InsightActivity[],
  measure: Measure,
  from: number,
  to: number,
  step: number
): Histogram {
  const count = Math.max(1, Math.ceil((to - from) / step - 1e-9));
  const bins: Bin[] = Array.from({ length: count }, (_, i) => ({ from: from + i * step, to: from + (i + 1) * step, activities: [] }));
  let below = 0;
  let above = 0;
  const values: number[] = [];
  for (const a of activities) {
    const v = measure.value(a);
    if (v === null) continue;
    values.push(v);
    if (v < from) below++;
    else if (v > to) above++;
    else bins[Math.min(count - 1, Math.floor((v - from) / step + 1e-9))]!.activities.push(a);
  }
  values.sort((a, b) => a - b);
  const mode = bins.reduce<Bin | null>((best, b) => (b.activities.length > (best?.activities.length ?? 0) ? b : best), null);
  return { bins, below, above, mode, median: values.length ? quantile(values, 0.5) : null };
}

// ---- Totals

export interface Totals {
  count: number;
  distance: number;
  movingTime: number;
  elevation: number;
  activeDays: number;
}

export function totals(activities: readonly InsightActivity[]): Totals {
  return {
    count: activities.length,
    distance: activities.reduce((s, a) => s + a.distance, 0),
    movingTime: activities.reduce((s, a) => s + a.movingTime, 0),
    elevation: activities.reduce((s, a) => s + a.elevation, 0),
    activeDays: new Set(activities.map(dayOf)).size,
  };
}

/** Totals per key (sport type, gear…), biggest distance first. */
export function totalsBy(
  activities: readonly InsightActivity[],
  key: (a: InsightActivity) => string
): { key: string; totals: Totals }[] {
  const groups = new Map<string, InsightActivity[]>();
  for (const a of activities) {
    const k = key(a);
    const list = groups.get(k);
    if (list) list.push(a);
    else groups.set(k, [a]);
  }
  return [...groups]
    .map(([k, list]) => ({ key: k, totals: totals(list) }))
    .sort((a, b) => b.totals.distance - a.totals.distance || b.totals.count - a.totals.count);
}

// ---- Habits

export interface Streaks {
  /** Most days in a row with at least one activity, with the first and last of them. */
  longest: { days: number; from: string; to: string } | null;
  /** The run of days up to today (or yesterday, if today is still to come). */
  current: number;
  /** The week (Monday) with the most distance. */
  bestWeek: { week: string; totals: Totals } | null;
  /** The month ("2026-09") with the most distance. */
  bestMonth: { month: string; totals: Totals } | null;
  /** The day with the most activities. */
  busiestDay: { day: string; count: number } | null;
  /** Share of days in the period without an activity. */
  restShare: number | null;
}

export function streaks(activities: readonly InsightActivity[], period: { from: string; to: string }): Streaks {
  const days = [...new Set(activities.map(dayOf))].sort();

  let longest: Streaks["longest"] = null;
  let runStart = days[0];
  for (let i = 0; i < days.length; i++) {
    const day = days[i]!;
    if (i > 0 && addDays(days[i - 1]!, 1) !== day) runStart = day;
    const length = Math.round((Date.parse(day) - Date.parse(runStart!)) / DAY_MS) + 1;
    if (!longest || length > longest.days) longest = { days: length, from: runStart!, to: day };
  }

  const active = new Set(days);
  let current = 0;
  let cursor = active.has(period.to) ? period.to : addDays(period.to, -1);
  while (active.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const best = <K extends string>(key: (a: InsightActivity) => string, name: K) => {
    const top = totalsBy(activities, key)[0];
    return top ? ({ [name]: top.key, totals: top.totals } as Record<K, string> & { totals: Totals }) : null;
  };

  const perDay = totalsBy(activities, dayOf).sort((a, b) => b.totals.count - a.totals.count)[0];
  const periodDays = Math.round((Date.parse(period.to) - Date.parse(period.from)) / DAY_MS) + 1;

  return {
    longest,
    current,
    bestWeek: best((a) => weekOf(dayOf(a)), "week"),
    bestMonth: best((a) => a.start.slice(0, 7), "month"),
    busiestDay: perDay ? { day: perDay.key, count: perDay.totals.count } : null,
    restShare: periodDays > 0 ? Math.max(0, 1 - active.size / periodDays) : null,
  };
}

/** How many activities started in each hour of each weekday: [Monday..Sunday][0..23]. */
export function weekHourGrid(activities: readonly InsightActivity[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const a of activities) {
    const t = wallClock(a);
    grid[(t.getUTCDay() + 6) % 7]![t.getUTCHours()]!++;
  }
  return grid;
}

// ---- Records

export interface ActivityRecord {
  title: string;
  activity: InsightActivity;
  value: number;
}

/** The standout activities; each only when some activity has that figure at all. */
export function records(activities: readonly InsightActivity[]): ActivityRecord[] {
  const top = (title: string, value: (a: InsightActivity) => number | null, eligible = (_: InsightActivity) => true) => {
    let best: ActivityRecord | null = null;
    for (const a of activities) {
      const v = eligible(a) ? value(a) : null;
      if (v !== null && v > 0 && (!best || v > best.value)) best = { title, activity: a, value: v };
    }
    return best;
  };
  return [
    top("Longest distance", (a) => a.distance),
    top("Longest moving time", (a) => a.movingTime),
    top("Most climbing", (a) => a.elevation),
    // A short sprint shouldn't hold the record for a whole sport.
    top("Fastest average", (a) => a.averageSpeed, (a) => a.distance >= 5000),
    top("Top speed", (a) => a.maxSpeed),
    top("Highest average heart rate", (a) => a.averageHeartrate),
  ].filter((r): r is ActivityRecord => r !== null);
}

/** Distances worth counting how often you've gone past, up to the longest you've done. */
export function milestones(activities: readonly InsightActivity[]): { km: number; count: number }[] {
  const longest = Math.max(0, ...activities.map((a) => a.distance / 1000));
  return [5, 10, 21.1, 42.2, 50, 100, 150, 200, 300]
    .filter((km) => km <= longest)
    .map((km) => ({ km, count: activities.filter((a) => a.distance / 1000 >= km).length }));
}
