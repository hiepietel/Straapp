import { percentile, rampColor } from "./colorRamp";
import type { ColorRamp } from "./colorRamp";
import { lowerBound } from "./routeFraction";
import type { SurfaceClass } from "./roadSurface";

/** A measure recorded along the activity, to colour the route by. */
export interface RouteMeasure {
  title: string;
  /** Metres, ascending; indexed the same as `values`. */
  distance: readonly number[];
  values: readonly number[];
  format: (v: number) => string;
}

/** Where the colour scale starts and ends — a few outliers shouldn't wash the rest out. */
export interface MeasureScale {
  low: number;
  high: number;
}

export const measureScale = (m: RouteMeasure): MeasureScale => ({
  low: percentile(m.values, 0.05),
  high: percentile(m.values, 0.95),
});

/** Gradient colours come in this many steps, so neighbouring points can share one line. */
const COLOR_STEPS = 24;

/** The measure's colour (0–1 along the ramp) at each route point, found by distance fraction. */
export function measureAtPoints(m: RouteMeasure, pointFractions: readonly number[], scale: MeasureScale): number[] {
  const total = m.distance[m.distance.length - 1] || 1;
  const streamFractions = m.distance.map((d) => d / total);
  const span = scale.high - scale.low || 1;
  return pointFractions.map((f) => {
    const v = m.values[Math.min(lowerBound(streamFractions, f), m.values.length - 1)]!;
    return Math.round(Math.min(1, Math.max(0, (v - scale.low) / span)) * (COLOR_STEPS - 1)) / (COLOR_STEPS - 1);
  });
}

export const SURFACE_DASH: Record<SurfaceClass, string | undefined> = {
  paved: undefined,
  unpaved: "10 8",
  unknown: "1 8",
};

/** A stretch of the route drawn with one style: points `from`..`to` inclusive. */
export interface StyledRun {
  from: number;
  to: number;
  color: string;
  surface: SurfaceClass | null;
}

/**
 * Splits the route into as few lines as possible, each with a single colour and dash —
 * Leaflet can't vary either along one line. Each segment takes the style of its start point.
 */
export function styleRuns(
  count: number,
  options: { color: string; ramp?: ColorRamp; levels?: readonly number[]; surfaces?: readonly SurfaceClass[] | null }
): StyledRun[] {
  const { color, ramp, levels, surfaces } = options;
  const colorAt = (i: number) => (ramp && levels ? rampColor(ramp, levels[i]!) : color);
  const surfaceAt = (i: number) => surfaces?.[i] ?? null;

  const runs: StyledRun[] = [];
  for (let i = 0; i < count - 1; i++) {
    const c = colorAt(i);
    const s = surfaceAt(i);
    const last = runs[runs.length - 1];
    if (last && last.color === c && last.surface === s) last.to = i + 1;
    else runs.push({ from: i, to: i + 1, color: c, surface: s });
  }
  return runs;
}
