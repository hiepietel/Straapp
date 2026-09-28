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

const TYPE_TO_GROUP: Partial<Record<SportType, SportGroupId>> = {
  Run: "run",
  TrailRun: "run",
  VirtualRun: "run",
  Ride: "ride",
  GravelRide: "ride",
  MountainBikeRide: "ride",
  EBikeRide: "ride",
  VirtualRide: "ride",
  Walk: "walk",
  Hike: "walk",
  Swim: "swim",
};

export const getGroup = (activity: Activity): SportGroupId =>
  TYPE_TO_GROUP[activity.sport_type ?? activity.type ?? ""] ?? "other";

// "TrailRun" -> "Trail run"
export function sportLabel(activity: Activity): string {
  const raw = (activity.sport_type ?? activity.type ?? "Activity").replace(
    /([a-z])([A-Z])/g,
    "$1 $2"
  );
  return raw.charAt(0) + raw.slice(1).toLowerCase();
}
