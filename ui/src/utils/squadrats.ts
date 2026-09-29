import type { LatLng } from "./polyline";

/*
 * Squadrats: the tiles of the standard web-map grid (the same x/y/zoom every tile server uses),
 * as counted by squadrats.com and VeloViewer. Zoom 14 tiles are "squadrats" (about 1.5 km across
 * in central Europe), zoom 17 tiles are "squadratinhos" (about 190 m).
 */

/** Tile zooms on offer, biggest tiles first. */
export const SQUADRAT_ZOOMS = [12, 13, 14, 15, 16, 17, 18] as const;
export type SquadratZoom = (typeof SQUADRAT_ZOOMS)[number];

export const squadratLabel = (zoom: SquadratZoom): string =>
  zoom === 14 ? "Squadrats (zoom 14)" : zoom === 17 ? "Squadratinhos (zoom 17)" : `Zoom ${zoom}`;

/** How often (in tiles) a route is sampled: finer than a tile, so a route crossing one isn't missed. */
const STEP_TILES = 0.2;
/** Segments longer than this many zoom-14 tiles (~15 km) are GPS glitches or ferries: not ground covered. */
const MAX_SEGMENT_Z14_TILES = 10;

// A tile's x and y packed into one safe integer, for a plain Set<number>. Fine up to zoom 22.
const ROW = 2 ** 22;
export const tileKey = (x: number, y: number): number => x * ROW + y;
export const tileOf = (key: number): [x: number, y: number] => [Math.floor(key / ROW), key % ROW];

/** Where a point is on the zoom's tile grid, in (fractional) tiles. */
export function toTile(lat: number, lng: number, zoom: number): [x: number, y: number] {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n];
}

/** The latitude and longitude of a tile-grid position. */
export function fromTile(x: number, y: number, zoom: number): LatLng {
  const n = 2 ** zoom;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return [lat, (x / n) * 360 - 180];
}

/** Every tile at `zoom` any of the routes passes through. */
export function visitedTiles(routes: readonly (readonly LatLng[])[], zoom: number): Set<number> {
  const tiles = new Set<number>();
  const maxSegment = MAX_SEGMENT_Z14_TILES * 2 ** (zoom - 14);
  for (const points of routes) {
    let prev: [number, number] | null = null;
    for (const [lat, lng] of points) {
      const cur = toTile(lat, lng, zoom);
      if (prev) {
        const dx = cur[0] - prev[0];
        const dy = cur[1] - prev[1];
        const length = Math.hypot(dx, dy);
        if (length <= maxSegment) {
          const steps = Math.max(1, Math.ceil(length / STEP_TILES));
          for (let s = 1; s < steps; s++) {
            tiles.add(tileKey(Math.floor(prev[0] + (dx * s) / steps), Math.floor(prev[1] + (dy * s) / steps)));
          }
        }
      }
      tiles.add(tileKey(Math.floor(cur[0]), Math.floor(cur[1])));
      prev = cur;
    }
  }
  return tiles;
}

/** A square block of tiles: its top-left tile and how many tiles along each side. */
export interface TileSquare {
  x: number;
  y: number;
  size: number;
}

/**
 * The largest square of visited tiles (squadrats' "übersquadrat"). The classic dynamic programme:
 * a tile ends a square one bigger than the smallest of those ending left, above and diagonally.
 */
export function largestSquare(tiles: ReadonlySet<number>): TileSquare | null {
  const sorted = [...tiles].map(tileOf).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const sizes = new Map<number, number>();
  let best: TileSquare | null = null;
  for (const [x, y] of sorted) {
    const size =
      1 +
      Math.min(
        sizes.get(tileKey(x - 1, y)) ?? 0,
        sizes.get(tileKey(x, y - 1)) ?? 0,
        sizes.get(tileKey(x - 1, y - 1)) ?? 0
      );
    sizes.set(tileKey(x, y), size);
    if (!best || size > best.size) best = { x: x - size + 1, y: y - size + 1, size };
  }
  return best;
}

/** The corners of a block of tiles, as a closed ring for a polygon. */
export function tileRing(x: number, y: number, zoom: number, size = 1): LatLng[] {
  return [fromTile(x, y, zoom), fromTile(x + size, y, zoom), fromTile(x + size, y + size, zoom), fromTile(x, y + size, zoom)];
}
