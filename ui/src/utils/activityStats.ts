import type { Activity, ActivityDetail, ActivityStreams, StreamData } from "../types/strava";
import { getGroup } from "./sports";
import type { SportGroupId } from "./sports";
import {
  formatCalories,
  formatDistance,
  formatDuration,
  formatElevation,
  formatEnergy,
  formatHeartRate,
  formatPacePer100m,
  formatPacePerKm,
  formatPercent,
  formatPower,
  formatSpeed,
  formatTemperature,
  formatTimeOfDay,
} from "./format";

export interface Stat {
  label: string;
  value: string;
}

/** Sensors report 0 or nothing when they didn't record; both mean "don't show it". */
const has = (n: number | undefined): n is number => n !== undefined && n > 0;

/** How each sport group reports its average speed, if at all. */
export function speedStat(group: SportGroupId, speed: number): Stat | null {
  switch (group) {
    case "run":
    case "walk":
      return { label: "Pace", value: formatPacePerKm(speed) };
    case "ride":
      return { label: "Speed", value: formatSpeed(speed) };
    case "swim":
      return { label: "Pace", value: formatPacePer100m(speed) };
    case "other":
      return null;
  }
}

/** A speed shown the way the sport does it, for places that have no label of their own. */
export const formatSportSpeed = (group: SportGroupId, speed: number): string =>
  speedStat(group, speed)?.value ?? formatSpeed(speed);

function maxSpeedStat(group: SportGroupId, speed: number): Stat | null {
  switch (group) {
    case "run":
    case "walk":
      return { label: "Best pace", value: formatPacePerKm(speed) };
    case "ride":
      return { label: "Max speed", value: formatSpeed(speed) };
    case "swim":
    case "other":
      return null;
  }
}

/** Strava reports run cadence per leg; runners think in steps per minute. */
function cadenceStat(group: SportGroupId, cadence: number): Stat {
  return group === "ride"
    ? { label: "Cadence", value: `${Math.round(cadence)} rpm` }
    : { label: "Cadence", value: `${Math.round(cadence * 2)} spm` };
}

/** The four or fewer numbers shown on a list card. */
export function buildSummaryStats(activity: Activity, group: SportGroupId): Stat[] {
  const stats: Stat[] = [];

  if (activity.distance > 0) {
    stats.push({ label: "Distance", value: formatDistance(activity.distance) });
  }
  stats.push({ label: "Time", value: formatDuration(activity.moving_time) });

  if (activity.average_speed > 0) {
    const speed = speedStat(group, activity.average_speed);
    if (speed) stats.push(speed);
  }
  if (activity.total_elevation_gain > 0) {
    stats.push({ label: "Elevation", value: formatElevation(activity.total_elevation_gain) });
  }

  return stats;
}

export interface StatGroup {
  title: string;
  stats: Stat[];
}

/** The largest value in a stream, or undefined if it never recorded anything above zero. */
function streamMax(stream: StreamData | undefined): number | undefined {
  if (!stream || stream.data.length === 0) return undefined;
  const max = stream.data.reduce((a, b) => Math.max(a, b), 0);
  return max > 0 ? max : undefined;
}

/** Altitude jitters by a metre or so between samples; changes smaller than this are ignored. */
const ELEVATION_NOISE_M = 1;

/** Total metres descended along an altitude stream, with small jitter filtered out. */
export function totalDescent(altitude: readonly number[]): number {
  let descent = 0;
  let reference = altitude[0] ?? 0;
  for (const value of altitude) {
    const change = value - reference;
    if (Math.abs(change) < ELEVATION_NOISE_M) continue;
    if (change < 0) descent -= change;
    reference = value;
  }
  return descent;
}

/** The handful of numbers that headline the detail page. */
function overviewStats(activity: ActivityDetail, group: SportGroupId): Stat[] {
  const stats: Stat[] = [];

  if (activity.distance > 0) {
    stats.push({ label: "Distance", value: formatDistance(activity.distance) });
  }
  stats.push({ label: "Moving time", value: formatDuration(activity.moving_time) });
  if (activity.average_speed > 0) {
    const speed = speedStat(group, activity.average_speed);
    if (speed) stats.push(speed);
  }
  if (activity.total_elevation_gain > 0) {
    stats.push({ label: "Elevation gain", value: formatElevation(activity.total_elevation_gain) });
  }
  if (has(activity.calories)) {
    stats.push({ label: "Calories", value: formatCalories(activity.calories) });
  }

  return stats;
}

function timeStats(activity: ActivityDetail, group: SportGroupId): Stat[] {
  const stats: Stat[] = [{ label: "Start time", value: formatTimeOfDay(activity.start_date_local) }];
  const stopped = activity.elapsed_time - activity.moving_time;

  if (stopped > 0) {
    stats.push({ label: "Elapsed time", value: formatDuration(activity.elapsed_time) });
    stats.push({ label: "Stopped time", value: formatDuration(stopped) });
    stats.push({ label: "Time moving", value: formatPercent(activity.moving_time / activity.elapsed_time) });
  }
  if (has(activity.max_speed)) {
    const best = maxSpeedStat(group, activity.max_speed);
    if (best) stats.push(best);
  }
  // Averaged over the whole outing, stops included — what the clock on the wall says.
  if (stopped > 0 && activity.distance > 0) {
    const overall = speedStat(group, activity.distance / activity.elapsed_time);
    if (overall) stats.push({ label: `${overall.label} incl. stops`, value: overall.value });
  }

  return stats;
}

