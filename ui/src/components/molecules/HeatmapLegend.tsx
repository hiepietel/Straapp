import { rampCss } from "../../utils/colorRamp";
import type { ColorRamp } from "../../utils/colorRamp";

/** Where the road-surface overlay is at. `zoom` means the map is too far out to look surfaces up. */
export type AreaSurfaceStatus = "off" | "zoom" | "loading" | "ready" | "error";

export interface HeatmapLegendProps {
  /** Shown when lines are coloured by how often. */
  heat: { ramp: ColorRamp; max: number } | null;
  /** Shown when lines are coloured by sport or gear. */
  groups: { label: string; color: string }[] | null;
  surfaceStatus: AreaSurfaceStatus;
  surfaceError: string | null;
  showSpots: boolean;
  spotColor: string;
}

const SURFACE_KEYS = [
  { label: "Unpaved", dash: "6 4" },
  { label: "Unknown surface", dash: "1 4" },
] as const;

// Floats over the map's bottom-left corner (Leaflet keeps its attribution bottom-right).
export default function HeatmapLegend({ heat, groups, surfaceStatus, surfaceError, showSpots, spotColor }: HeatmapLegendProps) {
  if (!heat && !groups?.length && surfaceStatus === "off" && !showSpots) return null;

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] flex max-w-[calc(100%-1rem)] flex-col gap-2 rounded-md border border-line bg-chalk/95 px-3 py-2 text-xs shadow-sm">
      {heat && (
        <div className="w-48">
          <p className="mb-1 font-semibold">Activities through here</p>
          <div className="h-2 rounded-full" style={{ background: rampCss(heat.ramp) }} />
          <div className="num mt-1 flex justify-between text-mute">
            <span>1×</span>
            <span>{heat.max}×</span>
          </div>
        </div>
      )}

      {groups && groups.length > 0 && (
        <ul className="flex max-w-72 flex-wrap gap-x-3 gap-y-1">
          {groups.map((g) => (
            <li key={g.label} className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
              {g.label}
            </li>
          ))}
        </ul>
      )}

      {surfaceStatus === "ready" && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {SURFACE_KEYS.map((k) => (
            <li key={k.label} className="flex items-center gap-1.5">
              <svg width="24" height="6" aria-hidden="true">
                <line
                  x1="1"
                  y1="3"
                  x2="23"
                  y2="3"
                  strokeWidth="3"
                  strokeLinecap={k.dash === "1 4" ? "round" : "butt"}
                  strokeDasharray={k.dash}
                  className="stroke-ink"
                />
              </svg>
              {k.label}
            </li>
          ))}
        </ul>
      )}
      {surfaceStatus === "zoom" && <p className="text-mute">Zoom in to see road surfaces.</p>}
      {surfaceStatus === "loading" && <p className="text-mute">Loading road surfaces…</p>}
      {surfaceStatus === "error" && (
        <p className="text-alert">Couldn't load road surfaces{surfaceError ? `: ${surfaceError}` : "."}</p>
      )}

      {showSpots && (
        <p className="flex items-center gap-1.5">
          <span
            className="inline-block size-3 rounded-full border-2 border-white"
            style={{ backgroundColor: spotColor }}
            aria-hidden="true"
          />
          Frequent spot; bigger is more often
        </p>
      )}
    </div>
  );
}
