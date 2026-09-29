import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WeatherSample } from "../types/weather";

/** The weather is stored every 15 minutes. */
export const STEP_MS = 15 * 60 * 1000;

/** WMO weather code to words and an icon (a clear night gets the moon instead of the sun). */
export function describeWeather(code: number | null, isDay: boolean | null = true): { label: string; icon: LucideIcon } {
  const clear = isDay === false ? Moon : Sun;
  if (code === null) return { label: "Unknown", icon: Cloud };
  if (code === 0) return { label: "Clear sky", icon: clear };
  if (code === 1) return { label: "Mainly clear", icon: clear };
  if (code === 2) return { label: "Partly cloudy", icon: CloudSun };
  if (code === 3) return { label: "Overcast", icon: Cloud };
  if (code === 45 || code === 48) return { label: "Fog", icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: code >= 56 ? "Freezing drizzle" : "Drizzle", icon: CloudDrizzle };
  if (code >= 61 && code <= 67) {
    const label = code === 61 ? "Light rain" : code === 63 ? "Rain" : code === 65 ? "Heavy rain" : "Freezing rain";
    return { label, icon: CloudRain };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { label: code === 75 || code === 86 ? "Heavy snow" : "Snow", icon: CloudSnow };
  }
  if (code >= 80 && code <= 82) return { label: code === 82 ? "Violent showers" : "Showers", icon: CloudRain };
  if (code >= 95) return { label: code === 95 ? "Thunderstorm" : "Thunderstorm with hail", icon: CloudLightning };
  return { label: "Cloudy", icon: Cloud };
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** "NW" for a wind from 315°. */
export const compass = (degrees: number): string => COMPASS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16]!;

const mean = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
const present = <T,>(values: (T | null)[]) => values.filter((v): v is T => v !== null);

/**
 * The samples from the activity's start to its end. Precipitation is for the 15 minutes up to each
 * sample, so it takes the first one after the end too, which covers the activity's last minutes.
 */
export function activitySamples(samples: readonly WeatherSample[], start: string, end: string): WeatherSample[] {
  const from = Math.floor(Date.parse(start) / STEP_MS) * STEP_MS;
  const to = Math.ceil(Date.parse(end) / STEP_MS) * STEP_MS;
  return samples.filter((s) => {
    const t = Date.parse(s.time);
    return t >= from && t <= to;
  });
}

export interface WeatherSummary {
  temperature: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  apparentTemperature: number | null;
  /** mm over the activity. */
  precipitation: number;
  windSpeed: number | null;
  /** Where the wind mostly came from, degrees; averaged as vectors, so 350° and 10° make 0°. */
  windDirection: number | null;
  windGusts: number | null;
  humidity: number | null;
  cloudCover: number | null;
  /** The most notable weather: the highest WMO code (rain outranks cloud outranks clear). */
  weatherCode: number | null;
  isDay: boolean | null;
}

export function summarize(hours: readonly WeatherSample[]): WeatherSummary {
  const temps = present(hours.map((h) => h.temperature));
  const gusts = present(hours.map((h) => h.windGusts));
  const codes = present(hours.map((h) => h.weatherCode));

  const winds = hours.filter((h) => h.windSpeed !== null && h.windDirection !== null);
  let windDirection: number | null = null;
  if (winds.length) {
    const x = winds.reduce((s, h) => s + h.windSpeed! * Math.sin((h.windDirection! * Math.PI) / 180), 0);
    const y = winds.reduce((s, h) => s + h.windSpeed! * Math.cos((h.windDirection! * Math.PI) / 180), 0);
    windDirection = x === 0 && y === 0 ? null : ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  }

  return {
    temperature: mean(temps),
    temperatureMin: temps.length ? Math.min(...temps) : null,
    temperatureMax: temps.length ? Math.max(...temps) : null,
    apparentTemperature: mean(present(hours.map((h) => h.apparentTemperature))),
    precipitation: present(hours.map((h) => h.precipitation)).reduce((s, v) => s + v, 0),
    windSpeed: mean(present(hours.map((h) => h.windSpeed))),
    windDirection,
    windGusts: gusts.length ? Math.max(...gusts) : null,
    humidity: mean(present(hours.map((h) => h.relativeHumidity))),
    cloudCover: mean(present(hours.map((h) => h.cloudCover))),
    weatherCode: codes.length ? Math.max(...codes) : null,
    isDay: hours.some((h) => h.isDay === true) ? true : (hours[0]?.isDay ?? null),
  };
}

export const formatTemp = (c: number): string => `${Math.round(c)} °C`;
export const formatWind = (kmh: number): string => `${Math.round(kmh)} km/h`;
export const formatRain = (mm: number): string => `${mm === 0 ? 0 : mm < 10 ? mm.toFixed(1) : Math.round(mm)} mm`;
