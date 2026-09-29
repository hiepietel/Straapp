import { useMemo, useRef, useState } from "react";
import { niceTicks } from "../../utils/chartTicks";
import { useElementWidth } from "../../hooks/useElementWidth";
import DeltaBadge from "../molecules/DeltaBadge";

// The period being looked at is the one colour; a single period it's compared with is a quiet
// grey behind it, so the eye goes to "now" and reads "before" as context. Several compared
// periods each need a hue of their own to be told apart.
export const CURRENT_COLOR = "#2a78d6";
export const PREVIOUS_COLOR = "#aab4b9";
// The dataviz reference categorical palette without its blue (that's "now"), in validated order.
const COMPARED_PALETTE = ["#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7", "#008300", "#e34948"];
const OVERFLOW_COLOR = "#8a949a";

/** Colours for `count` compared periods, newest first: grey for one, distinct hues for more. */
export const comparedColors = (count: number): string[] =>
  count === 1 ? [PREVIOUS_COLOR] : Array.from({ length: count }, (_, i) => COMPARED_PALETTE[i] ?? OVERFLOW_COLOR);

export interface ComparedSeries {
  name: string;
  color: string;
  /** `null` where the period has no counterpart (e.g. week 53). */
  values: readonly (number | null)[];
}

const PAD_LEFT = 56;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 26;
const RADIUS = 3;

/** A bar with rounded top corners, anchored flat on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0 || w <= 0) return "";
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export interface CompareBarChartProps {
  /** Axis label per bar (e.g. "Jan", "12"). */
  labels: readonly string[];
  /** Tooltip heading per bar (e.g. "March", "Week 12 · 17–23 Mar"). */
  titles: readonly string[];
  /** `null` for periods that haven't happened yet. */
  current: readonly (number | null)[];
  currentName: string;
  /** What each period is compared with, in legend order. */
  compared: readonly ComparedSeries[];
  format: (v: number) => string;
  formatTick: (v: number) => string;
  /**
   * "grouped": bars side by side (few periods). "overlay": the compared one behind (many periods);
   * with more than one compared series, grouped is used anyway, since overlaid bars would hide each other.
   */
  layout?: "grouped" | "overlay";
  /** Show every nth axis label, for crowded axes. */
  labelEvery?: number;
  height?: number;
}

// A bar chart comparing each period with its counterpart. Hovering a column shows both
// numbers and the change; the table next to it carries the same data for non-pointer use.
export default function CompareBarChart({
  labels,
  titles,
  current,
  currentName,
  compared,
  format,
  formatTick,
  layout = "grouped",
  labelEvery = 1,
  height = 260,
}: CompareBarChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const n = labels.length;
  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotH;

  const { ticks, yMax } = useMemo(() => {
    const max = Math.max(1, ...current.map((v) => v ?? 0), ...compared.flatMap((s) => s.values.map((v) => v ?? 0)));
    const ticks = niceTicks(0, max, 4);
    return { ticks, yMax: Math.max(max, ticks[ticks.length - 1] ?? max) };
  }, [current, compared]);
  const grouped = layout === "grouped" || compared.length > 1;
  // Oldest on the left, the current period rightmost.
  const olderFirst = useMemo(() => [...compared].reverse(), [compared]);

  const y = (v: number) => baseline - (v / yMax) * plotH;
  const colW = n > 0 ? plotW / n : 0;
  const gap = Math.max(1, Math.min(8, colW * 0.2));
  const barArea = colW - gap;

  const tooltipX = hovered !== null ? PAD_LEFT + (hovered + 0.5) * colW : 0;
  const cur = hovered !== null ? current[hovered] : null;
  const onlyCompared = compared.length === 1 && hovered !== null ? compared[0]!.values[hovered] : null;

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-4 text-sm" aria-label="Legend">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ backgroundColor: CURRENT_COLOR }} aria-hidden="true" />
          {currentName}
        </li>
        {compared.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-mute">
            <span className="size-3 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.name}
          </li>
        ))}
      </ul>

      <div ref={wrapRef} className="relative w-full" style={{ height }} onPointerLeave={() => setHovered(null)}>
        {width > 0 && (
          <svg width={width} height={height} className="block select-none" aria-hidden="true">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y(t)} y2={y(t)} className="stroke-line" />
                <text
                  x={PAD_LEFT - 8}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="num fill-mute text-xs"
                >
                  {formatTick(t)}
                </text>
              </g>
            ))}

            {hovered !== null && (
              <rect x={PAD_LEFT + hovered * colW} y={PAD_TOP} width={colW} height={plotH} className="fill-ink" fillOpacity="0.05" />
            )}

            {labels.map((label, i) => {
              const x0 = PAD_LEFT + i * colW + gap / 2;
              const c = current[i];
              let bars: { d: string; color: string }[];
              let curBar: string;
              if (grouped) {
                // A small surface gap between neighbours keeps them reading as separate bars.
                const slots = olderFirst.length + 1;
                const sep = slots > 3 ? 1 : 2;
                const w = Math.max(1, (barArea - sep * (slots - 1)) / slots);
                bars = olderFirst.map((s, j) => {
                  const v = s.values[i];
                  return { d: v ? barPath(x0 + j * (w + sep), y(v), w, baseline - y(v)) : "", color: s.color };
                });
                curBar = c ? barPath(x0 + (slots - 1) * (w + sep), y(c), w, baseline - y(c)) : "";
              } else {
                const inset = barArea * 0.22;
                bars = olderFirst.map((s) => {
                  const v = s.values[i];
                  return { d: v ? barPath(x0, y(v), barArea, baseline - y(v)) : "", color: s.color };
                });
                curBar = c ? barPath(x0 + inset, y(c), Math.max(1, barArea - inset * 2), baseline - y(c)) : "";
              }
              const showLabel = i % labelEvery === 0;
              return (
                <g key={i}>
                  {bars.map((b, j) => b.d && <path key={j} d={b.d} fill={b.color} />)}
                  {curBar && <path d={curBar} fill={CURRENT_COLOR} />}
                  {showLabel && (
                    <text
                      x={PAD_LEFT + (i + 0.5) * colW}
                      y={baseline + 17}
                      textAnchor="middle"
                      className="num fill-mute text-xs"
                    >
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
            className="pointer-events-none absolute top-0 z-10 min-w-44 rounded-md border border-line bg-chalk px-3 py-2 text-sm shadow-md"
            style={{
              left: tooltipX,
              transform: tooltipX > width / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
            }}
          >
            <p className="mb-1 font-semibold">{titles[hovered]}</p>
            <p className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: CURRENT_COLOR }} />
              <span className="text-mute">{currentName}</span>
              <span className="num ml-auto pl-3 font-bold">{cur === null || cur === undefined ? "—" : format(cur)}</span>
            </p>
            {compared.map((s) => {
              const v = s.values[hovered];
              return (
                <p key={s.name} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                  <span className="text-mute">{s.name}</span>
                  <span className="num ml-auto pl-3 font-bold">{v === null || v === undefined ? "—" : format(v)}</span>
                  {/* How "now" differs from each one; with a single one, that's the line below. */}
                  {compared.length > 1 && (
                    <span className="w-16 text-right">
                      {cur !== null && cur !== undefined && v !== null && v !== undefined && (
                        <DeltaBadge current={cur} previous={v} />
                      )}
                    </span>
                  )}
                </p>
              );
            })}
            {cur !== null && cur !== undefined && onlyCompared !== null && onlyCompared !== undefined && (
              <div className="mt-1 border-t border-line pt-1">
                <DeltaBadge current={cur} previous={onlyCompared} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
