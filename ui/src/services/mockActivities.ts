import { encodePolyline } from "../utils/polyline";
import type { LatLng } from "../utils/polyline";
import type {
  Activity,
  ActivityDetail,
  ActivityStreams,
  Athlete,
  AthleteZones,
  Split,
  SportType,
  StreamData,
} from "../types/strava";

/** Returns a float in [0, 1). */
type Random = () => number;

/** An inclusive-ish `[min, max]` span to draw a value from. */
type Range = readonly [min: number, max: number];

// Small seeded random generator so demo data is stable between reloads.
function mulberry32(seed: number): Random {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rnd: Random, [min, max]: Range): number => min + rnd() * (max - min);

const pick = <T,>(rnd: Random, items: readonly T[]): T => items[Math.floor(rnd() * items.length)]!;

function makeLoop(rnd: Random, size: number): string {
  const p1 = rnd() * 6;
  const p2 = rnd() * 6;
  const a2 = 0.15 + rnd() * 0.25;
  const a3 = 0.08 + rnd() * 0.15;
  const stretch = 0.5 + rnd() * 0.8;
  const points: LatLng[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = size * (1 + a2 * Math.sin(2 * a + p1) + a3 * Math.sin(3 * a + p2));
    points.push([48 + r * Math.cos(a) * stretch, 20 + r * Math.sin(a)]);
  }
  return encodePolyline(points);
}

/** How a sport's average speed is drawn; each variant burns exactly one draw. */
type SpeedModel =
  | { kind: "pace"; range: Range } // minutes per km
  | { kind: "kmh"; range: Range } // km per hour
  | { kind: "pace100"; range: Range }; // seconds per 100 m

function speedFrom(rnd: Random, model: SpeedModel): number {
  switch (model.kind) {
    case "pace":
      return 1000 / (between(rnd, model.range) * 60);
    case "kmh":
      return between(rnd, model.range) / 3.6;
    case "pace100":
      return 100 / between(rnd, model.range);
  }
}

/** A sport that covers ground, so it has a distance and a route. */
interface MovingTemplate {
  names: readonly string[];
  km: Range;
  speed: SpeedModel;
  elev?: Range;
  /** Rough radius of the generated route loop, in degrees. Omit for no map. */
  size?: number;
}

/** A sport measured only by time on the clock. */
interface StationaryTemplate {
  names: readonly string[];
  durationSec: Range;
}

type SportTemplate = MovingTemplate | StationaryTemplate;

const TEMPLATES = {
  Run: {
    names: ["Morning run", "Easy run", "Tempo run", "Long run", "Lunch run"],
    km: [5, 16],
    speed: { kind: "pace", range: [4.9, 6.2] },
    elev: [15, 150],
    size: 0.02,
  },
  TrailRun: {
    names: ["Forest trail run", "Hill repeats"],
    km: [8, 18],
    speed: { kind: "pace", range: [5.6, 7] },
    elev: [150, 500],
    size: 0.03,
  },
  Ride: {
    names: ["Evening ride", "Weekend ride", "Coffee ride", "Hill loop"],
    km: [20, 75],
    speed: { kind: "kmh", range: [22, 31] },
    elev: [100, 700],
    size: 0.07,
  },
  Walk: {
    names: ["Lunch walk", "Evening walk"],
    km: [2, 6],
    speed: { kind: "kmh", range: [4.4, 5.4] },
    elev: [5, 60],
    size: 0.012,
  },
  Hike: {
    names: ["Weekend hike", "Ridge hike"],
    km: [8, 20],
    speed: { kind: "kmh", range: [3.4, 4.4] },
    elev: [250, 900],
    size: 0.035,
  },
  Swim: {
    names: ["Pool swim"],
    km: [0.8, 2],
    speed: { kind: "pace100", range: [100, 130] },
  },
  WeightTraining: {
    names: ["Strength session"],
    durationSec: [2400, 4200],
  },
} as const satisfies Record<string, SportTemplate>;

