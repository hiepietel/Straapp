import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import HeatmapControls from "../molecules/HeatmapControls";
import HeatmapLegend from "../molecules/HeatmapLegend";
import type { AreaSurfaceStatus } from "../molecules/HeatmapLegend";
import { MAP_HEIGHTS, useHeatmapPreferences } from "../../hooks/useHeatmapPreferences";
import { activityHref } from "../../hooks/useRoute";
import { HEAT_RAMP, rampColor } from "../../utils/colorRamp";
import {
  HEAT_STEPS,
  buildHeatGrid,
  coreBounds,
  frequentSpots,
  heatRuns,
  projectionFor,
  routesNear,
} from "../../utils/heatmap";
import { BIKE_OVERLAYS, getBaseLayer } from "../../utils/mapStyles";
import { fetchAreaSurfaces } from "../../utils/roadSurface";
import { fromTile, largestSquare, tileOf, tileRing, toTile, visitedTiles } from "../../utils/squadrats";
import type { AreaBounds, SurfaceWay } from "../../utils/roadSurface";
import { SURFACE_DASH } from "../../utils/routeStyling";
import { GROUPS } from "../../utils/sports";
import type { SportGroupId } from "../../utils/sports";
import { OVERFLOW_COLOR, gearColor } from "../../utils/gearStats";
import { formatDistance, formatShortDate } from "../../utils/format";
import { getErrorMessage } from "../../utils/errors";
import type { LatLng } from "../../utils/polyline";
import type { HeatmapGear, HeatmapRoute } from "../../types/heatmap";

/** A route with its polyline already decoded. */
export interface MapRoute extends HeatmapRoute {
  points: LatLng[];
}

export interface HeatmapMapProps {
  routes: readonly MapRoute[];
  /** Every gear in the report, most used first: fixes each one's colour whatever is filtered. */
  gear: readonly HeatmapGear[];
  /** The map re-frames itself whenever this changes (a new date range was loaded). */
  fitKey: unknown;
}

const FIT_PADDING: L.PointTuple = [24, 24];
/** Surfaces are only looked up this close in: further out the area holds too many roads. */
const SURFACE_MIN_ZOOM = 15;
/** How far (screen px) a click may be from a line and still pick its activity. */
const CLICK_TOLERANCE_PX = 8;
const POPUP_MAX_ITEMS = 8;

const SPORT_COLORS: Record<SportGroupId, string> = {
  run: "#eb6834",
  ride: "#2a78d6",
  walk: "#1baf7a",
  swim: "#4a3aa7",
  other: "#e87ba4",
};
const SPOT_COLOR = "#c2185b";
const SQUADRAT_COLOR = "#6d28d9";
/** The grid is drawn once its tiles are at least this many screen pixels wide. */
const GRID_MIN_TILE_PX = 12;

const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;

// Leaflet takes mutable tuples; ours are read-only but otherwise the same.
const toLeaflet = (lines: readonly (readonly LatLng[])[]) => lines as unknown as L.LatLngTuple[][];

const metresPerPixel = (map: L.Map) =>
  (40_075_016.686 * Math.cos((map.getCenter().lat * Math.PI) / 180)) / 2 ** (map.getZoom() + 8);

const contains = (outer: AreaBounds, inner: L.LatLngBounds) =>
  inner.getSouth() >= outer.south && inner.getNorth() <= outer.north && inner.getWest() >= outer.west && inner.getEast() <= outer.east;

