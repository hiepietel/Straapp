import { apiGet } from "./api";
import { isDemo } from "./auth";
import type { ActivityWeather } from "../types/weather";

/** Stored by the API's background job; the page never asks the weather service itself. */
export function fetchActivityWeather(id: number): Promise<ActivityWeather> {
  if (isDemo) {
    return Promise.resolve({ status: "notApplicable", start: "", end: "", utcOffsetSeconds: 0, place: null, samples: [] });
  }
  return apiGet<ActivityWeather>(`/api/activities/${id}/weather`);
}
