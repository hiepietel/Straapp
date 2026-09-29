import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapControls from "../molecules/MapControls";
import MapLegend from "../molecules/MapLegend";
import { useMapPreferences } from "../../hooks/useMapPreferences";
import type { LineMode } from "../../hooks/useMapPreferences";
import { useRouteSurfaces } from "../../hooks/useRouteSurfaces";
import { ELEVATION_RAMP, SPEED_RAMP, rampColor } from "../../utils/colorRamp";
import { SURFACE_DASH, measureAtPoints, measureScale, styleRuns } from "../../utils/routeStyling";
import type { RouteMeasure } from "../../utils/routeStyling";
import { getBaseLayer } from "../../utils/mapStyles";
import { decodePolyline } from "../../utils/polyline";
import { lowerBound, pointFractions } from "../../utils/routeFraction";
import type { FractionRange } from "../../utils/routeFraction";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const FIT_PADDING: L.PointTuple = [24, 24];

// Safari on iPhone has no Fullscreen API for ordinary elements; the button is hidden there.
const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;

export interface RouteMapProps {
  polyline: string | null | undefined;
  /** Sizing for the map area itself (the controls sit above it). Ignored while fullscreen. */
  className?: string;
  /** Where along the route (0–1) a chart below is hovered/focused — drives a moving marker
   *  here, `null` when nothing's hovered. Omit entirely on a map with no synced charts. */
  hoverFraction?: number | null;
  /** A stretch of the route to pick out (e.g. the split being looked at), as distance fractions. */
  highlightRange?: FractionRange | null;
  /** Measures the route can be coloured by; a gradient option only appears when its measure is here. */
  measures?: Partial<Record<Exclude<LineMode, "solid">, RouteMeasure>>;
}

const RAMPS = { speed: SPEED_RAMP, elevation: ELEVATION_RAMP } as const;

