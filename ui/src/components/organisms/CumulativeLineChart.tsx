import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { niceTicks } from "../../utils/chartTicks";
import { useElementWidth } from "../../hooks/useElementWidth";

const PAD_LEFT = 64;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;

export interface CumulativeSeries {
  id: string;
  name: string;
  color: string;
  /** [time ms, running total], oldest first. */
  points: readonly (readonly [number, number])[];
  /** Where the line stops (ms), e.g. today for a year in progress; the window's end by default. */
  until?: number;
}

export interface CumulativeLineChartProps {
  series: readonly CumulativeSeries[];
  /** The time window shown (ms). */
  from: number;
  to: number;
  format: (v: number) => string;
  formatTick: (v: number) => string;
  formatDate: (t: number) => string;
  /** Labelled lines across the time axis; years or quarters by default. */
  xTicks?: readonly { t: number; label: string }[];
  height?: number;
}

/** The running total at time t: the last point at or before it (0 before the first). */
function valueAt(points: CumulativeSeries["points"], t: number): number {
  let lo = 0;
  let hi = points.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]![0] <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found === -1 ? 0 : points[found]![1];
}

const yearStarts = (from: number, to: number) => {
  const out: number[] = [];
  for (let y = new Date(from).getUTCFullYear() + 1; Date.UTC(y, 0, 1) <= to; y++) out.push(Date.UTC(y, 0, 1));
  return out;
};

// Running totals over time, drawn as steps (the total jumps with each activity, then holds).
// One unit on one axis, so every line is directly comparable. Hover to read all of them at a date.
export default function CumulativeLineChart({
  series,
  from,
  to,
  format,
  formatTick,
  formatDate,
  xTicks: customXTicks,
  height = 280,
}: CumulativeLineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotH;
  const span = to - from || 1;

  const { ticks, yMax } = useMemo(() => {
    const max = Math.max(1, ...series.map((s) => valueAt(s.points, to)));
    const ticks = niceTicks(0, max, 4);
    return { ticks, yMax: Math.max(max, ticks[ticks.length - 1] ?? max) };
  }, [series, to]);

  const x = (t: number) => PAD_LEFT + ((t - from) / span) * plotW;
  const y = (v: number) => baseline - (v / yMax) * plotH;

  // Few enough year lines to label; with a short window, mark quarters instead.
  const xTicks = useMemo(() => {
    if (customXTicks) return customXTicks;
    const years = yearStarts(from, to);
    if (years.length >= 2) return years.map((t) => ({ t, label: String(new Date(t).getUTCFullYear()) }));
    const out: { t: number; label: string }[] = [];
    const d = new Date(from);
    for (let y0 = d.getUTCFullYear(), m = d.getUTCMonth() + 1; ; m++) {
      const t = Date.UTC(y0, m, 1);
      if (t > to) break;
      const md = new Date(t);
      if (md.getUTCMonth() % 3 === 0) {
        out.push({ t, label: new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }).format(md) });
      }
    }
    return out;
  }, [from, to, customXTicks]);

  const paths = useMemo(
    () =>
      series.map((s) => {
        const end = Math.min(to, s.until ?? to);
        let d = `M${x(from).toFixed(1)} ${y(valueAt(s.points, from)).toFixed(1)}`;
        for (const [t, v] of s.points) {
          if (t < from || t > end) continue;
          d += `H${x(t).toFixed(1)}V${y(v).toFixed(1)}`;
        }
        d += `H${x(end).toFixed(1)}`;
        return { s, d };
      }),
    // x and y are recreated each render, but only from these values.
    [series, from, to, plotW, plotH, yMax]
  );

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || plotW <= 0) return;
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left - PAD_LEFT) / plotW));
    setHoverT(from + f * span);
  };

  const hoverX = hoverT !== null ? x(hoverT) : 0;
  const rows =
    hoverT !== null
      ? series
          .filter((s) => hoverT <= (s.until ?? to))
          .map((s) => ({ s, v: valueAt(s.points, hoverT) }))
          .filter((r) => r.v > 0)
          .sort((a, b) => b.v - a.v)
      : [];

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="block touch-none select-none" aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y(t)} y2={y(t)} className="stroke-line" />
              <text x={PAD_LEFT - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="num fill-mute text-xs">
                {formatTick(t)}
              </text>
            </g>
          ))}
          {xTicks.map(({ t, label }) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={PAD_TOP} y2={baseline} className="stroke-line" strokeDasharray="2 4" />
              <text x={x(t)} y={baseline + 17} textAnchor="middle" className="num fill-mute text-xs">
                {label}
              </text>
            </g>
          ))}
          <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={baseline} y2={baseline} className="stroke-mute" />

          {paths.map(({ s, d }) => (
            <path key={s.id} d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
          ))}

          {hoverT !== null && (
            <g>
              <line x1={hoverX} x2={hoverX} y1={PAD_TOP} y2={baseline} className="stroke-mute" />
              {rows.map(({ s, v }) => (
                <circle key={s.id} cx={hoverX} cy={y(v)} r="4" fill={s.color} strokeWidth="2" className="stroke-chalk" />
              ))}
            </g>
          )}

          <rect
            x={PAD_LEFT}
            y={0}
            width={plotW}
            height={height}
            fill="transparent"
            style={{ pointerEvents: "all" }}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHoverT(null)}
            className="cursor-crosshair"
          />
        </svg>
      )}

      {hoverT !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-52 rounded-md border border-line bg-chalk px-3 py-2 text-sm shadow-md"
          style={{
            left: hoverX,
            transform: hoverX > width / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="mb-1 font-semibold">{formatDate(hoverT)}</p>
          {rows.length === 0 && <p className="text-mute">Nothing logged yet</p>}
          {rows.map(({ s, v }) => (
            <p key={s.id} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate text-mute">{s.name}</span>
              <span className="num ml-auto pl-3 font-bold">{format(v)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
