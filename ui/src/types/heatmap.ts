/**
 * `GET /api/heatmap`: every route in a date range, prepared by the API from the synced activities.
 * Dates are local calendar days ("2026-09-28").
 */

import type { GearKind } from "./gear";
import type { SportGroupId } from "../utils/sports";

export interface HeatmapRoute {
  id: number;
  name: string;
  /** Strava's sport type, e.g. "GravelRide". */
  sportType: string;
  sport: SportGroupId;
  date: string;
  /** Metres. */
  distance: number;
  gearId: string | null;
  /** Google-encoded, simplified route. */
  polyline: string;
}

export interface HeatmapGear {
  id: string;
  name: string;
  kind: GearKind;
  retired: boolean;
}

export interface HeatmapReport {
  /** Oldest first; only activities with a route (not indoor or manual ones). */
  routes: HeatmapRoute[];
  /** The gear those routes used, most used first. */
  gear: HeatmapGear[];
}
