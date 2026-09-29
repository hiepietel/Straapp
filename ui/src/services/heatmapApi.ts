import { apiGet } from "./api";
import { isDemo } from "./auth";
import { mockActivities } from "./mockActivities";
import { getGroup } from "../utils/sports";
import type { HeatmapReport } from "../types/heatmap";

export interface HeatmapQuery {
  /** First local day, "YYYY-MM-DD"; leave out for no lower bound. */
  from?: string | undefined;
  /** Last local day, included; leave out for no upper bound. */
  to?: string | undefined;
}

/** Prepared by the API from its database; never reaches Strava. */
export function fetchHeatmap({ from, to }: HeatmapQuery): Promise<HeatmapReport> {
  if (isDemo) return Promise.resolve(demoHeatmap({ from, to }));
  return apiGet<HeatmapReport>("/api/heatmap", { from, to });
}

function demoHeatmap({ from, to }: HeatmapQuery): HeatmapReport {
  const routes = mockActivities
    .filter((a) => a.map?.summary_polyline)
    .map((a) => ({
      id: a.id,
      name: a.name,
      sportType: a.sport_type ?? a.type ?? "Other",
      sport: getGroup(a),
      date: a.start_date_local.slice(0, 10),
      distance: a.distance,
      gearId: a.gear_id ?? null,
      polyline: a.map!.summary_polyline!,
    }))
    .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
    .reverse();
  const gearIds = [...new Set(routes.flatMap((r) => (r.gearId ? [r.gearId] : [])))];
  return {
    routes,
    gear: gearIds.map((id) => ({
      id,
      name: id.startsWith("b") ? `Demo bike ${id.slice(1)}` : `Demo shoes ${id.slice(1)}`,
      kind: id.startsWith("b") ? "bike" : "shoes",
      retired: false,
    })),
  };
}
