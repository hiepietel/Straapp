import { useEffect, useMemo, useState } from "react";
import { fetchAthlete, fetchGear } from "../services/stravaApi";
import { gearColor, gearKind, usageByGear } from "../utils/gearStats";
import type { GearInfo } from "../utils/gearStats";
import type { Activity, Gear } from "../types/strava";

/**
 * Every bike and pair of shoes: the athlete's current gear, plus anything the activities
 * mention that the athlete no longer lists (retired gear), looked up one by one.
 * Sorted by distance in the history, most used first — which also fixes each one's colour.
 */
export function useGearList(activities: readonly Activity[], enabled: boolean): {
  gear: GearInfo[];
  loading: boolean;
} {
  const [current, setCurrent] = useState<Gear[] | null>(null);
  const [extra, setExtra] = useState<Map<string, Gear & { retired: boolean }>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchAthlete()
      .then((a) => {
        if (!cancelled) setCurrent([...(a.bikes ?? []), ...(a.shoes ?? [])]);
      })
      .catch(() => {
        if (!cancelled) setCurrent([]); // still show what the activities reveal
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const usedIds = useMemo(
    () => [...new Set(activities.map((a) => a.gear_id).filter((id): id is string => !!id))],
    [activities]
  );

  useEffect(() => {
    if (!current) return;
    const known = new Set(current.map((g) => g.id));
    const missing = usedIds.filter((id) => !known.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        fetchGear(id).then(
          (g) => ({ ...g, retired: g.retired ?? true }),
          // Deleted gear can't be looked up; it's still worth showing under its id.
          () => ({ id, name: `Unknown gear (${id})`, distance: 0, retired: true })
        )
      )
    ).then((found) => {
      if (!cancelled) setExtra(new Map(found.map((g) => [g.id, g])));
    });
    return () => {
      cancelled = true;
    };
  }, [current, usedIds]);

  const gear = useMemo(() => {
    if (!current) return [];
    const usage = usageByGear(activities);
    const all = [...current.map((g) => ({ ...g, retired: g.retired ?? false })), ...extra.values()];
    return all
      .sort((a, b) => (usage.get(b.id)?.distance ?? 0) - (usage.get(a.id)?.distance ?? 0) || b.distance - a.distance)
      .map(
        (g, rank): GearInfo => ({
          id: g.id,
          name: g.name,
          kind: gearKind(g.id),
          lifetimeDistance: g.distance,
          primary: g.primary ?? false,
          retired: g.retired,
          color: gearColor(rank),
        })
      );
  }, [current, extra, activities]);

  const missingLookups = current !== null && usedIds.some((id) => !current.some((g) => g.id === id) && !extra.has(id));
  return { gear, loading: current === null || missingLookups };
}