// A real map of the route, in place of RouteTrace's abstract outline (which stays as-is
// for the small, stylised previews on the activity cards).
export default function RouteMap({
  polyline,
  className = "",
  hoverFraction = null,
  highlightRange = null,
  measures = {},
}: RouteMapProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const routeRendererRef = useRef<L.Canvas | null>(null);
  const startMarkerRef = useRef<L.CircleMarker | null>(null);
  const cursorMarkerRef = useRef<L.CircleMarker | null>(null);
  const highlightRef = useRef<L.LayerGroup | null>(null);
  const points = useMemo(() => decodePolyline(polyline ?? ""), [polyline]);
  // How far along the route each point is, to place the shared distance fractions on it.
  const fractions = useMemo(() => pointFractions(points), [points]);

  const [prefs, setPrefs] = useMapPreferences();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fall back to a plain line when the chosen measure wasn't recorded (e.g. no altitude).
  const availableModes: LineMode[] = ["solid", ...(["speed", "elevation"] as const).filter((m) => measures[m])];
  const lineMode: LineMode = availableModes.includes(prefs.lineMode) ? prefs.lineMode : "solid";
  const measure = lineMode === "solid" ? undefined : measures[lineMode];
  const scale = useMemo(() => (measure ? measureScale(measure) : null), [measure]);
  const levels = useMemo(
    () => (measure && scale ? measureAtPoints(measure, fractions, scale) : null),
    [measure, scale, fractions]
  );
  const surface = useRouteSurfaces(polyline ?? "", points, prefs.showSurface);

  useEffect(() => {
    if (!containerRef.current || points.length < 2) return;

    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    mapRef.current = map;

    const latlngs = points.map(([lat, lng]) => L.latLng(lat, lng));
    boundsRef.current = L.latLngBounds(latlngs);
    // The route line is drawn by an effect below (it can be many small styled pieces), on a
    // canvas in its own pane under the markers, so redrawing it never covers them.
    map.createPane("route").style.zIndex = "390";
    routeRendererRef.current = L.canvas({ pane: "route" });

    // Filled dot at the start, hollow at the end — mirrors RouteTrace's own convention.
    startMarkerRef.current = L.circleMarker(latlngs[0]!, {
      radius: 6,
      color: "#1b2125",
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);
    L.circleMarker(latlngs[latlngs.length - 1]!, {
      radius: 6,
      color: "#1b2125",
      weight: 2,
      fillColor: "#f7f8f8",
      fillOpacity: 1,
    }).addTo(map);

    map.fitBounds(boundsRef.current, { padding: FIT_PADDING });

    // The container's final size can settle a frame after this effect runs (e.g. it just
    // became visible inside a collapsible section), so Leaflet's cached size can be stale.
    const raf = requestAnimationFrame(() => map.invalidateSize());

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      // All removed along with the map that owned them.
      boundsRef.current = null;
      routeRendererRef.current = null;
      startMarkerRef.current = null;
      cursorMarkerRef.current = null;
      highlightRef.current = null;
    };
  }, [points]);

  // Map type. `points` is a dependency so a freshly rebuilt map gets its tiles too.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const { url, attribution, maxZoom, maxNativeZoom, subdomains } = getBaseLayer(prefs.baseLayer);
    const tiles = L.tileLayer(url, {
      attribution,
      maxZoom,
      ...(maxNativeZoom && { maxNativeZoom }),
      ...(subdomains && { subdomains }),
    }).addTo(map);
    map.setMaxZoom(maxZoom);

    return () => {
      tiles.remove();
    };
  }, [prefs.baseLayer, points]);

  // The route line itself: one colour or a gradient, solid or dashed by surface.
  useEffect(() => {
    const map = mapRef.current;
    const renderer = routeRendererRef.current;
    if (!map || !renderer || points.length < 2) return;

    const ramp = lineMode === "solid" ? undefined : RAMPS[lineMode];
    const surfaces = surface.status === "ready" ? surface.surfaces : null;
    const runs = styleRuns(points.length, {
      color: prefs.routeColor,
      ...(ramp && levels && { ramp, levels }),
      surfaces,
    });

    const latlngs = points.map(([lat, lng]) => L.latLng(lat, lng));
    const layers: L.Layer[] = [];
    // A gradient passes through light colours, so a dark casing keeps it readable on any map.
    // Not under dashes, though — the casing would fill in their gaps.
    if (ramp && !surfaces) {
      layers.push(L.polyline(latlngs, { renderer, color: "#1b2125", weight: 7, opacity: 0.55, interactive: false }));
    }
    for (const run of runs) {
      const dashArray = run.surface ? SURFACE_DASH[run.surface] : undefined;
      layers.push(
        L.polyline(latlngs.slice(run.from, run.to + 1), {
          renderer,
          color: run.color,
          weight: run.surface === "unknown" ? 5 : 4,
          lineJoin: "round",
          lineCap: run.surface === "unpaved" ? "butt" : "round",
          interactive: false,
          ...(dashArray && { dashArray }),
        })
      );
    }
    const group = L.layerGroup(layers).addTo(map);

    startMarkerRef.current?.setStyle({ fillColor: ramp ? rampColor(ramp, levels?.[0] ?? 0) : prefs.routeColor });

    return () => {
      group.remove();
    };
  }, [points, lineMode, levels, prefs.routeColor, surface.status, surface.surfaces]);

  // Track fullscreen from the browser's own event, so Esc (which never reaches React) is covered.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Entering or leaving fullscreen resizes the map: let Leaflet re-measure, then re-frame the
  // route. Scroll-to-zoom only in fullscreen, where there's no page to scroll instead.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isFullscreen) map.scrollWheelZoom.enable();
    else map.scrollWheelZoom.disable();

    const raf = requestAnimationFrame(() => {
      map.invalidateSize();
      if (boundsRef.current) map.fitBounds(boundsRef.current, { padding: FIT_PADDING });
    });
    return () => cancelAnimationFrame(raf);
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      frameRef.current?.requestFullscreen().catch(() => {
        // Refused (e.g. blocked by a permissions policy): the map just stays inline.
      });
    }
  }, []);

  // The highlighted stretch: a dark casing with a white core, so it stands out whatever
  // colour the route itself is drawn in. Sits under the markers, over the route.
  useEffect(() => {
    const map = mapRef.current;
    highlightRef.current?.remove();
    highlightRef.current = null;
    if (!map || !highlightRange || points.length < 2) return;

    const from = lowerBound(fractions, highlightRange.start);
    const to = Math.max(from + 1, Math.min(lowerBound(fractions, highlightRange.end), points.length - 1));
    const latlngs = points.slice(from, to + 1).map(([lat, lng]) => L.latLng(lat, lng));
    highlightRef.current = L.layerGroup([
      L.polyline(latlngs, { color: "#1b2125", weight: 10, lineCap: "round", lineJoin: "round" }),
      L.polyline(latlngs, { color: "#ffffff", weight: 4, lineCap: "round", lineJoin: "round" }),
    ]).addTo(map);
    startMarkerRef.current?.bringToFront();
    cursorMarkerRef.current?.bringToFront();
  }, [highlightRange, points, fractions]);

  // A separate effect so scrubbing a chart only moves a marker, never rebuilds the map.
  // The hover position is a fraction of distance; `fractions` finds the GPS point there.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || points.length < 2) return;

    if (hoverFraction === null) {
      cursorMarkerRef.current?.remove();
      cursorMarkerRef.current = null;
      return;
    }

    const [lat, lng] = points[lowerBound(fractions, clamp(hoverFraction, 0, 1))]!;
    const point = L.latLng(lat, lng);

    if (cursorMarkerRef.current) {
      cursorMarkerRef.current.setLatLng(point);
    } else {
      cursorMarkerRef.current = L.circleMarker(point, {
        radius: 7,
        color: "#1b2125",
        weight: 2,
        fillColor: "#2e6dA4",
        fillOpacity: 1,
      }).addTo(map);
    }
  }, [hoverFraction, points, fractions]);

  if (points.length < 2) return null;

  return (
    <div
      ref={frameRef}
      className={`flex flex-col overflow-hidden bg-chalk ${
        isFullscreen ? "size-full" : "rounded-lg border border-line"
      }`}
    >
      <MapControls
        baseLayer={prefs.baseLayer}
        onBaseLayerChange={(baseLayer) => setPrefs({ baseLayer })}
        routeColor={prefs.routeColor}
        onRouteColorChange={(routeColor) => setPrefs({ routeColor })}
        lineMode={lineMode}
        availableModes={availableModes}
        onLineModeChange={(mode) => setPrefs({ lineMode: mode })}
        showSurface={prefs.showSurface}
        onShowSurfaceChange={(showSurface) => setPrefs({ showSurface })}
        isFullscreen={isFullscreen}
        onToggleFullscreen={canFullscreen ? toggleFullscreen : undefined}
      />
      {/* Sizing lives on this wrapper: Leaflet adds its own classes to the map container,
          and a className React changes there (e.g. on entering fullscreen) would wipe them. */}
      <div className={`relative ${isFullscreen ? "min-h-0 flex-1" : className}`}>
        <div ref={containerRef} className="size-full" aria-label="Map of the route" />
        <MapLegend
          gradient={
            measure && scale && lineMode !== "solid"
              ? { title: measure.title, ramp: RAMPS[lineMode], low: measure.format(scale.low), high: measure.format(scale.high) }
              : null
          }
          surfaceStatus={surface.status}
          surfaceError={surface.error}
        />
      </div>
    </div>
  );
}
