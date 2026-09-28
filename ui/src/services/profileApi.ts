import { mockAthlete, mockAthleteStats, mockAthleteZones } from "./mockActivities";
import { isDemo } from "./auth";
import { apiGet } from "./api";
import type { Athlete, AthleteStats, AthleteZones } from "../types/strava";

/** `GET /api/profile`: the athlete as last synced, in Strava's format. */
export interface Profile {
  athlete: Athlete;
  /** Strava's recent, year-to-date and all-time totals; absent until a sync has fetched them. */
  stats?: AthleteStats | null;
  /** Heart-rate and power zones; absent until synced, or if Strava won't share them. */
  zones?: AthleteZones | null;
}

/** From the API's database; never reaches Strava. */
export async function fetchProfile(): Promise<Profile> {
  if (isDemo) return { athlete: mockAthlete, stats: mockAthleteStats, zones: mockAthleteZones };
  return apiGet<Profile>("/api/profile");
}
