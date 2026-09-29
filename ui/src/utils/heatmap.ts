import type { LatLng } from "./polyline";

/**
 * Edge of a heat cell, metres: about a road's width plus GPS error, so two passes along the
 * same street land in the same (or a neighbouring) cell.
 */
export const HEAT_CELL_M = 25;
/** Segments longer than this are GPS glitches or ferries, not ground covered: drawn, not counted. */
const MAX_COUNTED_SEGMENT_M = 20_000;

// Cell coordinates packed into one safe integer, so the grid is a plain Map<number, …>.
const OFFSET = 2 ** 21;
const ROW = 2 ** 22;
const cellKey = (cx: number, cy: number) => (cx + OFFSET) * ROW + (cy + OFFSET);

/** A flat projection in metres. Accurate enough for cells tens of metres wide around `lat0`. */
export interface Projection {
  kx: number;
  ky: number;
}

export function projectionFor(routes: readonly (readonly LatLng[])[]): Projection {
  const lats = routes.flatMap((r) => (r.length ? [r[0]![0]] : [])).sort((a, b) => a - b);
  const lat0 = lats.length ? lats[Math.floor(lats.length / 2)]! : 0;
  return { kx: 111_320 * Math.cos((lat0 * Math.PI) / 180), ky: 110_540 };
}

export interface HeatGrid {
  /** How many different activities passed through the cell at this point, or the busiest cell next to it. */
  countAt: (lat: number, lng: number) => number;
  /** The highest count anywhere. */
  max: number;
}

// Each cell's value packs its count with the last route that counted there, so one Map lookup
// both de-duplicates and counts: count * ROUTE_SLOTS + route % ROUTE_SLOTS.
const ROUTE_SLOTS = 2 ** 17;

/**
 * Counts, for every cell the routes pass through, how many different activities went through it.
 * Once per activity: riding up and down a street in one ride counts once. Reading takes the busiest
 * of the 3×3 cells around a point, so GPS drift between two neighbouring cells doesn't halve a road.
 */
export function buildHeatGrid(routes: readonly (readonly LatLng[])[], projection: Projection): HeatGrid {
  const { kx, ky } = projection;
  const cells = new Map<number, number>();
  let max = 0;

  routes.forEach((points, route) => {
    const slot = route % ROUTE_SLOTS;
    let lastCx = Number.NaN;
    let lastCy = Number.NaN;
    const visit = (x: number, y: number) => {
      const cx = Math.floor(x / HEAT_CELL_M);
      const cy = Math.floor(y / HEAT_CELL_M);
      if (cx === lastCx && cy === lastCy) return;
      lastCx = cx;
      lastCy = cy;
      const k = cellKey(cx, cy);
      const packed = cells.get(k);
      if (packed === undefined) {
        cells.set(k, ROUTE_SLOTS + slot);
        if (max < 1) max = 1;
      } else if (packed % ROUTE_SLOTS !== slot) {
        const n = Math.floor(packed / ROUTE_SLOTS) + 1;
        cells.set(k, n * ROUTE_SLOTS + slot);
        if (n > max) max = n;
      }
    };

    for (let i = 0; i < points.length; i++) {
      const x = points[i]![1] * kx;
      const y = points[i]![0] * ky;
      if (i === 0) {
        visit(x, y);
        continue;
      }
      // Summary polylines leave long gaps on straight roads: fill them in, a cell at a time.
      const px = points[i - 1]![1] * kx;
      const py = points[i - 1]![0] * ky;
      const length = Math.hypot(x - px, y - py);
      if (length > MAX_COUNTED_SEGMENT_M) {
        visit(x, y);
        continue;
      }
      const steps = Math.max(1, Math.ceil(length / HEAT_CELL_M));
      for (let s = 1; s <= steps; s++) visit(px + ((x - px) * s) / steps, py + ((y - py) * s) / steps);
    }
  });

  const countIn = (k: number) => Math.floor((cells.get(k) ?? 0) / ROUTE_SLOTS);
  // Busy roads are asked about over and over (that's what makes them busy): remember each answer.
  const answers = new Map<number, number>();
  return {
    countAt: (lat, lng) => {
      const cx = Math.floor((lng * kx) / HEAT_CELL_M);
      const cy = Math.floor((lat * ky) / HEAT_CELL_M);
      const key = cellKey(cx, cy);
      const known = answers.get(key);
      if (known !== undefined) return known;
      let best = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) best = Math.max(best, countIn(cellKey(cx + dx, cy + dy)));
      answers.set(key, best);
      return best;
    },
    max,
  };
}

/** Heat colours come in this many steps; each step is drawn as one line. */
export const HEAT_STEPS = 12;

/**
 * 0 (visited once) to 1 (the most visited place), on a log scale: the street outside your door
 * shouldn't wash every other road out to the same cold colour.
 */
export function heatFraction(count: number, max: number): number {
  if (max <= 1 || count <= 1) return 0;
  return Math.min(1, Math.log(count) / Math.log(max));
}

const heatStep = (count: number, max: number) => Math.round(heatFraction(count, max) * (HEAT_STEPS - 1));

/**
 * Every route cut into stretches of one heat step, grouped by step (coldest first), so the map
 * draws a dozen lines however many activities there are, with the hottest on top.
 * A segment takes the heat at its middle.
 */
export function heatRuns(routes: readonly (readonly LatLng[])[], grid: HeatGrid): LatLng[][][] {
  const byStep: LatLng[][][] = Array.from({ length: HEAT_STEPS }, () => []);
  for (const points of routes) {
    let run: LatLng[] = [];
    let runStep = -1;
    for (let i = 0; i < points.length - 1; i++) {
      const [aLat, aLng] = points[i]!;
      const [bLat, bLng] = points[i + 1]!;
      const step = heatStep(Math.max(1, grid.countAt((aLat + bLat) / 2, (aLng + bLng) / 2)), grid.max);
      if (step !== runStep) {
        if (run.length > 1) byStep[runStep]!.push(run);
        run = [points[i]!];
        runStep = step;
      }
      run.push(points[i + 1]!);
    }
    if (run.length > 1) byStep[runStep]!.push(run);
  }
  return byStep;
}