/** A small list of the activities under a click, built as DOM so names are never parsed as HTML. */
function popupContent(routes: readonly MapRoute[]): HTMLElement {
  const root = document.createElement("div");
  const title = document.createElement("p");
  title.className = "font-semibold mb-1";
  title.textContent = routes.length === 1 ? "1 activity here" : `${routes.length} activities here`;
  root.append(title);

  const list = document.createElement("ul");
  list.className = "space-y-0.5";
  for (const route of routes.slice(0, POPUP_MAX_ITEMS)) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = activityHref(route.id);
    link.textContent = route.name || "Untitled";
    link.className = "font-semibold";
    const meta = document.createElement("span");
    meta.className = "text-mute";
    meta.textContent = ` · ${formatShortDate(route.date)} · ${formatDistance(route.distance)}`;
    item.append(link, meta);
    list.append(item);
  }
  root.append(list);
  if (routes.length > POPUP_MAX_ITEMS) {
    const more = document.createElement("p");
    more.className = "text-mute mt-1";
    more.textContent = `and ${routes.length - POPUP_MAX_ITEMS} more`;
    root.append(more);
  }
  return root;
}

// Every route on one map: coloured by how often you've been there, or by colour, sport or gear,
// with optional road surfaces, cycling overlays and the places you usually start and finish.
export default function HeatmapMap({ routes, gear, fitKey }: HeatmapMapProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeRendererRef = useRef<L.Canvas | null>(null);
  const surfaceRendererRef = useRef<L.Canvas | null>(null);
  const [prefs, setPrefs] = useHeatmapPreferences();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const points = useMemo(() => routes.map((r) => r.points), [routes]);
  const projection = useMemo(() => projectionFor(points), [points]);
  const needGrid = prefs.colorMode === "heat" || prefs.showSurface;
  // The slow part with thousands of routes (a second or so), so only while something uses it.
  const grid = useMemo(() => (needGrid ? buildHeatGrid(points, projection) : null), [needGrid, points, projection]);

  // Latest routes for the fit button and click handler, without making them rebuild on every filter.
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const routesRef = useRef(routes);
  routesRef.current = routes;

  const fit = useCallback(() => {
    const map = mapRef.current;
    const bounds = coreBounds(pointsRef.current);
    if (map && bounds) map.fitBounds(bounds, { padding: FIT_PADDING });
  }, []);

  // The map itself, once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { center: [50, 10], zoom: 4 });
    mapRef.current = map;
    // Lines on canvases in their own panes, under markers: road surfaces go over the routes they describe.
    // Visited tiles go under everything else drawn on the map.
    map.createPane("squadrats").style.zIndex = "380";
    map.createPane("routes").style.zIndex = "390";
    map.createPane("surfaces").style.zIndex = "395";
    routeRendererRef.current = L.canvas({ pane: "routes" });
    surfaceRendererRef.current = L.canvas({ pane: "surfaces" });
    const raf = requestAnimationFrame(() => map.invalidateSize());
    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      routeRendererRef.current = null;
      surfaceRendererRef.current = null;
    };
  }, []);

  // Frame the routes when a new date range arrives (and the first time).
  useEffect(() => {
    fit();
  }, [fitKey, fit]);

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
  }, [prefs.baseLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = prefs.bikeOverlays.map((id, i) => {
      const { url, attribution, maxZoom, ...rest } = BIKE_OVERLAYS[id];
      const subdomains = "subdomains" in rest ? rest.subdomains : undefined;
      return L.tileLayer(url, { attribution, maxZoom, zIndex: 2 + i, ...(subdomains && { subdomains }) }).addTo(map);
    });
    return () => layers.forEach((layer) => layer.remove());
  }, [prefs.bikeOverlays]);

  // Colour groups for "by sport" / "by gear": which group each route is in, and the legend.
  const groups = useMemo(() => {
    if (prefs.colorMode === "sport") {
      const present = new Set(routes.map((r) => r.sport));
      return (Object.keys(GROUPS) as SportGroupId[])
        .filter((id) => present.has(id))
        .map((id) => ({
          label: GROUPS[id].label,
          color: SPORT_COLORS[id],
          lines: routes.filter((r) => r.sport === id).map((r) => r.points),
        }));
    }
    if (prefs.colorMode === "gear") {
      const byGear = new Map<string, MapRoute[]>();
      for (const r of routes) {
        const key = r.gearId ?? "";
        const list = byGear.get(key);
        if (list) list.push(r);
        else byGear.set(key, [r]);
      }
      const known = gear
        .map((g, rank) => ({ label: g.name, color: gearColor(rank), lines: (byGear.get(g.id) ?? []).map((r) => r.points) }))
        .filter((g) => g.lines.length > 0);
      const none = byGear.get("") ?? [];
      return none.length ? [...known, { label: "No gear", color: OVERFLOW_COLOR, lines: none.map((r) => r.points) }] : known;
    }
    return null;
  }, [prefs.colorMode, routes, gear]);

  const heat = useMemo(
    () => (prefs.colorMode === "heat" && grid ? heatRuns(points, grid) : null),
    [prefs.colorMode, grid, points]
  );

  // The lines. One Leaflet layer per colour, however many activities: a canvas draws that quickly.
  useEffect(() => {
    const map = mapRef.current;
    const renderer = routeRendererRef.current;
    if (!map || !renderer) return;
    const style = { renderer, weight: prefs.lineWidth, lineCap: "round", lineJoin: "round", interactive: false } as const;

    const layers: L.Layer[] = [];
    if (heat) {
      // Coldest first, so the busiest roads are drawn on top.
      heat.forEach((lines, step) => {
        if (lines.length === 0) return;
        const color = rampColor(HEAT_RAMP, step / (HEAT_STEPS - 1));
        layers.push(L.polyline(toLeaflet(lines), { ...style, color, opacity: 0.9 }));
      });
    } else if (groups) {
      // Biggest group first, so the rarer ones stay visible on top.
      [...groups]
        .sort((a, b) => b.lines.length - a.lines.length)
        .forEach((g) => layers.push(L.polyline(toLeaflet(g.lines), { ...style, color: g.color, opacity: 0.8 })));
    } else if (prefs.colorMode === "solid" && points.length) {
      layers.push(L.polyline(toLeaflet(points), { ...style, color: prefs.lineColor, opacity: 0.8 }));
    }
    const group = L.layerGroup(layers).addTo(map);
    return () => {
      group.remove();
    };
  }, [heat, groups, points, prefs.colorMode, prefs.lineColor, prefs.lineWidth]);

  // Road surfaces: every road in view from OpenStreetMap, fetched as the map settles, for a
  // somewhat larger area so small pans don't ask again.
  const [surface, setSurface] = useState<{ area: AreaBounds; ways: SurfaceWay[] } | null>(null);
  const [surfaceStatus, setSurfaceStatus] = useState<AreaSurfaceStatus>("off");
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !prefs.showSurface) {
      setSurfaceStatus("off");
      return;
    }

    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cached: AreaBounds | null = surface?.area ?? null;

    const update = () => {
      clearTimeout(timer);
      if (map.getZoom() < SURFACE_MIN_ZOOM) {
        controller?.abort();
        setSurfaceStatus("zoom");
        return;
      }
      const view = map.getBounds();
      if (cached && contains(cached, view)) {
        setSurfaceStatus("ready");
        return;
      }
      timer = setTimeout(() => {
        const padded = view.pad(0.3);
        const area = { south: padded.getSouth(), west: padded.getWest(), north: padded.getNorth(), east: padded.getEast() };
        controller?.abort();
        const current = new AbortController();
        controller = current;
        setSurfaceStatus("loading");
        setSurfaceError(null);
        fetchAreaSurfaces(area, current.signal).then(
          (ways) => {
            cached = area;
            setSurface({ area, ways });
            setSurfaceStatus("ready");
          },
          (err: unknown) => {
            if (current.signal.aborted) return;
            setSurfaceError(getErrorMessage(err));
            setSurfaceStatus("error");
          }
        );
      }, 400);
    };

    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
      clearTimeout(timer);
      controller?.abort();
    };
    // `surface` is read once to start from what's already loaded, not as a trigger.
  }, [prefs.showSurface]);

  // Only the roads you've been on, and only the ones worth pointing out: paved is the default.
  useEffect(() => {
    const map = mapRef.current;
    const renderer = surfaceRendererRef.current;
    if (!map || !renderer || !prefs.showSurface || !surface || !grid) return;

    const ink = prefs.baseLayer === "satellite" ? "#f7f8f8" : "#1b2125";
    const lines: Record<"unpaved" | "unknown", LatLng[][]> = { unpaved: [], unknown: [] };
    for (const way of surface.ways) {
      if (way.surface === "paved") continue;
      // Split into the stretches you actually travelled, segment by segment.
      let run: LatLng[] = [];
      for (let i = 0; i < way.points.length - 1; i++) {
        const [aLat, aLng] = way.points[i]!;
        const [bLat, bLng] = way.points[i + 1]!;
        if (grid.countAt((aLat + bLat) / 2, (aLng + bLng) / 2) > 0) {
          if (run.length === 0) run.push(way.points[i]!);
          run.push(way.points[i + 1]!);
        } else if (run.length) {
          lines[way.surface].push(run);
          run = [];
        }
      }
      if (run.length) lines[way.surface].push(run);
    }

    const layers = (["unpaved", "unknown"] as const)
      .filter((s) => lines[s].length)
      .map((s) =>
        L.polyline(toLeaflet(lines[s]), {
          renderer,
          color: ink,
          weight: Math.max(2, prefs.lineWidth - 1),
          dashArray: SURFACE_DASH[s],
          lineCap: s === "unpaved" ? "butt" : "round",
          interactive: false,
        })
      );
    const group = L.layerGroup(layers).addTo(map);
    return () => {
      group.remove();
    };
  }, [surface, grid, prefs.showSurface, prefs.baseLayer, prefs.lineWidth]);

  // Squadrats: every visited tile as one filled shape, the largest square outlined, and the grid.
  const squadrats = useMemo(() => {
    const zoom = prefs.squadratZoom;
    if (zoom === null) return null;
    const tiles = visitedTiles(points, zoom);
    return { zoom, tiles, largest: largestSquare(tiles) };
  }, [prefs.squadratZoom, points]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !squadrats) return;
    const renderer = L.canvas({ pane: "squadrats" });
    const { zoom, tiles, largest } = squadrats;
    const rings = [...tiles].map((key) => {
      const [x, y] = tileOf(key);
      return tileRing(x, y, zoom);
    });
    const layers: L.Layer[] = [
      // Nested rings make one multi-polygon: a single layer however many tiles there are.
      L.polygon(rings.map((r) => [r]) as unknown as L.LatLngTuple[][][], {
        renderer,
        pane: "squadrats",
        stroke: false,
        fillColor: SQUADRAT_COLOR,
        fillOpacity: 0.28,
        interactive: false,
      }),
    ];
    if (largest && largest.size > 1) {
      layers.push(
        L.polygon(toLeaflet([tileRing(largest.x, largest.y, zoom, largest.size)]), {
          renderer,
          pane: "squadrats",
          color: SQUADRAT_COLOR,
          weight: 3,
          fill: false,
          interactive: false,
        })
      );
    }
    const group = L.layerGroup(layers).addTo(map);

    // The grid, for the area in view, once tiles are big enough on screen to tell apart.
    const grid = L.layerGroup().addTo(map);
    const drawGrid = () => {
      grid.clearLayers();
      if (256 / 2 ** (zoom - map.getZoom()) < GRID_MIN_TILE_PX) return;
      const view = map.getBounds();
      const [x0, y0] = toTile(view.getNorth(), view.getWest(), zoom);
      const [x1, y1] = toTile(view.getSouth(), view.getEast(), zoom);
      const lines: LatLng[][] = [];
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        lines.push([fromTile(x, Math.floor(y0), zoom), fromTile(x, Math.ceil(y1), zoom)]);
      }
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        lines.push([fromTile(Math.floor(x0), y, zoom), fromTile(Math.ceil(x1), y, zoom)]);
      }
      grid.addLayer(
        L.polyline(toLeaflet(lines), { renderer, color: SQUADRAT_COLOR, weight: 1, opacity: 0.45, interactive: false })
      );
    };
    drawGrid();
    map.on("moveend", drawGrid);

    return () => {
      map.off("moveend", drawGrid);
      group.remove();
      grid.remove();
      renderer.remove();
    };
  }, [squadrats]);

  // Frequent start and finish spots.
  const spots = useMemo(
    () =>
      prefs.showSpots
        ? frequentSpots(points, projection, { kind: prefs.spotKind, radiusM: prefs.spotRadius, minCount: prefs.spotMinCount })
        : [],
    [prefs.showSpots, prefs.spotKind, prefs.spotRadius, prefs.spotMinCount, points, projection]
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!map || spots.length === 0) return;
    const markers = spots.map((spot) => {
      const count = spot.starts + spot.finishes;
      const parts = [
        spot.starts && `${spot.starts} ${spot.starts === 1 ? "start" : "starts"}`,
        spot.finishes && `${spot.finishes} ${spot.finishes === 1 ? "finish" : "finishes"}`,
      ].filter(Boolean);
      return L.circleMarker([spot.lat, spot.lng], {
        radius: Math.min(24, 5 + 2 * Math.sqrt(count)),
        color: "#ffffff",
        weight: 2,
        fillColor: SPOT_COLOR,
        fillOpacity: 0.85,
        bubblingMouseEvents: false,
      }).bindTooltip(parts.join(" · "));
    });
    const group = L.layerGroup(markers).addTo(map);
    return () => {
      group.remove();
    };
  }, [spots]);

  // A click lists the activities that went through there.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const all = routesRef.current;
      const hits = routesNear(
        all.map((r) => r.points),
        [e.latlng.lat, e.latlng.lng],
        CLICK_TOLERANCE_PX * metresPerPixel(map)
      )
        .map((i) => all[i]!)
        .reverse(); // newest first
      if (hits.length) L.popup({ maxWidth: 320 }).setLatLng(e.latlng).setContent(popupContent(hits)).openOn(map);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, []);

  // Track fullscreen from the browser's own event, so Esc (which never reaches React) is covered.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Any change of size: let Leaflet re-measure, keeping the same centre.
  useEffect(() => {
    const raf = requestAnimationFrame(() => mapRef.current?.invalidateSize());
    return () => cancelAnimationFrame(raf);
  }, [isFullscreen, prefs.height]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      frameRef.current?.requestFullscreen().catch(() => {
        // Refused (e.g. blocked by a permissions policy): the map just stays inline.
      });
    }
  }, []);

  const heightClass = MAP_HEIGHTS[prefs.height] ?? MAP_HEIGHTS[1];

  return (
    <div
      ref={frameRef}
      className={`flex flex-col overflow-hidden bg-chalk ${isFullscreen ? "size-full" : "rounded-lg border border-line"}`}
    >
      <HeatmapControls
        prefs={prefs}
        onChange={setPrefs}
        onFit={fit}
        isFullscreen={isFullscreen}
        onToggleFullscreen={canFullscreen ? toggleFullscreen : undefined}
      />
      {/* Sizing lives on this wrapper: Leaflet adds its own classes to the map container. */}
      <div className={`relative ${isFullscreen ? "min-h-0 flex-1" : `${heightClass} min-h-80`}`}>
        <div ref={containerRef} className="size-full" aria-label="Map of every route" />
        <HeatmapLegend
          heat={heat && grid ? { ramp: HEAT_RAMP, max: grid.max } : null}
          groups={groups?.map(({ label, color }) => ({ label, color })) ?? null}
          surfaceStatus={surfaceStatus}
          surfaceError={surfaceError}
          showSpots={prefs.showSpots && spots.length > 0}
          spotColor={SPOT_COLOR}
          squadrats={
            squadrats && {
              label: squadrats.zoom === 14 ? "Squadrats" : squadrats.zoom === 17 ? "Squadratinhos" : `Zoom ${squadrats.zoom} tiles`,
              color: SQUADRAT_COLOR,
              count: squadrats.tiles.size,
              largest: squadrats.largest?.size ?? 0,
            }
          }
        />
      </div>
    </div>
  );
}
