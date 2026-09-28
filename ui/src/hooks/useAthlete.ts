import { useSyncExternalStore } from "react";
import { getCurrentUser, isDemo, subscribe } from "../services/auth";
import type { CurrentUser } from "../services/auth";
import { mockAthlete } from "../services/mockActivities";

const demoUser: CurrentUser = {
  id: mockAthlete.id,
  firstname: mockAthlete.firstname,
  lastname: mockAthlete.lastname,
  profileUrl: mockAthlete.profile_medium ?? null,
};

/**
 * The logged-in athlete, for the name and photo in the top bar. Comes with the login from the
 * API's database, so showing it never costs a Strava request.
 */
export function useAthlete(): CurrentUser | null {
  const user = useSyncExternalStore(subscribe, getCurrentUser);
  return isDemo ? demoUser : user;
}