type MockSportType = keyof typeof TEMPLATES;

const SEQUENCE = [
  "Run",
  "Ride",
  "Run",
  "Walk",
  "Run",
  "WeightTraining",
  "Ride",
  "Run",
  "Swim",
  "TrailRun",
  "Run",
  "Hike",
] as const satisfies readonly MockSportType[];

export function buildMockActivities(count = 480): Activity[] {
  const day = 24 * 3600 * 1000;
  const now = new Date();
  now.setUTCHours(18, 0, 0, 0);

  return Array.from({ length: count }, (_, i): Activity => {
    const rnd = mulberry32(i + 7);
    const sportType: SportType = SEQUENCE[i % SEQUENCE.length]!;
    const template: SportTemplate = TEMPLATES[SEQUENCE[i % SEQUENCE.length]!];
    const name = pick(rnd, template.names);
    const start = new Date(now.getTime() - i * 1.6 * day - rnd() * 6 * 3600 * 1000);

    let distance = 0;
    let speed = 0;
    let movingTime: number;

    if ("km" in template) {
      distance = Math.round(between(rnd, template.km) * 1000);
      speed = speedFrom(rnd, template.speed);
      movingTime = Math.round(distance / speed);
    } else {
      movingTime = Math.round(between(rnd, template.durationSec));
    }

    return {
      id: 9000000000 + i,
      name,
      sport_type: sportType,
      gear_id: mockGearFor(sportType, i),
      distance,
      moving_time: movingTime,
      elapsed_time: movingTime + Math.round(rnd() * 400),
      total_elevation_gain:
        "elev" in template && template.elev ? Math.round(between(rnd, template.elev)) : 0,
      average_speed: speed,
      start_date_local: start.toISOString(),
      private: rnd() < 0.15,
      map: {
        summary_polyline: "size" in template && template.size ? makeLoop(rnd, template.size) : "",
      },
    };
  });
}

/** Which demo gear an activity used: older runs were in a pair of shoes since retired. */
// Picked from the index, not the activity's random stream, so the rest of the demo data is unchanged.
function mockGearFor(type: SportType, index: number): string | null {
  switch (type) {
    case "Run":
      return index > 300 ? "g3" : "g1";
    case "TrailRun":
    case "Hike":
      return "g2";
    case "Ride":
      return index % 10 < 3 ? "b2" : "b1";
    default:
      return null;
  }
}

export const mockActivities: Activity[] = buildMockActivities();

export const mockAthlete: Athlete = {
  id: 12345678,
  firstname: "Alex",
  lastname: "Runner",
  city: "Boulder",
  state: "Colorado",
  country: "United States",
  sex: "M",
  premium: true,
  summit: true,
  created_at: "2019-04-12T00:00:00Z",
  weight: 71,
  ftp: 255,
  follower_count: 128,
  friend_count: 94,
  measurement_preference: "meters",
  profile: "https://i.pravatar.cc/256?img=13",
  profile_medium: "https://i.pravatar.cc/128?img=13",
  bikes: [
    { id: "b1", name: "Canyon Endurace CF SL", distance: 4_820_000, primary: true },
    { id: "b2", name: "Trek Checkpoint (gravel)", distance: 1_230_000, primary: false },
  ],
  shoes: [
    { id: "g1", name: "Nike Pegasus 40", distance: 1_012_000, primary: true },
    { id: "g2", name: "Hoka Speedgoat 5", distance: 705_000, primary: false },
  ],
};

export const mockAthleteZones: AthleteZones = {
  heart_rate: {
    custom_zones: true,
    zones: [
      { min: 0, max: 123 },
      { min: 124, max: 143 },
      { min: 144, max: 162 },
      { min: 163, max: 176 },
      { min: 177, max: -1 },
    ],
  },
  power: {
    zones: [
      { min: 0, max: 137 },
      { min: 138, max: 188 },
      { min: 189, max: 226 },
      { min: 227, max: 264 },
      { min: 265, max: 314 },
      { min: 315, max: 391 },
      { min: 392, max: -1 },
    ],
  },
};

