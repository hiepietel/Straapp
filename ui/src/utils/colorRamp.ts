/** A colour scale for painting the route by a measure, low → high. */
export interface ColorRamp {
  stops: readonly string[];
}

// Slow is cold, fast is hot. No near-white middle: every step has to show on a map.
export const SPEED_RAMP: ColorRamp = {
  stops: ["#2166ac", "#4393c3", "#5ab4ac", "#fdb863", "#e66101", "#b2182b"],
};

// Viridis-like, low purple to high yellow. Not the classic green lowlands — green would
// vanish into the map's own woods and parks.
export const ELEVATION_RAMP: ColorRamp = {
  stops: ["#46327e", "#365c8d", "#277f8e", "#1fa187", "#4ac16d", "#a0da39", "#e8d81c"],
};

const hexToRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb: readonly number[]) =>
  "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/** The colour at `t` (0–1) along the ramp, blended linearly between its stops. */
export function rampColor(ramp: ColorRamp, t: number): string {
  const { stops } = ramp;
  const pos = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(Math.floor(pos), stops.length - 2);
  const a = hexToRgb(stops[i]!);
  const b = hexToRgb(stops[i + 1]!);
  const f = pos - i;
  return toHex(a.map((c, k) => c + (b[k]! - c) * f));
}

/** A CSS gradient of the ramp, for a legend bar. */
export const rampCss = (ramp: ColorRamp): string => `linear-gradient(to right, ${ramp.stops.join(", ")})`;

/** The value at a percentile (0–1) of an unsorted list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]!;
}
