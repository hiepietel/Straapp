import type { LatLng } from "./polyline";

/** How the route's surface is drawn: solid, dashed or dotted. */
export type SurfaceClass = "paved" | "unpaved" | "unknown";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
/** How far (m) a road may be from a GPS point and still count as the one being travelled. */
const MATCH_RADIUS_M = 20;
/** Overpass gets a thinned-out copy of the route; the full one is matched locally. */
const MAX_QUERY_POINTS = 800;

const PAVED = new Set([
  "paved", "asphalt", "chipseal", "concrete", "concrete:plates", "concrete:lanes",
  "paving_stones", "paving_stones:lanes", "sett", "unhewn_cobblestone", "cobblestone",
  "bricks", "metal", "wood", "rubber", "tartan", "acrylic",
]);
const UNPAVED = new Set([
  "unpaved", "compacted", "fine_gravel", "gravel", "pebblestone", "rock", "dirt", "earth",
  "ground", "grass", "grass_paver", "mud", "sand", "woodchips", "snow", "ice", "salt",
]);
// Roads this class are asphalt nearly everywhere, even when nobody tagged a surface.
const USUALLY_PAVED = new Set([
  "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
  "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "living_street",
]);

/** One OSM way's surface, from its tags; `unknown` when the tags don't say. */
export function classifyWay(tags: Record<string, string>): SurfaceClass {
  const surface = tags.surface?.split(";")[0]?.trim();
  if (surface && PAVED.has(surface)) return "paved";
  if (surface && UNPAVED.has(surface)) return "unpaved";
  if (tags.highway === "track") return tags.tracktype === "grade1" ? "paved" : "unpaved";
  if (tags.highway && USUALLY_PAVED.has(tags.highway)) return "paved";
  return "unknown";
}

interface OverpassWay {
  type: "way";
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  surface: SurfaceClass;
}

// A flat projection in metres around the route — plenty accurate over a few tens of metres.
function projector(lat0: number) {
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110_540;
  return (lat: number, lng: number): [number, number] => [lng * kx, lat * ky];
}

function distToSegment(px: number, py: number, s: Segment): number {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / len2));
  return Math.hypot(px - (s.ax + t * dx), py - (s.ay + t * dy));
}

/** Evenly thinned points for the query — the whole route would make an enormous request. */
function thin(points: readonly LatLng[]): LatLng[] {
  if (points.length <= MAX_QUERY_POINTS) return [...points];
  const step = (points.length - 1) / (MAX_QUERY_POINTS - 1);
  return Array.from({ length: MAX_QUERY_POINTS }, (_, i) => points[Math.round(i * step)]!);
}

/** GPS jitter at junctions makes single points flip to a crossing road; a small majority vote smooths that. */
function smooth(classes: SurfaceClass[], radius = 3): SurfaceClass[] {
  return classes.map((_, i) => {
    const counts: Record<SurfaceClass, number> = { paved: 0, unpaved: 0, unknown: 0 };
    for (let j = Math.max(0, i - radius); j <= Math.min(classes.length - 1, i + radius); j++) {
      counts[classes[j]!]++;
    }
    return (Object.keys(counts) as SurfaceClass[]).reduce((a, b) => (counts[b] > counts[a] ? b : a), classes[i]!);
  });
}

/**
 * The surface under each point of the route, from the OpenStreetMap roads it runs along.
 * Sends the (thinned) route to the public Overpass API.
 */
export async function fetchRouteSurfaces(points: readonly LatLng[], signal?: AbortSignal): Promise<SurfaceClass[]> {
  const coords = thin(points)
    .map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`)
    .join(",");
  const query = `[out:json][timeout:25];way(around:${MATCH_RADIUS_M},${coords})[highway];out tags geom;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: new URLSearchParams({ data: query }),
    signal: signal ?? null,
  });
  if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
  const { elements } = (await res.json()) as { elements: OverpassWay[] };

  const lat0 = points.reduce((sum, [lat]) => sum + lat, 0) / points.length;
  const project = projector(lat0);

  // Bucket every road segment into a grid so each route point only checks its neighbours.
  const CELL = MATCH_RADIUS_M * 2;
  const grid = new Map<string, Segment[]>();
  const key = (cx: number, cy: number) => `${cx}:${cy}`;
  for (const way of elements) {
    if (way.type !== "way" || !way.geometry || way.geometry.length < 2) continue;
    const surface = classifyWay(way.tags ?? {});
    for (let i = 1; i < way.geometry.length; i++) {
      const [ax, ay] = project(way.geometry[i - 1]!.lat, way.geometry[i - 1]!.lon);
      const [bx, by] = project(way.geometry[i]!.lat, way.geometry[i]!.lon);
      const seg: Segment = { ax, ay, bx, by, surface };
      for (let cx = Math.floor(Math.min(ax, bx) / CELL); cx <= Math.floor(Math.max(ax, bx) / CELL); cx++) {
        for (let cy = Math.floor(Math.min(ay, by) / CELL); cy <= Math.floor(Math.max(ay, by) / CELL); cy++) {
          const k = key(cx, cy);
          const bucket = grid.get(k);
          if (bucket) bucket.push(seg);
          else grid.set(k, [seg]);
        }
      }
    }
  }

  const classes = points.map(([lat, lng]): SurfaceClass => {
    const [px, py] = project(lat, lng);
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    let best: Segment | null = null;
    let bestDist = MATCH_RADIUS_M;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const seg of grid.get(key(cx + dx, cy + dy)) ?? []) {
          const d = distToSegment(px, py, seg);
          if (d < bestDist) {
            bestDist = d;
            best = seg;
          }
        }
      }
    }
    return best?.surface ?? "unknown";
  });

  return smooth(classes);
}
