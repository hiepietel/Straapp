import { useId } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import ColorSwatches from "./ColorSwatches";
import { BASE_LAYERS } from "../../utils/mapStyles";
import type { BaseLayerId } from "../../utils/mapStyles";
import type { LineMode } from "../../hooks/useMapPreferences";

const LINE_MODE_LABELS: Record<LineMode, string> = {
  solid: "One colour",
  speed: "By speed",
  elevation: "By elevation",
};

export interface MapControlsProps {
  baseLayer: BaseLayerId;
  onBaseLayerChange: (id: BaseLayerId) => void;
  routeColor: string;
  onRouteColorChange: (color: string) => void;
  lineMode: LineMode;
  /** The modes this activity has data for; always includes "solid". */
  availableModes: readonly LineMode[];
  onLineModeChange: (mode: LineMode) => void;
  showSurface: boolean;
  onShowSurfaceChange: (show: boolean) => void;
  isFullscreen: boolean;
  /** Omitted where the browser can't go fullscreen (e.g. Safari on iPhone). */
  onToggleFullscreen?: (() => void) | undefined;
}

// The strip above the route map: background, line colour/style and fullscreen.
export default function MapControls({
  baseLayer,
  onBaseLayerChange,
  routeColor,
  onRouteColorChange,
  lineMode,
  availableModes,
  onLineModeChange,
  showSurface,
  onShowSurfaceChange,
  isFullscreen,
  onToggleFullscreen,
}: MapControlsProps) {
  const selectId = useId();
  const lineModeId = useId();

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-chalk px-3 py-2">
      <div className="flex items-center gap-2">
        <label htmlFor={selectId} className="text-sm text-mute">
          Map
        </label>
        <select
          id={selectId}
          value={baseLayer}
          onChange={(e) => onBaseLayerChange(e.target.value as BaseLayerId)}
          className="rounded-md border border-line bg-chalk px-2 py-1 text-sm font-semibold"
        >
          {BASE_LAYERS.map((layer) => (
            <option key={layer.id} value={layer.id}>
              {layer.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor={lineModeId} className="text-sm text-mute">
          Line
        </label>
        <select
          id={lineModeId}
          value={lineMode}
          onChange={(e) => onLineModeChange(e.target.value as LineMode)}
          className="rounded-md border border-line bg-chalk px-2 py-1 text-sm font-semibold"
        >
          {availableModes.map((mode) => (
            <option key={mode} value={mode}>
              {LINE_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>

      {lineMode === "solid" && <ColorSwatches value={routeColor} onChange={onRouteColorChange} />}

      <label
        className="flex cursor-pointer items-center gap-2 text-sm font-semibold"
        title="Paved roads solid, unpaved dashed, unknown dotted. Looks the route up in OpenStreetMap (Overpass API)."
      >
        <input
          type="checkbox"
          checked={showSurface}
          onChange={(e) => onShowSurfaceChange(e.target.checked)}
          className="size-4 accent-ink"
        />
        Surface
      </label>

      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-pressed={isFullscreen}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-sm font-semibold hover:bg-pavement"
        >
          {isFullscreen ? (
            <Minimize2 className="size-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="size-4" aria-hidden="true" />
          )}
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      )}
    </div>
  );
}
