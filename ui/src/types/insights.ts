/**
 * `GET /api/insights`: every stored activity with its headline figures and the weather while it
 * lasted, for the general statistics page, which does its own counting.
 */

import type { SportGroupId } from "../utils/sports";
import type { GearKind } from "./gear";

export interface InsightWeather {
  /** Average while it lasted, °C. */
  temperature: number | null;
  apparentTemperature: number | null;
  /** Total, mm. */
  precipitation: number;
  /** Average, km/h. */
  windSpeed: number | null;
  /** Strongest, km/h. */
  windGusts: number | null;
  /** The most notable WMO code. */
  weatherCode: number | null;
}

export interface InsightActivity {
  id: number;
  name: string;
  /** Strava's sport type, e.g. "MountainBikeRide". */
  sportType: string;
  sport: SportGroupId;
  /** Local wall-clock time, "2026-09-27T18:29:32" (no zone). */
  start: string;
  /** Metres. */
  distance: number;
  /** Seconds. */
  movingTime: number;
  elapsedTime: number;
  /** Metres climbed. */
  elevation: number;
  /** Metres per second. */
  averageSpeed: number;
  maxSpeed: number | null;
  averageHeartrate: number | null;
  gearId: string | null;
  commute: boolean;
  trainer: boolean;
  private: boolean;
  /** Null indoors, or until the weather has been looked up. */
  weather: InsightWeather | null;
}

export interface InsightsReport {
  /** Oldest first. */
  activities: InsightActivity[];
  /** The gear used, most distance first. */
  gear: { id: string; name: string; kind: GearKind; retired: boolean }[];
}
