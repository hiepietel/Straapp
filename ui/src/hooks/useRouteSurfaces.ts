import { useEffect, useState } from "react";
import { fetchRouteSurfaces } from "../utils/roadSurface";
import type { SurfaceClass } from "../utils/roadSurface";
import type { LatLng } from "../utils/polyline";
import { getErrorMessage } from "../utils/errors";

export type SurfaceStatus = "off" | "loading" | "ready" | "error";

// Keyed by the encoded polyline, for this page load: switching the overlay off and on, or
// coming back to an activity, doesn't query the API again.
const cache = new Map<string, SurfaceClass[]>();

/**
 * The surface under each route point. Only fetched while `enabled`, since it sends the
 * route to a third-party API (OpenStreetMap's Overpass).
 */
export function useRouteSurfaces(
  polyline: string,
  points: readonly LatLng[],
  enabled: boolean
): { status: SurfaceStatus; surfaces: SurfaceClass[] | null; error: string | null } {
  const [, setLoaded] = useState(0); // bumped to re-render once the cache is filled
  const [error, setError] = useState<{ polyline: string; message: string } | null>(null);

  useEffect(() => {
    if (!enabled || points.length < 2 || cache.has(polyline)) return;
    setError(null);
    const controller = new AbortController();
    fetchRouteSurfaces(points, controller.signal).then(
      (surfaces) => {
        cache.set(polyline, surfaces);
        setLoaded((n) => n + 1);
      },
      (err: unknown) => {
        if (!controller.signal.aborted) setError({ polyline, message: getErrorMessage(err) });
      }
    );
    return () => controller.abort();
  }, [polyline, points, enabled]);

  if (!enabled) return { status: "off", surfaces: null, error: null };
  const surfaces = cache.get(polyline);
  if (surfaces && surfaces.length === points.length) return { status: "ready", surfaces, error: null };
  if (error?.polyline === polyline) return { status: "error", surfaces: null, error: error.message };
  return { status: "loading", surfaces: null, error: null };
}
