import { useCallback, useEffect, useState } from "react";
import { fetchProfile, fetchProfileTotals } from "../services/profileApi";
import { localNow } from "../utils/periodStats";
import type { ProfileTotals } from "../types/profile";
import { getErrorMessage } from "../utils/errors";
import type { Athlete, AthleteZones } from "../types/strava";

export type SectionStatus = "loading" | "ready" | "error";

export interface Section<T> {
  status: SectionStatus;
  data: T | null;
  error: string | null;
}

const loading = <T,>(): Section<T> => ({ status: "loading", data: null, error: null });
const ready = <T,>(data: T): Section<T> => ({ status: "ready", data, error: null });
const failed = <T,>(error: string): Section<T> => ({ status: "error", data: null, error });

export interface UseAthleteProfileResult {
  athlete: Section<Athlete>;
  totals: Section<ProfileTotals>;
  zones: Section<AthleteZones>;
  retry: () => void;
}

// The profile (with zones) and the totals are separate requests, and each section reports on its own:
// zones can be missing (not synced yet, or Strava won't share them) while the rest is fine.
export function useAthleteProfile(): UseAthleteProfileResult {
  const [athlete, setAthlete] = useState<Section<Athlete>>(loading);
  const [totals, setTotals] = useState<Section<ProfileTotals>>(loading);
  const [zones, setZones] = useState<Section<AthleteZones>>(loading);
  // Bumped by retry() to re-run the effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setAthlete(loading());
    setTotals(loading());
    setZones(loading());

    fetchProfile()
      .then((profile) => {
        if (!active) return;
        setAthlete(ready(profile.athlete));
        setZones(
          profile.zones ? ready(profile.zones) : failed("No training zones yet: they arrive with the next sync, if Strava shares them.")
        );
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = getErrorMessage(err);
        setAthlete(failed(message));
        setZones(failed("The profile couldn't be loaded."));
      });

    fetchProfileTotals(localNow().toISOString().slice(0, 10))
      .then((data) => active && setTotals(ready(data)))
      .catch((err: unknown) => active && setTotals(failed(getErrorMessage(err))));

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { athlete, totals, zones, retry };
}
