import { useCallback, useState } from "react";
import {
  DEFAULT_BASE_LAYER,
  DEFAULT_ROUTE_COLOR,
  isBaseLayerId,
  isHexColor,
} from "../utils/mapStyles";
import type { BaseLayerId } from "../utils/mapStyles";

const STORAGE_KEY = "straapp.map";

/** What the route line's colour shows: one chosen colour, or a gradient by speed or height. */
export type LineMode = "solid" | "speed" | "elevation";
const LINE_MODES: readonly LineMode[] = ["solid", "speed", "elevation"];

export interface MapPreferences {
  baseLayer: BaseLayerId;
  routeColor: string;
  lineMode: LineMode;
  /** Draw paved/unpaved/unknown as solid/dashed/dotted (looked up from OpenStreetMap). */
  showSurface: boolean;
}

const DEFAULTS: MapPreferences = {
  baseLayer: DEFAULT_BASE_LAYER,
  routeColor: DEFAULT_ROUTE_COLOR,
  lineMode: "solid",
  showSurface: false,
};

function readStored(): MapPreferences {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULTS;
    const { baseLayer, routeColor, lineMode, showSurface } = raw as Record<string, unknown>;
    return {
      baseLayer: isBaseLayerId(baseLayer) ? baseLayer : DEFAULTS.baseLayer,
      routeColor: isHexColor(routeColor) ? routeColor : DEFAULTS.routeColor,
      lineMode: LINE_MODES.includes(lineMode as LineMode) ? (lineMode as LineMode) : DEFAULTS.lineMode,
      showSurface: typeof showSurface === "boolean" ? showSurface : DEFAULTS.showSurface,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Which map background and route colour the viewer likes — remembered locally, like the grid columns. */
export function useMapPreferences(): [MapPreferences, (change: Partial<MapPreferences>) => void] {
  const [prefs, setPrefs] = useState(readStored);

  const update = useCallback((change: Partial<MapPreferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...change };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage blocked: the choice still applies for this tab, just doesn't persist.
      }
      return next;
    });
  }, []);

  return [prefs, update];
}
