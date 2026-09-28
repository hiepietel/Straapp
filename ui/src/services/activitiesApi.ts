import { getMockActivityDetail, getMockActivityStreams, mockActivities } from "./mockActivities";
import { isDemo } from "./auth";
import { apiGet } from "./api";
import type { Activity, ActivityDetail, ActivityStreams } from "../types/strava";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Activities come from the API's database, in Strava's format; the sync keeps them current.
const ACTIVITIES_URL = "/api/activities";

export interface FetchActivitiesOptions {
  page?: number;
  perPage?: number;
}

/** Newest first. Only activities the sync has stored. */
export async function fetchActivities({
  page = 1,
  perPage = 200, // the API's (and Strava's) max per page
}: FetchActivitiesOptions = {}): Promise<Activity[]> {
  if (isDemo) {
    await wait(400);
    return mockActivities.slice((page - 1) * perPage, page * perPage);
  }
  return apiGet<Activity[]>(ACTIVITIES_URL, { page, perPage });
}

export async function fetchActivity(id: number): Promise<ActivityDetail> {
  if (isDemo) {
    await wait(300);
    return getMockActivityDetail(id);
  }
  return apiGet<ActivityDetail>(`${ACTIVITIES_URL}/${id}`);
}

/** Second-by-second (or GPS-point-by-point) data for the charts. Missing when unsupported
 *  sensors weren't recorded, or the activity has no distance (e.g. a stationary workout). */
export async function fetchActivityStreams(id: number): Promise<ActivityStreams> {
  if (isDemo) {
    await wait(300);
    return getMockActivityStreams(id);
  }
  return apiGet<ActivityStreams>(`${ACTIVITIES_URL}/${id}/streams`);
}
