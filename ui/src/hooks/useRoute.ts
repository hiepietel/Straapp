import { useMemo, useSyncExternalStore } from "react";

export type Route =
  | { name: "list" }
  | { name: "activity"; id: number }
  | { name: "profile" }
  | { name: "statistics" }
  | { name: "gear" }
  | { name: "heatmap" };

// Hash routes (#/activities/123) keep working on any static host, need no server rewrites,
// and leave the path alone, which the Strava login redirect relies on.
export const LIST_HREF = "#/";
export const PROFILE_HREF = "#/profile";
export const STATISTICS_HREF = "#/statistics";
export const GEAR_HREF = "#/gear";
export const HEATMAP_HREF = "#/heatmap";
export const activityHref = (id: number): string => `#/activities/${id}`;

export function parseRoute(hash: string): Route {
  const activityMatch = /^#\/activities\/(\d+)\/?$/.exec(hash);
  if (activityMatch) return { name: "activity", id: Number(activityMatch[1]) };
  if (/^#\/profile\/?$/.test(hash)) return { name: "profile" };
  if (/^#\/statistics\/?$/.test(hash)) return { name: "statistics" };
  if (/^#\/gear\/?$/.test(hash)) return { name: "gear" };
  if (/^#\/heatmap\/?$/.test(hash)) return { name: "heatmap" };
  return { name: "list" };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const getHash = (): string => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  return useMemo(() => parseRoute(hash), [hash]);
}
