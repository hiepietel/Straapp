import { useCallback, useEffect, useState } from "react";
import { fetchProfile } from "../services/profileApi";
import { getErrorMessage } from "../utils/errors";
import type { Athlete, AthleteStats, AthleteZones } from "../types/strava";

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
  stats: Section<AthleteStats>;
  zones: Section<AthleteZones>;
  retry: () => void;
}

// One request for the whole profile. Totals and zones can still be missing on their own (not synced
// yet, or zones Strava won't share), so each section reports separately.
export function useAthleteProfile(): UseAthleteProfileResult {
  const [athlete, setAthlete] = useState<Section<Athlete>>(loading);
  const [stats, setStats] = useState<Section<AthleteStats>>(loading);
  const [zones, setZones] = useState<Section<AthleteZones>>(loading);
  // Bumped by retry() to re-run the effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setAthlete(loading());
    setStats(loading());
    setZones(loading());

    fetchProfile()
      .then((profile) => {
        if (!active) return;
        setAthlete(ready(profile.athlete));
        setStats(profile.stats ? ready(profile.stats) : failed("Your totals arrive with the next sync."));
        setZones(
          profile.zones ? ready(profile.zones) : failed("No training zones yet: they arrive with the next sync, if Strava shares them.")
        );
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = getErrorMessage(err);
        setAthlete(failed(message));
        setStats(failed("The profile couldn't be loaded."));
        setZones(failed("The profile couldn't be loaded."));
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { athlete, stats, zones, retry };
}
