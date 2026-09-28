import { rampCss } from "../../utils/colorRamp";
import type { ColorRamp } from "../../utils/colorRamp";
import type { SurfaceStatus } from "../../hooks/useRouteSurfaces";

export interface MapLegendProps {
  /** Shown when the route is coloured by a measure. */
  gradient: { title: string; ramp: ColorRamp; low: string; high: string } | null;
  surfaceStatus: SurfaceStatus;
  surfaceError: string | null;
}

const SURFACE_KEYS = [
  { label: "Paved", dash: undefined },
  { label: "Unpaved", dash: "6 4" },
  { label: "Unknown", dash: "1 4" },
] as const;

// Floats over the map's bottom-left corner (Leaflet keeps its attribution bottom-right).
export default function MapLegend({ gradient, surfaceStatus, surfaceError }: MapLegendProps) {
  if (!gradient && surfaceStatus === "off") return null;

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] flex max-w-[calc(100%-1rem)] flex-col gap-2 rounded-md border border-line bg-chalk/95 px-3 py-2 text-xs shadow-sm">
      {gradient && (
        <div className="w-48">
          <p className="mb-1 font-semibold">{gradient.title}</p>
          <div className="h-2 rounded-full" style={{ background: rampCss(gradient.ramp) }} />
          <div className="num mt-1 flex justify-between text-mute">
            <span>{gradient.low}</span>
            <span>{gradient.high}</span>
          </div>
        </div>
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
      {surfaceStatus === "loading" && <p className="text-mute">Loading road surfaces…</p>}
      {surfaceStatus === "error" && (
        <p className="text-alert">Couldn't load road surfaces{surfaceError ? `: ${surfaceError}` : "."}</p>
      )}
    </div>
  );
}
