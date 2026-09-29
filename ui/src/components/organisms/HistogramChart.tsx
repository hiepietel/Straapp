import { useMemo, useRef, useState } from "react";
import { niceTicks } from "../../utils/chartTicks";
import { useElementWidth } from "../../hooks/useElementWidth";

const PAD_LEFT = 40;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 26;

export interface HistogramBar {
  /** Axis label, e.g. "20". */
  label: string;
  /** Tooltip heading, e.g. "20–21 km". */
  title: string;
  count: number;
}

export interface HistogramChartProps {
  bars: readonly HistogramBar[];
  color: string;
  /** The bar picked to list its activities, if any. */
  selected: number | null;
  onSelect: (index: number | null) => void;
  /** Share of the whole count shown in the tooltip; the total it's out of. */
  total: number;
  height?: number;
}

/** A bar with rounded top corners, standing on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0 || w <= 0) return "";
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// How many activities fall in each bucket. Hover a bar for its numbers; click it to list them.
export default function HistogramChart({ bars, color, selected, onSelect, total, height = 240 }: HistogramChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const n = bars.length;
  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotH;
  const colW = n ? plotW / n : 0;
  const gap = colW > 6 ? 2 : colW > 3 ? 1 : 0;

  const { ticks, yMax } = useMemo(() => {
    const max = Math.max(1, ...bars.map((b) => b.count));
    // Counts are whole numbers: never a tick at 2.5 activities.
    const ticks = niceTicks(0, max, 4).filter((t) => Number.isInteger(t));
    return { ticks, yMax: Math.max(max, ticks[ticks.length - 1] ?? max) };
  }, [bars]);
  const y = (v: number) => baseline - (v / yMax) * plotH;
  const labelEvery = Math.max(1, Math.ceil(36 / Math.max(colW, 1)));

  const tip = hovered !== null ? bars[hovered] : undefined;
  const tipX = hovered !== null ? PAD_LEFT + (hovered + 0.5) * colW : 0;

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }} onPointerLeave={() => setHovered(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="block select-none" aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y(t)} y2={y(t)} className="stroke-line" />
              <text x={PAD_LEFT - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="num fill-mute text-xs">
                {t}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            const x = PAD_LEFT + i * colW + gap / 2;
            const faded = selected !== null && selected !== i;
            return (
              <g key={i}>
                {(hovered === i || selected === i) && (
                  <rect x={PAD_LEFT + i * colW} y={PAD_TOP} width={colW} height={plotH} className="fill-ink" fillOpacity="0.06" />
                )}
                {b.count > 0 && (
                  <path
                    d={barPath(x, y(b.count), Math.max(1, colW - gap), baseline - y(b.count))}
                    fill={color}
                    fillOpacity={faded ? 0.35 : 1}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={PAD_LEFT + i * colW} y={baseline + 17} textAnchor="middle" className="num fill-mute text-xs">
                    {b.label}
                  </text>
                )}
                <rect
                  x={PAD_LEFT + i * colW}
                  y={0}
                  width={colW}
                  height={height}
                  fill="transparent"
                  style={{ pointerEvents: "all", cursor: b.count ? "pointer" : "default" }}
                  onPointerEnter={() => setHovered(i)}
                  onClick={() => b.count && onSelect(selected === i ? null : i)}
                />
              </g>
            );
          })}
          <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={baseline} y2={baseline} className="stroke-mute" />
        </svg>
      )}

      {tip && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md border border-line bg-chalk px-3 py-2 text-sm shadow-md"
          style={{ left: tipX, transform: tipX > width / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}
        >
          <p className="font-semibold">{tip.title}</p>
          <p className="num">
            <span className="font-bold">{tip.count}×</span>
            {total > 0 && <span className="text-mute"> · {Math.round((tip.count / total) * 100)}% of activities</span>}
          </p>
          {tip.count > 0 && <p className="text-xs text-mute">Click to list them</p>}
        </div>
      )}
    </div>
  );
}
