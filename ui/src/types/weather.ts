/**
 * `GET /api/activities/{id}/weather`: the weather around an activity every 15 minutes, looked up by
 * the API in Open-Meteo's historical archive. Times are UTC.
 */

export type WeatherStatus = "ready" | "pending" | "unavailable" | "notApplicable";

export interface WeatherSample {
  /** UTC, on a quarter hour. */
  time: string;
  /** °C, 2 m above ground. */
  temperature: number | null;
  /** "Feels like", °C. */
  apparentTemperature: number | null;
  /** %. */
  relativeHumidity: number | null;
  /** °C. */
  dewPoint: number | null;
  /** mm in the 15 minutes up to `time`: rain, showers and snow as water. */
  precipitation: number | null;
  rain: number | null;
  /** cm in the 15 minutes up to `time`. */
  snowfall: number | null;
  /** % of the sky. */
  cloudCover: number | null;
  /** km/h, 10 m above ground. */
  windSpeed: number | null;
  /** Degrees the wind comes from: 0 = from the north, 90 = from the east. */
  windDirection: number | null;
  /** km/h. */
  windGusts: number | null;
  /** WMO weather code. */
  weatherCode: number | null;
  /** hPa at the surface. */
  pressure: number | null;
  isDay: boolean | null;
}

export interface ActivityWeather {
  status: WeatherStatus;
  /** When the activity started and ended, UTC. */
  start: string;
  end: string;
  /** Where it happened, to show times in local time. */
  utcOffsetSeconds: number;
  /** The weather model's grid cell the values are for. */
  place: { latitude: number; longitude: number; elevation: number | null; source: string } | null;
  /** Every quarter hour from two hours before the start to two after the end, oldest first. */
  samples: WeatherSample[];
}
