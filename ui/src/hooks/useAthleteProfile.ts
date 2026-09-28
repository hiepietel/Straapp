import { useCallback, useEffect, useState } from "react";
import { fetchAthlete, fetchAthleteStats, fetchAthleteZones } from "../services/stravaApi";
import { getErrorMessage } from "../utils/errors";
import type { Athlete, AthleteStats, AthleteZones } from "../types/strava";

export type SectionStatus = "loading" | "ready" | "error";

export interface Section<T> {
  status: SectionStatus;
  data: T | null;
  error: string | null;
}

const loading = <T,>(): Section<T> => ({ status: "loading", data: null, error: null });

export interface UseAthleteProfileResult {
  athlete: Section<Athlete>;
  stats: Section<AthleteStats>;
  zones: Section<AthleteZones>;
  retry: () => void;
}

// The three calls are independent, so one failing (most often `zones`, which needs a scope
// the athlete may not have granted) doesn't block the sections that succeeded.
export function useAthleteProfile(): UseAthleteProfileResult {
  const [athlete, setAthlete] = useState<Section<Athlete>>(loading);
  const [stats, setStats] = useState<Section<AthleteStats>>(loading);
  const [zones, setZones] = useState<Section<AthleteZones>>(loading);
  // Bumped by retry() to re-run every effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setAthlete(loading());
    setStats(loading());
    setZones(loading());

    fetchAthlete()
      .then((data) => {
        if (!active) return;
        setAthlete({ status: "ready", data, error: null });
        return fetchAthleteStats()
          .then((s) => active && setStats({ status: "ready", data: s, error: null }))
          .catch((err: unknown) => {
            if (active) setStats({ status: "error", data: null, error: getErrorMessage(err) });
          });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = getErrorMessage(err);
        setAthlete({ status: "error", data: null, error: message });
        setStats({ status: "error", data: null, error: "The athlete couldn't be loaded." });
      });

    fetchAthleteZones()
      .then((data) => active && setZones({ status: "ready", data, error: null }))
      .catch((err: unknown) => {
        if (active) setZones({ status: "error", data: null, error: getErrorMessage(err) });
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { athlete, stats, zones, retry };
}
