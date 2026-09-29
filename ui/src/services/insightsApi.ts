import { apiGet } from "./api";
import { isDemo } from "./auth";
import { mockActivities } from "./mockActivities";
import { getGroup, sportTypeOf } from "../utils/sports";
import type { InsightsReport } from "../types/insights";

/** Prepared by the API from its database; never reaches Strava. */
export function fetchInsights(): Promise<InsightsReport> {
  if (isDemo) return Promise.resolve(demoInsights());
  return apiGet<InsightsReport>("/api/insights");
}

function demoInsights(): InsightsReport {
  const activities = mockActivities
    .map((a) => ({
      id: a.id,
      name: a.name,
      sportType: sportTypeOf(a),
      sport: getGroup(a),
      // Mock times are local wall-clock labelled as UTC, like Strava's.
      start: a.start_date_local.slice(0, 19),
      distance: a.distance,
      movingTime: a.moving_time,
      elapsedTime: a.elapsed_time,
      elevation: a.total_elevation_gain,
      averageSpeed: a.average_speed,
      maxSpeed: null,
      averageHeartrate: null,
      gearId: a.gear_id ?? null,
      commute: false,
      trainer: false,
      private: a.private ?? false,
      weather: null,
    }))
    .reverse();
  const gearIds = [...new Set(activities.flatMap((a) => (a.gearId ? [a.gearId] : [])))];
  return {
    activities,
    gear: gearIds.map((id) => ({
      id,
      name: id.startsWith("b") ? `Demo bike ${id.slice(1)}` : `Demo shoes ${id.slice(1)}`,
      kind: id.startsWith("b") ? "bike" : "shoes",
      retired: false,
    })),
  };
}
