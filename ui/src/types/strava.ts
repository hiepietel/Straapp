/**
 * The slice of the Strava API we actually consume.
 * Field names match the wire format, so responses are used as-is.
 */

/** Sport types we give special treatment; Strava may send others. */
export type KnownSportType =
  | "Run"
  | "TrailRun"
  | "VirtualRun"
  | "Ride"
  | "GravelRide"
  | "MountainBikeRide"
  | "EBikeRide"
  | "VirtualRide"
  | "Walk"
  | "Hike"
  | "Swim"
  | "WeightTraining";

/** Any string is valid, but known values still autocomplete. */
export type SportType = KnownSportType | (string & {});

export interface ActivityMap {
  /** Google-encoded polyline; empty or absent for indoor activities. */
  summary_polyline?: string | null;
  /** Full-resolution route. Only present on a single-activity response. */
  polyline?: string | null;
}

export interface Activity {
  id: number;
  name: string;
  /** Current field. Older activities may only carry `type`. */
  sport_type?: SportType;
  /** Legacy field, kept as a fallback for `sport_type`. */
  type?: SportType;
  /** Metres. */
  distance: number;
  /** Seconds. */
  moving_time: number;
  /** Seconds. */
  elapsed_time: number;
  /** Metres. */
  total_elevation_gain: number;
  /** Metres per second. */
  average_speed: number;
  /** Local wall-clock time, but labelled as UTC by Strava. */
  start_date_local: string;
  /** Hidden from other athletes; absent on some older activities, so treat that as public. */
  private?: boolean;
  map?: ActivityMap;
  /** The bike ("b…") or shoes ("g…") used; null/absent when none was set. */
  gear_id?: string | null;
}

/** One kilometre (or the remainder at the end) of an activity. */
export interface Split {
  /** 1-based index. */
  split: number;
  /** Metres; 1000 except for the last, partial split. */
  distance: number;
  /** Seconds. */
  moving_time: number;
  /** Seconds. */
  elapsed_time: number;
  /** Metres gained (+) or lost (-). */
  elevation_difference: number;
  /** Metres per second. */
  average_speed: number;
  average_heartrate?: number;
}

/**
 * What `GET /activities/{id}` adds on top of the list entry.
 * Sensor-based fields are absent when the device didn't record them.
 */
export interface ActivityDetail extends Activity {
  description?: string | null;
  calories?: number;
  /** Metres per second. */
  max_speed?: number;
  /** Beats per minute. */
  average_heartrate?: number;
  max_heartrate?: number;
  /** Runs: steps per minute *per leg* (double it for spm). Rides: rpm. */
  average_cadence?: number;
  average_watts?: number;
  max_watts?: number;
  /** Normalised-style power Strava computes for rides with a power meter. */
  weighted_average_watts?: number;
  /** Total work done, rides only. */
  kilojoules?: number;
  /** Degrees Celsius, from the device's thermometer. */
  average_temp?: number;
  /** Strava's "Relative Effort", from heart rate. */
  suffer_score?: number | null;
  achievement_count?: number;
  pr_count?: number;
  kudos_count?: number;
  comment_count?: number;
  /** Athletes on the activity, including this one — 1 means solo. */
  athlete_count?: number;
  /** Metres above sea level. */
  elev_high?: number;
  elev_low?: number;
  device_name?: string;
  gear?: { name: string } | null;
  splits_metric?: Split[];
}

/** One line of `GET /activities/{id}/streams`, indexed the same as every other stream. */
export interface StreamData {
  data: number[];
  series_type: string;
  original_size: number;
  resolution: string;
}

/** The stream types this app charts; Strava's own list is longer. */
export type StreamType = "distance" | "altitude" | "velocity_smooth" | "heartrate" | "cadence" | "watts";

/** `key_by_type=true` response shape. A key is absent when the device never recorded it. */
export type ActivityStreams = Partial<Record<StreamType, StreamData>>;

/** A bike or pair of shoes logged against the athlete's activities. */
export interface Gear {
  /** Bikes start with "b", shoes with "g". */
  id: string;
  name: string;
  /** Metres, lifetime — including activities from before the app's history window. */
  distance: number;
  /** The default for new activities of its kind. */
  primary?: boolean;
  /** Only set on `GET /gear/{id}`; retired gear isn't listed on the athlete at all. */
  retired?: boolean;
}

/** `GET /gear/{id}`. */
export interface GearDetail extends Gear {
  brand_name?: string | null;
  model_name?: string | null;
  description?: string | null;
}

export interface Athlete {
  id: number;
  firstname: string;
  lastname: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  sex?: "M" | "F" | null;
  premium?: boolean;
  /** Strava's top paid tier; implies `premium`. */
  summit?: boolean;
  /** ISO date-time the account was created. */
  created_at?: string;
  /** Kilograms. */
  weight?: number;
  /** Functional threshold power, watts. Only set for athletes who use power. */
  ftp?: number | null;
  follower_count?: number;
  friend_count?: number;
  measurement_preference?: "feet" | "meters";
  /** 124x124 profile photo. */
  profile?: string;
  /** 62x62 profile photo. Strava always sends one — a generic silhouette if the athlete never set one. */
  profile_medium?: string;
  bikes?: Gear[];
  shoes?: Gear[];
}

/** One band of `GET /athlete/zones`; `max` is `-1` for the open-ended top zone. */
export interface ZoneRange {
  min: number;
  max: number;
}

export interface AthleteZones {
  heart_rate?: { custom_zones: boolean; zones: ZoneRange[] };
  power?: { zones: ZoneRange[] };
}

/** One of the nine totals blocks in `GET /athletes/{id}/stats`. */
export interface ActivityTotal {
  count: number;
  /** Metres. */
  distance: number;
  /** Seconds. */
  moving_time: number;
  /** Seconds. */
  elapsed_time: number;
  /** Metres. */
  elevation_gain: number;
  /** Only present on the "recent" (last 4 weeks) totals. */
  achievement_count?: number;
}

export interface AthleteStats {
  /** Metres. */
  biggest_ride_distance?: number;
  /** Metres. */
  biggest_climb_elevation_gain?: number;
  recent_ride_totals: ActivityTotal;
  recent_run_totals: ActivityTotal;
  recent_swim_totals: ActivityTotal;
  ytd_ride_totals: ActivityTotal;
  ytd_run_totals: ActivityTotal;
  ytd_swim_totals: ActivityTotal;
  all_ride_totals: ActivityTotal;
  all_run_totals: ActivityTotal;
  all_swim_totals: ActivityTotal;
}