const DESCRIPTIONS = [
  "Felt strong today. Legs loosened up after the first few kilometres.",
  "Bit windy on the exposed sections, but the sun made up for it.",
  "Took it easy and kept the heart rate down.",
  "Slow start, finished faster than I began.",
];

function buildSplits(rnd: Random, activity: Activity, heartRate: number): Split[] {
  const full = Math.floor(activity.distance / 1000);
  const rest = activity.distance - full * 1000;
  const count = full + (rest >= 50 ? 1 : 0);
  const climbPerSplit = activity.total_elevation_gain / Math.max(count, 1);

  return Array.from({ length: count }, (_, i): Split => {
    const distance = i < full ? 1000 : Math.round(rest);
    const speed = activity.average_speed * between(rnd, [0.9, 1.1]);
    const time = Math.round(distance / speed);
    return {
      split: i + 1,
      distance,
      moving_time: time,
      elapsed_time: time,
      elevation_difference: Math.round(between(rnd, [-1, 1]) * climbPerSplit * 1.5),
      average_speed: speed,
      average_heartrate: Math.round(heartRate + between(rnd, [-6, 6])),
    };
  });
}

/** The extra fields Strava returns for a single activity, made up but stable per activity. */
export function buildMockDetail(activity: Activity): ActivityDetail {
  const rnd = mulberry32(activity.id);
  const type = activity.sport_type ?? activity.type ?? "";
  const isRun = type === "Run" || type === "TrailRun";
  const isRide = type === "Ride";
  const hasDistance = activity.distance > 0;
  const minutes = activity.moving_time / 60;

  const averageHeartRate = Math.round(between(rnd, [128, 164]));
  const lowestPoint = Math.round(between(rnd, [20, 300]));

  return {
    ...activity,
    description: pick(rnd, DESCRIPTIONS),
    calories: Math.round(minutes * between(rnd, isRide ? [8, 11] : [7, 12])),
    average_heartrate: averageHeartRate,
    max_heartrate: averageHeartRate + Math.round(between(rnd, [12, 28])),
    device_name: isRide ? "Garmin Edge 840" : hasDistance ? "Garmin Forerunner 265" : "Strava App",
    ...(activity.average_speed > 0 && {
      max_speed: activity.average_speed * between(rnd, [1.2, 1.7]),
    }),
    ...(isRun && { average_cadence: between(rnd, [80, 90]), gear: { name: "Pegasus 40" } }),
    ...(isRide && { average_cadence: between(rnd, [78, 95]), average_watts: between(rnd, [140, 230]) }),
    ...(isRide && { gear: { name: "Endurace CF" } }),
    ...(isRide && {
      kilojoules: Math.round(between(rnd, [140, 230]) * activity.moving_time / 1000),
      max_watts: Math.round(between(rnd, [450, 800])),
      weighted_average_watts: Math.round(between(rnd, [150, 250])),
    }),
    suffer_score: Math.round(minutes * between(rnd, [0.5, 1.4])),
    average_temp: Math.round(between(rnd, [4, 26])),
    athlete_count: rnd() < 0.7 ? 1 : 2 + Math.floor(rnd() * 5),
    kudos_count: Math.floor(rnd() * 30),
    comment_count: Math.floor(rnd() * 4),
    achievement_count: Math.floor(rnd() * 6),
    pr_count: Math.floor(rnd() * 3),
    ...(activity.total_elevation_gain > 0 && {
      elev_low: lowestPoint,
      elev_high: lowestPoint + Math.round(activity.total_elevation_gain * between(rnd, [0.5, 0.9])),
    }),
    ...(hasDistance &&
      type !== "Swim" && { splits_metric: buildSplits(rnd, activity, averageHeartRate) }),
    map: {
      ...activity.map,
      // Same shape as the summary; the real API returns a denser version of it.
      polyline: activity.map?.summary_polyline ?? "",
    },
  };
}

