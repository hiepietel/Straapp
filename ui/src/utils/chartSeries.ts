import { formatSportSpeed } from "./activityStats";
import { formatElevation, formatHeartRate, formatPower } from "./format";
import type { SportGroupId } from "./sports";
import type { ActivityStreams } from "../types/strava";

/** Everything the charts can plot against distance. */
export type SeriesKey = "altitude" | "speed" | "heartrate" | "watts" | "cadence";

export const SERIES_KEYS: readonly SeriesKey[] = ["altitude", "speed", "heartrate", "watts", "cadence"];

export const isSeriesKey = (value: unknown): value is SeriesKey =>
  SERIES_KEYS.includes(value as SeriesKey);

// One fixed colour per measure (colour follows the measure, never its position in a chart),
// so switching lines on and off never repaints the others. Checked with the dataviz palette
// validator: every pair clears the normal-vision floor; the heart-rate/speed pair is only
// in the colour-blind "floor" band, so every line is also named in the legend and tooltip.
export const SERIES_COLORS: Record<SeriesKey, string> = {
  altitude: "#2a78d6",
  speed: "#1baf7a",
  heartrate: "#e34948",
  watts: "#eda100",
  cadence: "#4a3aa7",
};

const SPEED_LABEL: Record<SportGroupId, string> = {
  run: "Pace",
  walk: "Pace",
  ride: "Speed",
  swim: "Pace",
  other: "Speed",
};

// Cadence is stored raw (per-leg for runs — see types/strava.ts); double it for runs/walks
// the same way activityStats.ts's cadenceStat does for the detail-page stat.
const cadenceFormat = (group: SportGroupId) => (v: number) =>
  group === "ride" ? `${Math.round(v)} rpm` : `${Math.round(v * 2)} spm`;

export interface ChartSeries {
  key: SeriesKey;
  title: string;
  color: string;
  values: readonly number[];
  /** Elevation reads best as terrain: a filled area rather than a bare line. */
  variant: "line" | "area";
  format: (v: number) => string;
}

/** The series this activity actually recorded, in a fixed order. */
export function buildChartSeries(streams: ActivityStreams, group: SportGroupId): ChartSeries[] {
  const candidates: Array<Omit<ChartSeries, "values" | "color"> & { values: number[] | undefined }> = [
    { key: "altitude", title: "Elevation", values: streams.altitude?.data, variant: "area", format: formatElevation },
    {
      key: "speed",
      title: SPEED_LABEL[group],
      values: streams.velocity_smooth?.data,
      variant: "line",
      format: (v) => formatSportSpeed(group, v),
    },
    { key: "heartrate", title: "Heart rate", values: streams.heartrate?.data, variant: "line", format: formatHeartRate },
    { key: "watts", title: "Power", values: streams.watts?.data, variant: "line", format: formatPower },
    { key: "cadence", title: "Cadence", values: streams.cadence?.data, variant: "line", format: cadenceFormat(group) },
  ];

  return candidates
    .filter((c): c is typeof c & { values: number[] } => (c.values?.length ?? 0) >= 2)
    .map((c) => ({ ...c, color: SERIES_COLORS[c.key] }));
}
