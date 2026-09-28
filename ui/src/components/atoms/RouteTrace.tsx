import { useMemo } from "react";
import { decodePolyline } from "../../utils/polyline";

const W = 240;
const H = 150;
const PAD = 20;

/** A point in the SVG viewBox. */
type Point = readonly [x: number, y: number];

interface ProjectedRoute {
  /** SVG path `d` attribute. */
  d: string;
  start: Point;
  end: Point;
}

// Turns an encoded polyline into an SVG path that fits the viewBox.
function project(polyline: string | null | undefined): ProjectedRoute | null {
  const pts = decodePolyline(polyline ?? "");
  if (pts.length < 2) return null;

  // Shrink longitude by latitude so shapes aren't stretched.
  const midLat = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xy: Point[] = pts.map(([lat, lng]) => [lng * k, -lat]);

  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1e-6;
  const h = Math.max(...ys) - minY || 1e-6;

  const scale = Math.min((W - 2 * PAD) / w, (H - 2 * PAD) / h);
  const offX = (W - w * scale) / 2;
  const offY = (H - h * scale) / 2;
  const out: Point[] = xy.map(([x, y]) => [(x - minX) * scale + offX, (y - minY) * scale + offY]);

  return {
    d: "M" + out.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L"),
    // Safe: `out` has the same length as `pts`, which we checked is >= 2.
    start: out[0]!,
    end: out[out.length - 1]!,
  };
}

export interface RouteTraceProps {
  polyline: string | null | undefined;
  className?: string;
}

// Draws in the current text colour, so colour it with a text-* class.
export default function RouteTrace({ polyline, className = "" }: RouteTraceProps) {
  const route = useMemo(() => project(polyline), [polyline]);
  if (!route) return null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Route outline">
      <path
        d={route.d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={route.start[0]} cy={route.start[1]} r="4.5" fill="currentColor" />
      <circle
        cx={route.end[0]}
        cy={route.end[1]}
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