export function getMockActivityDetail(id: number): ActivityDetail {
  const activity = mockActivities.find((a) => a.id === id);
  if (!activity) throw new Error("Activity not found.");
  return buildMockDetail(activity);
}

// ---- streams (for the charts) ----

const toStream = (data: number[]): StreamData => ({
  data,
  series_type: "distance",
  original_size: data.length,
  resolution: "medium",
});

/**
 * A believable wobble: a couple of low-frequency sine waves (so it has real shape, not just
 * noise) plus a light per-step wander that's pulled back toward zero each step (so it can't
 * drift away from the intended range). Not physically simulated — just plausible to look at.
 */
function wobble(rnd: Random, n: number, base: number, amplitude: number, jitter: number): number[] {
  const f1 = 1 + rnd() * 2;
  const f2 = 3 + rnd() * 3;
  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;
  let drift = 0;
  return Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    drift = (drift + (rnd() - 0.5) * jitter) * 0.8;
    const wave = 0.6 * Math.sin(f1 * t * Math.PI * 2 + p1) + 0.4 * Math.sin(f2 * t * Math.PI * 2 + p2);
    return base + amplitude * wave + drift;
  });
}

/** Starts low and climbs to steady-state over the first ~10%, the way a heart rate actually does. */
function heartRateSeries(rnd: Random, n: number, avg: number): number[] {
  return wobble(rnd, n, avg, 8, 2.5).map((v, i) => {
    const t = n > 1 ? i / (n - 1) : 1;
    const warmup = Math.min(1, t / 0.1);
    return Math.round(avg - (1 - warmup) * 20 + (v - avg) * warmup);
  });
}

/** Second-by-second-ish streams for the activity's charts, roughly consistent with its summary
 *  stats. Only built for activities that actually cover ground. */
export function buildMockStreams(activity: ActivityDetail): ActivityStreams {
  if (activity.distance <= 0) return {};

  const rnd = mulberry32(activity.id + 1); // offset from the detail's own seed
  const n = Math.min(200, Math.max(24, Math.round(activity.distance / 50)));
  const distance = Array.from({ length: n }, (_, i) => Math.round((activity.distance * i) / (n - 1 || 1)));

  const streams: ActivityStreams = { distance: toStream(distance) };

  if (activity.elev_low !== undefined && activity.elev_high !== undefined) {
    const mid = (activity.elev_low + activity.elev_high) / 2;
    const amp = Math.max((activity.elev_high - activity.elev_low) / 2, 1);
    streams.altitude = toStream(wobble(rnd, n, mid, amp, amp * 0.06).map((v) => Math.round(v)));
  }

  if (activity.average_speed > 0) {
    const speed = activity.average_speed;
    streams.velocity_smooth = toStream(
      wobble(rnd, n, speed, speed * 0.15, speed * 0.03).map((v) => Math.max(speed * 0.3, v))
    );
  }

  if (activity.average_heartrate !== undefined) {
    streams.heartrate = toStream(heartRateSeries(rnd, n, activity.average_heartrate));
  }

  if (activity.average_cadence !== undefined) {
    const cadence = activity.average_cadence;
    streams.cadence = toStream(
      wobble(rnd, n, cadence, cadence * 0.08, 1.5).map((v) => Math.max(0, Math.round(v)))
    );
  }

  if (activity.average_watts !== undefined) {
    const watts = activity.average_watts;
    streams.watts = toStream(
      wobble(rnd, n, watts, watts * 0.3, watts * 0.06).map((v) => Math.max(0, Math.round(v)))
    );
  }

  return streams;
}

export function getMockActivityStreams(id: number): ActivityStreams {
  return buildMockStreams(getMockActivityDetail(id));
}
