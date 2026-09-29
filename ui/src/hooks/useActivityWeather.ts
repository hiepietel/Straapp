import { useCallback, useEffect, useState } from "react";
import { fetchActivityWeather } from "../services/weatherApi";
import { getErrorMessage } from "../utils/errors";
import type { ActivityWeather } from "../types/weather";

export type WeatherLoadStatus = "loading" | "ready" | "error";

// Separate from the activity itself, like the streams: weather is extra, and its absence or a
// failure to load it shouldn't hold up anything else on the page.
export function useActivityWeather(id: number): {
  status: WeatherLoadStatus;
  weather: ActivityWeather | null;
  error: string | null;
  retry: () => void;
} {
  const [weather, setWeather] = useState<ActivityWeather | null>(null);
  const [status, setStatus] = useState<WeatherLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);
    fetchActivityWeather(id)
      .then((data) => {
        if (!active) return;
        setWeather(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getErrorMessage(err));
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, weather, error, retry };
}