/** Which ends of an activity count towards the frequent spots. */
export type SpotKind = "start" | "finish" | "both";

/** A place many activities start or finish at. */
export interface Spot {
  lat: number;
  lng: number;
  starts: number;
  finishes: number;
}

interface SpotCell {
  x: number;
  y: number;
  starts: number;
  finishes: number;
}

/**
 * Places where at least `minCount` activities start and/or finish, within about `radiusM` of
 * each other. Busiest first: a grid of `radiusM` cells, then greedily the busiest 3×3 block
 * of cells not yet taken by a busier spot.
 */
export function frequentSpots(
  routes: readonly (readonly LatLng[])[],
  projection: Projection,
  options: { kind: SpotKind; radiusM: number; minCount: number }
): Spot[] {
  const { kx, ky } = projection;
  const { kind, radiusM, minCount } = options;
  const cells = new Map<number, SpotCell>();
  const add = ([lat, lng]: LatLng, end: "starts" | "finishes") => {
    const x = lng * kx;
    const y = lat * ky;
    const k = cellKey(Math.floor(x / radiusM), Math.floor(y / radiusM));
    const cell = cells.get(k) ?? { x: 0, y: 0, starts: 0, finishes: 0 };
    cell.x += x;
    cell.y += y;
    cell[end]++;
    cells.set(k, cell);
  };
  for (const points of routes) {
    if (points.length < 2) continue;
    if (kind !== "finish") add(points[0]!, "starts");
    if (kind !== "start") add(points[points.length - 1]!, "finishes");
  }

  const neighbours = (k: number) => {
    const cx = Math.floor(k / ROW) - OFFSET;
    const cy = (k % ROW) - OFFSET;
    const keys: number[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) keys.push(cellKey(cx + dx, cy + dy));
    return keys;
  };
  const total = (c: SpotCell) => c.starts + c.finishes;
  const blockTotal = (k: number) => neighbours(k).reduce((sum, n) => sum + (cells.has(n) ? total(cells.get(n)!) : 0), 0);

  const ranked = [...cells.keys()]
    .map((k) => ({ k, block: blockTotal(k) }))
    .filter((c) => c.block >= minCount)
    .sort((a, b) => b.block - a.block);

  const taken = new Set<number>();
  const spots: Spot[] = [];
  for (const { k } of ranked) {
    if (taken.has(k)) continue;
    const block = neighbours(k).filter((n) => cells.has(n) && !taken.has(n));
    const sum = block.reduce(
      (s, n) => {
        const c = cells.get(n)!;
        return { x: s.x + c.x, y: s.y + c.y, starts: s.starts + c.starts, finishes: s.finishes + c.finishes };
      },
      { x: 0, y: 0, starts: 0, finishes: 0 }
    );
    const count = sum.starts + sum.finishes;
    if (count < minCount) continue;
    block.forEach((n) => taken.add(n));
    spots.push({ lat: sum.y / count / ky, lng: sum.x / count / kx, starts: sum.starts, finishes: sum.finishes });
  }
  return spots;
}

/** Distance (m) from a point to the segment a–b, all already projected to metres. */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Indexes of the routes passing within `toleranceM` of a point. */
export function routesNear(
  routes: readonly (readonly LatLng[])[],
  [lat, lng]: LatLng,
  toleranceM: number
): number[] {
  const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110_540;
  const dLat = toleranceM / ky;
  const dLng = toleranceM / kx;
  const px = lng * kx;
  const py = lat * ky;

  const hits: number[] = [];
  routes.forEach((points, index) => {
    for (let i = 0; i < points.length - 1; i++) {
      const [aLat, aLng] = points[i]!;
      const [bLat, bLng] = points[i + 1]!;
      // Cheap reject before any maths: the segment's box, padded by the tolerance.
      if (Math.min(aLat, bLat) - dLat > lat || Math.max(aLat, bLat) + dLat < lat) continue;
      if (Math.min(aLng, bLng) - dLng > lng || Math.max(aLng, bLng) + dLng < lng) continue;
      if (distToSegment(px, py, aLng * kx, aLat * ky, bLng * kx, bLat * ky) <= toleranceM) {
        hits.push(index);
        return;
      }
    }
  });
  return hits;
}

/**
 * The box most of the routes are in: the 2nd to 98th percentile of every point, so one holiday
 * abroad doesn't zoom the map out to a whole continent. Null with no routes.
 */
export function coreBounds(routes: readonly (readonly LatLng[])[]): [[number, number], [number, number]] | null {
  const lats: number[] = [];
  const lngs: number[] = [];
  for (const points of routes) {
    // A handful of points per route is plenty for a percentile.
    const step = Math.max(1, Math.floor(points.length / 20));
    for (let i = 0; i < points.length; i += step) {
      lats.push(points[i]![0]);
      lngs.push(points[i]![1]);
    }
  }
  if (lats.length === 0) return null;
  lats.sort((a, b) => a - b);
  lngs.sort((a, b) => a - b);
  const at = (values: number[], p: number) => values[Math.min(values.length - 1, Math.round(p * (values.length - 1)))]!;
  const trim = routes.length >= 20 ? 0.02 : 0;
  return [
    [at(lats, trim), at(lngs, trim)],
    [at(lats, 1 - trim), at(lngs, 1 - trim)],
  ];
}
