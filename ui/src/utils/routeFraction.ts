import type { LatLng } from "./polyline";
import type { Split } from "../types/strava";

/**
 * Charts, map and splits all talk about a place on the activity as a *fraction of its
 * distance* (0 = start, 1 = finish). These helpers convert each one's own data to and
 * from that shared scale.
 */

/** A stretch of the activity, as distance fractions. */
export interface FractionRange {
  start: number;
  end: number;
}

/** Each split's stretch of the activity, from the splits' own running distance. */
export function splitRanges(splits: readonly Split[]): FractionRange[] {
  const total = splits.reduce((sum, s) => sum + s.distance, 0) || 1;
  let covered = 0;
  return splits.map((s) => {
    const start = covered / total;
    covered += s.distance;
    return { start, end: covered / total };
  });
}

/** Which range a fraction falls in, or null if none. */
export function rangeIndexAt(ranges: readonly FractionRange[], fraction: number): number | null {
  const i = ranges.findIndex((r) => fraction < r.end);
  if (i !== -1) return i;
  return ranges.length > 0 && fraction <= 1 ? ranges.length - 1 : null;
}

/** Index of the first value >= target in an ascending array (the last index if none is). */
export function lowerBound(sorted: readonly number[], target: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

function haversine([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** How far along the route (0–1) each GPS point is — a polyline carries no distances of its own. */
export function pointFractions(points: readonly LatLng[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1]! + haversine(points[i - 1]!, points[i]!));
  }
  const total = cumulative[cumulative.length - 1] || 1;
  return cumulative.map((d) => d / total);
}
