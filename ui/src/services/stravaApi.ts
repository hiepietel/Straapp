import {
  getMockActivityDetail,
  getMockActivityStreams,
  mockActivities,
  mockAthlete,
  mockAthleteStats,
  mockAthleteZones,
  mockGearDetail,
} from "./mockActivities";
import { isDemo } from "./auth";
import { apiGet } from "./api";
import type { QueryParams } from "./api";
import type {
  Activity,
  ActivityDetail,
  ActivityStreams,
  Athlete,
  AthleteStats,
  AthleteZones,
  GearDetail,
} from "../types/strava";

// The API passes these through from Strava for the logged-in athlete, in Strava's own format.
const API_URL = "/api/strava";

console.log(`Strava API: ${isDemo ? "demo mode" : "live mode"}`);

const stravaGet = <T,>(path: string, params: QueryParams = {}): Promise<T> => apiGet<T>(`${API_URL}${path}`, params);

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface FetchActivitiesOptions {
  page?: number;
  perPage?: number;
  /** Only activities starting after this moment (epoch seconds). */
  after?: number;
}

export async function fetchActivities({
  page = 1,
  perPage = 200, // Strava's own max per page
  after,
}: FetchActivitiesOptions = {}): Promise<Activity[]> {
  if (isDemo) {
    await wait(400);
    const source =
      after === undefined ? mockActivities : mockActivities.filter((a) => Date.parse(a.start_date_local) / 1000 > after);
    return source.slice((page - 1) * perPage, page * perPage);
  }
  return stravaGet<Activity[]>("/activities", {
    page,
    perPage,
    after: after === undefined ? undefined : new Date(after * 1000).toISOString(),
  });
}

export async function fetchActivity(id: number): Promise<ActivityDetail> {
  if (isDemo) {
    await wait(300);
    return getMockActivityDetail(id);
  }
  return stravaGet<ActivityDetail>(`/activities/${id}`);
}

/** Second-by-second (or GPS-point-by-point) data for the charts. Missing when unsupported
 *  sensors weren't recorded, or the activity has no distance (e.g. a stationary workout). */
export async function fetchActivityStreams(id: number): Promise<ActivityStreams> {
  if (isDemo) {
    await wait(300);
    return getMockActivityStreams(id);
  }
  return stravaGet<ActivityStreams>(`/activities/${id}/streams`);
}

export async function fetchAthlete(): Promise<Athlete> {
  if (isDemo) return mockAthlete;
  return stravaGet<Athlete>("/athlete");
}

/** One bike or pair of shoes — how retired gear (absent from the athlete) gets its name. */
export async function fetchGear(id: string): Promise<GearDetail> {
  if (isDemo) {
    await wait(150);
    return mockGearDetail(id);
  }
  return stravaGet<GearDetail>(`/gear/${encodeURIComponent(id)}`);
}

/** Heart-rate and power training zones. Needs the `profile:read_all` scope. */
export async function fetchAthleteZones(): Promise<AthleteZones> {
  if (isDemo) return mockAthleteZones;
  return stravaGet<AthleteZones>("/athlete/zones");
}

/** Lifetime, year-to-date and last-4-weeks totals. */
export async function fetchAthleteStats(): Promise<AthleteStats> {
  if (isDemo) return mockAthleteStats;
  return stravaGet<AthleteStats>("/athlete/stats");
}
