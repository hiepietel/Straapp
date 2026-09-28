import { useMemo, useRef, useState } from "react";
import { niceTicks } from "../../utils/chartTicks";
import { useElementWidth } from "../../hooks/useElementWidth";

const PAD_LEFT = 60;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 26;
/** A surface-coloured gap between stacked segments, so neighbours don't merge. */
const SEGMENT_GAP = 2;

export interface StackSeries {
  id: string;
  name: string;
  color: string;
  /** One value per bar, aligned with `labels`. */
  values: readonly number[];
}

export interface StackedBarChartProps {
  labels: readonly string[];
  titles: readonly string[];
  /** Bottom of the stack first. */
  series: readonly StackSeries[];
  format: (v: number) => string;
  formatTick: (v: number) => string;
  labelEvery?: number;
  height?: number;
}

// One bar per period, split into each series' share. Hover a bar for the breakdown.
export default function StackedBarChart({
  labels,
  titles,
  series,
  format,
  formatTick,
  labelEvery = 1,
  height = 260,
}: StackedBarChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const n = labels.length;
  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotH;

  const totals = useMemo(
    () => labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)),
    [labels, series]
  );
  const { ticks, yMax } = useMemo(() => {
    const max = Math.max(1, ...totals);
    const ticks = niceTicks(0, max, 4);
    return { ticks, yMax: Math.max(max, ticks[ticks.length - 1] ?? max) };
  }, [totals]);

  const y = (v: number) => baseline - (v / yMax) * plotH;
  const colW = n > 0 ? plotW / n : 0;
  const barW = Math.max(1, colW - Math.max(1, Math.min(8, colW * 0.25)));
  const tooltipX = hovered !== null ? PAD_LEFT + (hovered + 0.5) * colW : 0;

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }} onPointerLeave={() => setHovered(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="block select-none" aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y(t)} y2={y(t)} className="stroke-line" />
              <text x={PAD_LEFT - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="num fill-mute text-xs">
                {formatTick(t)}
              </text>
            </g>
          ))}

          {hovered !== null && (
            <rect x={PAD_LEFT + hovered * colW} y={PAD_TOP} width={colW} height={plotH} className="fill-ink" fillOpacity="0.05" />
          )}

          {labels.map((label, i) => {
            const x = PAD_LEFT + i * colW + (colW - barW) / 2;
            let top = baseline;
            const visible = series.filter((s) => (s.values[i] ?? 0) > 0);
            return (
              <g key={i}>
                {visible.map((s, k) => {
                  const h = (s.values[i]! / yMax) * plotH;
                  top -= h;
                  // Every segment but the lowest gives up a sliver at its bottom for the gap.
                  const gap = k > 0 ? Math.min(SEGMENT_GAP, h / 2) : 0;
                  return <rect key={s.id} x={x} y={top} width={barW} height={Math.max(0.5, h - gap)} fill={s.color} rx={k === visible.length - 1 ? Math.min(3, barW / 2) : 0} />;
                })}
                {i % labelEvery === 0 && (
                  <text x={PAD_LEFT + (i + 0.5) * colW} y={baseline + 17} textAnchor="middle" className="num fill-mute text-xs">
                    {label}
                  </text>
                )}
                <rect
                  x={PAD_LEFT + i * colW}
                  y={0}
                  width={colW}
                  height={height}
                  fill="transparent"
                  style={{ pointerEvents: "all" }}
                  onPointerEnter={() => setHovered(i)}
                  onPointerDown={() => setHovered(i)}
                />
              </g>
            );
          })}

          <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={baseline} y2={baseline} className="stroke-mute" />
        </svg>
      )}

      {hovered !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-48 rounded-md border border-line bg-chalk px-3 py-2 text-sm shadow-md"
          style={{
            left: tooltipX,
            transform: tooltipX > width / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
          }}
        >
          <p className="mb-1 font-semibold">{titles[hovered]}</p>
          {/* Top of the stack first, matching what's seen on the bar. */}
          {[...series].reverse().filter((s) => (s.values[hovered] ?? 0) > 0).map((s) => (
            <p key={s.id} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="truncate text-mute">{s.name}</span>
              <span className="num ml-auto pl-3 font-bold">{format(s.values[hovered]!)}</span>
            </p>
          ))}
          <p className="mt-1 flex border-t border-line pt-1 font-semibold">
            Total<span className="num ml-auto pl-3">{format(totals[hovered]!)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
