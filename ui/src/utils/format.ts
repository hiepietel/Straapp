export const formatDistance = (meters: number): string => `${(meters / 1000).toFixed(1)} km`;

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function minSec(totalSeconds: number): string {
  let m = Math.floor(totalSeconds / 60);
  let s = Math.round(totalSeconds % 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// speed is in m/s (what Strava returns)
export const formatPacePerKm = (speed: number): string => `${minSec(1000 / speed)} /km`;
export const formatPacePer100m = (speed: number): string => `${minSec(100 / speed)} /100m`;
export const formatSpeed = (speed: number): string => `${(speed * 3.6).toFixed(1)} km/h`;
export const formatElevation = (meters: number): string => `${Math.round(meters)} m`;

// Strava's start_date_local is local time labelled as UTC, so read it as UTC.
export const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));

// Clock time of day, read the same way as formatDate.
export const formatTimeOfDay = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso));

// For a plain `yyyy-mm-dd` value, e.g. from a <input type="date">.
export const formatShortDate = (isoDate: string): string =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`)
  );

export const formatHeartRate = (bpm: number): string => `${Math.round(bpm)} bpm`;
export const formatPower = (watts: number): string => `${Math.round(watts)} W`;
export const formatEnergy = (kj: number): string => `${Math.round(kj).toLocaleString()} kJ`;
export const formatTemperature = (celsius: number): string => `${Math.round(celsius)} °C`;
export const formatPercent = (fraction: number): string => `${Math.round(fraction * 100)}%`;
export const formatCalories = (kcal: number): string => `${Math.round(kcal).toLocaleString()} kcal`;

export function formatSignedElevation(meters: number): string {
  const rounded = Math.round(meters);
  if (rounded === 0) return "0 m";
  return `${rounded > 0 ? "+" : "\u2212"}${Math.abs(rounded)} m`;
}
