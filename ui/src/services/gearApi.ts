import { apiGet } from "./api";
import type { GearReport } from "../types/gear";

/** Prepared by the API from its database; never reaches Strava. `today` is the viewer's local date. */
export function fetchGearReport(today: string): Promise<GearReport> {
  return apiGet<GearReport>("/api/gear", { today });
}
