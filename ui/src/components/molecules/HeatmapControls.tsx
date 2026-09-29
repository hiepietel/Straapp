import { useId } from "react";
import type { ReactNode } from "react";
import { Crosshair, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import ColorSwatches from "./ColorSwatches";
import { BASE_LAYERS, BIKE_OVERLAYS } from "../../utils/mapStyles";
import type { BaseLayerId, BikeOverlayId } from "../../utils/mapStyles";
import { HEAT_COLOR_MODES, MAP_HEIGHTS, SPOT_MIN_COUNTS, SPOT_RADII } from "../../hooks/useHeatmapPreferences";
import type { HeatColorMode, HeatmapPreferences } from "../../hooks/useHeatmapPreferences";
import type { SpotKind } from "../../utils/heatmap";

const COLOR_MODE_LABELS: Record<HeatColorMode, string> = {
  heat: "Heat (how often)",
  solid: "One colour",
  sport: "By sport",
  gear: "By gear",
};

const SPOT_KIND_LABELS: Record<SpotKind, string> = {
  start: "Starts",
  finish: "Finishes",
  both: "Starts & finishes",
};

const BIKE_OVERLAY_IDS = Object.keys(BIKE_OVERLAYS) as BikeOverlayId[];

export interface HeatmapControlsProps {
  prefs: HeatmapPreferences;
  onChange: (change: Partial<HeatmapPreferences>) => void;
  onFit: () => void;
  isFullscreen: boolean;
  /** Omitted where the browser can't go fullscreen (e.g. Safari on iPhone). */
  onToggleFullscreen?: (() => void) | undefined;
}

const SELECT = "rounded-md border border-line bg-chalk px-2 py-1 text-sm font-semibold";
const BUTTON =
  "inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-sm font-semibold hover:bg-pavement disabled:opacity-40 disabled:hover:bg-transparent";
const CHECK_LABEL = "flex cursor-pointer items-center gap-2 text-sm font-semibold";
const CHECKBOX = "size-4 accent-ink";

function Labelled({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-mute">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

// Everything above the heatmap: background, how lines are coloured, overlays, frequent spots, size.
export default function HeatmapControls({ prefs, onChange, onFit, isFullscreen, onToggleFullscreen }: HeatmapControlsProps) {
  const toggleOverlay = (id: BikeOverlayId, on: boolean) =>
    onChange({ bikeOverlays: on ? [...prefs.bikeOverlays, id] : prefs.bikeOverlays.filter((o) => o !== id) });

  return (
    <div className="flex flex-col gap-2 border-b border-line bg-chalk px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Labelled label="Map">
          {(id) => (
            <select
              id={id}
              value={prefs.baseLayer}
              onChange={(e) => onChange({ baseLayer: e.target.value as BaseLayerId })}
              className={SELECT}
            >
              {BASE_LAYERS.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.label}
                </option>
              ))}
            </select>
          )}
        </Labelled>

        <Labelled label="Colour">
          {(id) => (
            <select
              id={id}
              value={prefs.colorMode}
              onChange={(e) => onChange({ colorMode: e.target.value as HeatColorMode })}
              className={SELECT}
            >
              {HEAT_COLOR_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {COLOR_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          )}
        </Labelled>

        {prefs.colorMode === "solid" && (
          <ColorSwatches value={prefs.lineColor} onChange={(lineColor) => onChange({ lineColor })} label="Line colour" />
        )}

        <Labelled label="Width">
          {(id) => (
            <input
              id={id}
              type="range"
              min={1}
              max={6}
              step={1}
              value={prefs.lineWidth}
              onChange={(e) => onChange({ lineWidth: Number(e.target.value) })}
              className="w-24 accent-ink"
            />
          )}
        </Labelled>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onFit} className={BUTTON} title="Zoom to where most of the routes are">
            <Crosshair className="size-4" aria-hidden="true" />
            Fit
          </button>
          <div role="group" aria-label="Map size" className="flex items-center">
            <button
              type="button"
              aria-label="Smaller map"
              title="Smaller map"
              disabled={isFullscreen || prefs.height === 0}
              onClick={() => onChange({ height: prefs.height - 1 })}
              className={`${BUTTON} rounded-r-none`}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Larger map"
              title="Larger map"
              disabled={isFullscreen || prefs.height === MAP_HEIGHTS.length - 1}
              onClick={() => onChange({ height: prefs.height + 1 })}
              className={`${BUTTON} -ml-px rounded-l-none`}
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          {onToggleFullscreen && (
            <button type="button" onClick={onToggleFullscreen} aria-pressed={isFullscreen} className={BUTTON}>
              {isFullscreen ? (
                <Minimize2 className="size-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="size-4" aria-hidden="true" />
              )}
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label
          className={CHECK_LABEL}
          title="Marks unpaved (dashed) and unknown-surface (dotted) roads you've been on. Looks the area up in OpenStreetMap (Overpass API) once you zoom in."
        >
          <input
            type="checkbox"
            checked={prefs.showSurface}
            onChange={(e) => onChange({ showSurface: e.target.checked })}
            className={CHECKBOX}
          />
          Surface
        </label>

        {BIKE_OVERLAY_IDS.map((id) => (
          <label key={id} className={CHECK_LABEL}>
            <input
              type="checkbox"
              checked={prefs.bikeOverlays.includes(id)}
              onChange={(e) => toggleOverlay(id, e.target.checked)}
              className={CHECKBOX}
            />
            {BIKE_OVERLAYS[id].label}
          </label>
        ))}

        <label className={CHECK_LABEL} title="Places where many of your activities start or finish">
          <input
            type="checkbox"
            checked={prefs.showSpots}
            onChange={(e) => onChange({ showSpots: e.target.checked })}
            className={CHECKBOX}
          />
          Frequent spots
        </label>

        {prefs.showSpots && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <select
              aria-label="Which ends count"
              value={prefs.spotKind}
              onChange={(e) => onChange({ spotKind: e.target.value as SpotKind })}
              className={SELECT}
            >
              {(Object.keys(SPOT_KIND_LABELS) as SpotKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {SPOT_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <Labelled label="at least">
              {(id) => (
                <select
                  id={id}
                  value={prefs.spotMinCount}
                  onChange={(e) => onChange({ spotMinCount: Number(e.target.value) })}
                  className={SELECT}
                >
                  {SPOT_MIN_COUNTS.map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </select>
              )}
            </Labelled>
            <Labelled label="within">
              {(id) => (
                <select
                  id={id}
                  value={prefs.spotRadius}
                  onChange={(e) => onChange({ spotRadius: Number(e.target.value) })}
                  className={SELECT}
                >
                  {SPOT_RADII.map((m) => (
                    <option key={m} value={m}>
                      {m < 1000 ? `${m} m` : `${m / 1000} km`}
                    </option>
                  ))}
                </select>
              )}
            </Labelled>
          </div>
        )}
      </div>
    </div>
  );
}
