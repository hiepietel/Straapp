import type { Activity } from "../types/strava";

/*
 * How each bike and pair of shoes has been used, worked out from the activity history.
 * Dates follow start_date_local's wall-clock-as-UTC convention (see periodStats.ts).
 */

export type GearKind = "bike" | "shoes";

/** Strava gear ids say what they are: "b…" for bikes, "g…" for shoes. */
export const gearKind = (id: string): GearKind => (id.startsWith("b") ? "bike" : "shoes");

export interface GearInfo {
  id: string;
  name: string;
  kind: GearKind;
  /** Strava's own lifetime total, metres. */
  lifetimeDistance: number;
  primary: boolean;
  retired: boolean;
  color: string;
}

// The dataviz reference categorical palette, in its validated order. Colour follows the
// gear (assigned once, by overall distance), never its position in a filtered view.
const GEAR_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
/** Past eight items there are no more distinct hues; the rest share a neutral grey. */
export const OVERFLOW_COLOR = "#8a949a";

export const gearColor = (rank: number): string => GEAR_PALETTE[rank] ?? OVERFLOW_COLOR;

export interface GearUsage {
  count: number;
  /** Metres. */
  distance: number;
  /** Seconds. */
  time: number;
  /** Metres. */
  elevation: number;
  first: Date;
  last: Date;
  longest: Activity;
}

const dateOf = (a: Activity) => new Date(a.start_date_local);

/** Totals per gear id, over whatever activities are given. */
export function usageByGear(activities: readonly Activity[]): Map<string, GearUsage> {
  const usage = new Map<string, GearUsage>();
  for (const a of activities) {
    if (!a.gear_id) continue;
    const d = dateOf(a);
    const u = usage.get(a.gear_id);
    if (!u) {
      usage.set(a.gear_id, {
        count: 1,
        distance: a.distance,
        time: a.moving_time,
        elevation: a.total_elevation_gain,
        first: d,
        last: d,
        longest: a,
      });
      continue;
    }
    u.count++;
    u.distance += a.distance;
    u.time += a.moving_time;
    u.elevation += a.total_elevation_gain;
    if (d < u.first) u.first = d;
    if (d > u.last) u.last = d;
    if (a.distance > u.longest.distance) u.longest = a;
  }
  return usage;
}

/** Month starts (UTC midnight on the 1st) from `from`'s month through `to`'s, inclusive. */
export function monthsBetween(from: Date, to: Date): Date[] {
  const months: Date[] = [];
  for (let y = from.getUTCFullYear(), m = from.getUTCMonth(); ; m++) {
    const d = new Date(Date.UTC(y, m, 1));
    if (d > to) break;
    months.push(d);
  }
  return months;
}

/** Distance per month for each gear id, aligned with `months`. */
export function monthlyDistance(
  activities: readonly Activity[],
  gearIds: readonly string[],
  months: readonly Date[]
): Map<string, number[]> {
  const index = new Map(months.map((m, i) => [`${m.getUTCFullYear()}-${m.getUTCMonth()}`, i]));
  const out = new Map(gearIds.map((id) => [id, Array<number>(months.length).fill(0)]));
  for (const a of activities) {
    const series = a.gear_id ? out.get(a.gear_id) : undefined;
    if (!series) continue;
    const d = dateOf(a);
    const i = index.get(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
    if (i !== undefined) series[i]! += a.distance;
  }
  return out;
}

/** Each gear's running total after every activity, oldest first: [time ms, metres]. */
export function cumulativeDistance(activities: readonly Activity[]): Map<string, [number, number][]> {
  const sorted = activities.filter((a) => a.gear_id).sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime());
  const out = new Map<string, [number, number][]>();
  const totals = new Map<string, number>();
  for (const a of sorted) {
    const id = a.gear_id!;
    const total = (totals.get(id) ?? 0) + a.distance;
    totals.set(id, total);
    const points = out.get(id);
    if (points) points.push([dateOf(a).getTime(), total]);
    else out.set(id, [[dateOf(a).getTime(), total]]);
  }
  return out;
}
