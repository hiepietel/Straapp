import { mockAthlete, mockAthleteZones } from "./mockActivities";
import { isDemo } from "./auth";
import { apiGet } from "./api";
import type { ProfileTotals } from "../types/profile";
import type { Athlete, AthleteZones } from "../types/strava";

/** `GET /api/profile`: the athlete as last synced, in Strava's format. */
export interface Profile {
  athlete: Athlete;
  /** Heart-rate and power zones; absent until synced, or if Strava won't share them. */
  zones?: AthleteZones | null;
}

/** From the API's database; never reaches Strava. */
export async function fetchProfile(): Promise<Profile> {
  if (isDemo) return { athlete: mockAthlete, zones: mockAthleteZones };
  return apiGet<Profile>("/api/profile");
}

/** Counted by the API from the synced activities. `today` is the viewer's local date. */
export function fetchProfileTotals(today: string): Promise<ProfileTotals> {
  if (isDemo) return Promise.reject(new Error("Totals come from the Straapp API, which demo mode doesn't use."));
  return apiGet<ProfileTotals>("/api/profile/totals", { today });
}
