import { useCallback, useState } from "react";
import { DEFAULT_ROUTE_COLOR, isBaseLayerId, isBikeOverlayId, isHexColor } from "../utils/mapStyles";
import type { BaseLayerId, BikeOverlayId } from "../utils/mapStyles";
import type { SpotKind } from "../utils/heatmap";
import { SQUADRAT_ZOOMS } from "../utils/squadrats";
import type { SquadratZoom } from "../utils/squadrats";

const STORAGE_KEY = "straapp.heatmap";

/** What the lines' colour shows: how often you've been there, one colour, the sport or the gear. */
export type HeatColorMode = "heat" | "solid" | "sport" | "gear";
export const HEAT_COLOR_MODES: readonly HeatColorMode[] = ["heat", "solid", "sport", "gear"];

/** Map heights to step through with the size buttons. Full class names, so Tailwind sees them. */
export const MAP_HEIGHTS = ["h-[45vh]", "h-[60vh]", "h-[75vh]", "h-[90vh]"] as const;

export const SPOT_MIN_COUNTS = [2, 3, 5, 10, 20, 50] as const;
export const SPOT_RADII = [100, 200, 500, 1000] as const;
const SPOT_KINDS: readonly SpotKind[] = ["start", "finish", "both"];

export interface HeatmapPreferences {
  baseLayer: BaseLayerId;
  colorMode: HeatColorMode;
  lineColor: string;
  /** Pixels. */
  lineWidth: number;
  /** An index into MAP_HEIGHTS. */
  height: number;
  /** Mark unpaved and unknown-surface roads you've been on (looked up from OpenStreetMap). */
  showSurface: boolean;
  bikeOverlays: BikeOverlayId[];
  showSpots: boolean;
  spotKind: SpotKind;
  /** Fewest activities that make a spot worth marking. */
  spotMinCount: number;
  /** Metres: starts closer than this count as the same spot. */
  spotRadius: number;
  /** Which map tiles to mark as visited (14 = squadrats, 17 = squadratinhos); null for none. */
  squadratZoom: SquadratZoom | null;
}

const DEFAULTS: HeatmapPreferences = {
  // A quiet grey map keeps its own roads from competing with the heat colours.
  baseLayer: "light",
  colorMode: "heat",
  lineColor: DEFAULT_ROUTE_COLOR,
  lineWidth: 2,
  height: 1,
  showSurface: false,
  bikeOverlays: [],
  showSpots: false,
  spotKind: "both",
  spotMinCount: 5,
  spotRadius: 200,
  squadratZoom: null,
};

const oneOf = <T,>(values: readonly T[], value: unknown, fallback: T): T =>
  values.includes(value as T) ? (value as T) : fallback;

function readStored(): HeatmapPreferences {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULTS;
    const r = raw as Record<string, unknown>;
    return {
      baseLayer: isBaseLayerId(r.baseLayer) ? r.baseLayer : DEFAULTS.baseLayer,
      colorMode: oneOf(HEAT_COLOR_MODES, r.colorMode, DEFAULTS.colorMode),
      lineColor: isHexColor(r.lineColor) ? r.lineColor : DEFAULTS.lineColor,
      lineWidth: oneOf([1, 2, 3, 4, 5, 6], r.lineWidth, DEFAULTS.lineWidth),
      height: oneOf([...MAP_HEIGHTS.keys()], r.height, DEFAULTS.height),
      showSurface: typeof r.showSurface === "boolean" ? r.showSurface : DEFAULTS.showSurface,
      bikeOverlays: Array.isArray(r.bikeOverlays) ? r.bikeOverlays.filter(isBikeOverlayId) : DEFAULTS.bikeOverlays,
      showSpots: typeof r.showSpots === "boolean" ? r.showSpots : DEFAULTS.showSpots,
      spotKind: oneOf(SPOT_KINDS, r.spotKind, DEFAULTS.spotKind),
      spotMinCount: oneOf(SPOT_MIN_COUNTS, r.spotMinCount, DEFAULTS.spotMinCount),
      spotRadius: oneOf(SPOT_RADII, r.spotRadius, DEFAULTS.spotRadius),
      squadratZoom: oneOf<SquadratZoom | null>([null, ...SQUADRAT_ZOOMS], r.squadratZoom, DEFAULTS.squadratZoom),
    };
  } catch {
    return DEFAULTS;
  }
}

/** How the viewer likes the heatmap drawn — remembered locally, like the route map's settings. */
export function useHeatmapPreferences(): [HeatmapPreferences, (change: Partial<HeatmapPreferences>) => void] {
  const [prefs, setPrefs] = useState(readStored);

  const update = useCallback((change: Partial<HeatmapPreferences>) => {
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