function elevationStats(activity: ActivityDetail, streams: ActivityStreams | null): Stat[] {
  const stats: Stat[] = [];
  const altitude = streams?.altitude?.data;

  if (activity.total_elevation_gain > 0) {
    stats.push({ label: "Gain", value: formatElevation(activity.total_elevation_gain) });
  }
  // The API has no descent figure of its own, so it's worked out from the altitude stream.
  if (altitude && altitude.length > 1) {
    stats.push({ label: "Loss", value: formatElevation(totalDescent(altitude)) });
  }
  if (activity.elev_high !== undefined) {
    stats.push({ label: "Highest point", value: formatElevation(activity.elev_high) });
  }
  if (activity.elev_low !== undefined) {
    stats.push({ label: "Lowest point", value: formatElevation(activity.elev_low) });
  }
  if (activity.total_elevation_gain > 0 && activity.distance >= 1000) {
    const perKm = activity.total_elevation_gain / (activity.distance / 1000);
    stats.push({ label: "Climb per km", value: `${perKm.toFixed(perKm < 10 ? 1 : 0)} m/km` });
  }

  return stats;
}

function effortStats(activity: ActivityDetail, group: SportGroupId, streams: ActivityStreams | null): Stat[] {
  const stats: Stat[] = [];

  if (has(activity.average_heartrate)) {
    stats.push({ label: "Avg heart rate", value: formatHeartRate(activity.average_heartrate) });
  }
  const maxHeartRate = has(activity.max_heartrate) ? activity.max_heartrate : streamMax(streams?.heartrate);
  if (maxHeartRate !== undefined) {
    stats.push({ label: "Max heart rate", value: formatHeartRate(maxHeartRate) });
  }
  const effort = activity.suffer_score ?? undefined;
  if (has(effort)) stats.push({ label: "Relative effort", value: String(Math.round(effort)) });

  if (has(activity.average_cadence)) stats.push(cadenceStat(group, activity.average_cadence));
  const maxCadence = streamMax(streams?.cadence);
  if (maxCadence !== undefined) {
    stats.push({ label: "Max cadence", value: cadenceStat(group, maxCadence).value });
  }

  if (has(activity.average_watts)) {
    stats.push({ label: "Avg power", value: formatPower(activity.average_watts) });
  }
  if (has(activity.weighted_average_watts)) {
    stats.push({ label: "Weighted avg power", value: formatPower(activity.weighted_average_watts) });
  }
  const maxWatts = has(activity.max_watts) ? activity.max_watts : streamMax(streams?.watts);
  if (maxWatts !== undefined) {
    stats.push({ label: "Max power", value: formatPower(maxWatts) });
  }
  if (has(activity.kilojoules)) {
    stats.push({ label: "Energy output", value: formatEnergy(activity.kilojoules) });
  }

  return stats;
}

function otherStats(activity: ActivityDetail): Stat[] {
  const stats: Stat[] = [];

  // 0 °C is a real reading, so this one isn't filtered through `has`.
  if (activity.average_temp !== undefined) {
    stats.push({ label: "Temperature", value: formatTemperature(activity.average_temp) });
  }
  if (activity.athlete_count !== undefined) {
    stats.push({
      label: "Company",
      value: activity.athlete_count > 1 ? `${activity.athlete_count} athletes` : "Solo",
    });
  }
  if (activity.kudos_count !== undefined) {
    stats.push({ label: "Kudos", value: activity.kudos_count.toLocaleString() });
  }
  if (activity.comment_count !== undefined) {
    stats.push({ label: "Comments", value: activity.comment_count.toLocaleString() });
  }
  if (has(activity.achievement_count)) {
    stats.push({ label: "Achievements", value: activity.achievement_count.toLocaleString() });
  }
  if (has(activity.pr_count)) {
    stats.push({ label: "Personal records", value: activity.pr_count.toLocaleString() });
  }

  return stats;
}

/**
 * Everything the full activity response (plus its streams, once loaded) gave us, skipping
 * what wasn't recorded. The first group is the headline; empty groups are dropped.
 */
export function buildDetailStats(
  activity: ActivityDetail,
  group: SportGroupId,
  streams: ActivityStreams | null = null
): StatGroup[] {
  const groups: StatGroup[] = [
    { title: "Overview", stats: overviewStats(activity, group) },
    { title: "Time & speed", stats: timeStats(activity, group) },
    { title: "Elevation", stats: elevationStats(activity, streams) },
    { title: "Effort", stats: effortStats(activity, group, streams) },
    { title: "Conditions & social", stats: otherStats(activity) },
  ];
  return groups.filter((g) => g.stats.length > 0);
}

export interface ActivityTotals {
  count: number;
  /** Metres. */
  distance: number;
  /** Seconds. */
  time: number;
  /** Metres. */
  elevation: number;
  /** Metres; the single longest activity in the set. */
  longestDistance: number;
  /** Distinct calendar days (in the activity's own local time) with at least one activity. */
  activeDays: number;
  /** How many activities fall in each sport group; groups with none are omitted. */
  bySport: Partial<Record<SportGroupId, number>>;
}

/** Rolls a set of activities up into the numbers a statistics view needs. */
export function aggregateTotals(activities: readonly Activity[]): ActivityTotals {
  const activeDays = new Set<string>();
  const bySport: Partial<Record<SportGroupId, number>> = {};
  let distance = 0;
  let time = 0;
  let elevation = 0;
  let longestDistance = 0;

  for (const activity of activities) {
    distance += activity.distance;
    time += activity.moving_time;
    elevation += activity.total_elevation_gain;
    if (activity.distance > longestDistance) longestDistance = activity.distance;
    activeDays.add(activity.start_date_local.slice(0, 10));

    const group = getGroup(activity);
    bySport[group] = (bySport[group] ?? 0) + 1;
  }

  return {
    count: activities.length,
    distance,
    time,
    elevation,
    longestDistance,
    activeDays: activeDays.size,
    bySport,
  };
}
