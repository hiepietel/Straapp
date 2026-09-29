import { Footprints, Bike, Waves, Mountain, Dumbbell } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Activity, SportType } from "../types/strava";

export interface SportGroup {
  label: string;
  icon: LucideIcon;
}

export const GROUPS = {
  run: { label: "Runs", icon: Footprints },
  ride: { label: "Rides", icon: Bike },
  walk: { label: "Walks & hikes", icon: Mountain },
  swim: { label: "Swims", icon: Waves },
  other: { label: "Other", icon: Dumbbell },
} as const satisfies Record<string, SportGroup>;

/** `"run" | "ride" | "walk" | "swim" | "other"` — derived, so it never drifts. */
export type SportGroupId = keyof typeof GROUPS;

// Kept in step with the API's SportGroups.
const TYPE_TO_GROUP: Partial<Record<SportType, SportGroupId>> = {
  Run: "run",
  TrailRun: "run",
  VirtualRun: "run",
  Ride: "ride",
  GravelRide: "ride",
  MountainBikeRide: "ride",
  EBikeRide: "ride",
  EMountainBikeRide: "ride",
  VirtualRide: "ride",
  Velomobile: "ride",
  Handcycle: "ride",
  Walk: "walk",
  Hike: "walk",
  Swim: "swim",
};

/** The group a Strava sport type belongs to. */
export const groupOfType = (sportType: string): SportGroupId => TYPE_TO_GROUP[sportType] ?? "other";

/** The activity's Strava sport type, falling back to the legacy type. */
export const sportTypeOf = (activity: Activity): string => activity.sport_type ?? activity.type ?? "Other";

export const getGroup = (activity: Activity): SportGroupId => groupOfType(sportTypeOf(activity));

// Short names for the sub-type filter; anything else is spelled out from its Strava name.
const SHORT_TYPE_LABELS: Record<string, string> = {
  Ride: "Ride",
  GravelRide: "Gravel",
  MountainBikeRide: "MTB",
  EBikeRide: "E-bike",
  EMountainBikeRide: "E-MTB",
  VirtualRide: "Virtual ride",
  VirtualRun: "Virtual run",
  TrailRun: "Trail run",
};

/** "MountainBikeRide" -> "MTB"; "WeightTraining" -> "Weight training". */
export function sportTypeLabel(sportType: string): string {
  const short = SHORT_TYPE_LABELS[sportType];
  if (short) return short;
  const spaced = sportType.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0) + spaced.slice(1).toLowerCase();
}

/** Whether a sport type passes a filter of chosen types (an empty filter lets everything through). */
export const matchesSportTypes = (sportType: string, chosen: ReadonlySet<string>): boolean =>
  chosen.size === 0 || chosen.has(sportType);

// "TrailRun" -> "Trail run"
export function sportLabel(activity: Activity): string {
  const raw = (activity.sport_type ?? activity.type ?? "Activity").replace(
    /([a-z])([A-Z])/g,
    "$1 $2"
  );
  return raw.charAt(0) + raw.slice(1).toLowerCase();
}
