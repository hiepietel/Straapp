import { useMemo, useRef, useState } from "react";
import { niceTicks } from "../../utils/chartTicks";
import { useElementWidth } from "../../hooks/useElementWidth";
import DeltaBadge from "../molecules/DeltaBadge";

// The period being looked at is the one colour; the period it's compared with is a quiet
// grey behind it, so the eye goes to "now" and reads "before" as context.
export const CURRENT_COLOR = "#2a78d6";
export const PREVIOUS_COLOR = "#aab4b9";

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
  previous: readonly (number | null)[];
  currentName: string;
  previousName: string;
  format: (v: number) => string;
  formatTick: (v: number) => string;
  /** "grouped": bars side by side (few periods). "overlay": the previous one behind (many). */
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
  previous,
  currentName,
  previousName,
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
    const max = Math.max(1, ...current.map((v) => v ?? 0), ...previous.map((v) => v ?? 0));
    const ticks = niceTicks(0, max, 4);
    return { ticks, yMax: Math.max(max, ticks[ticks.length - 1] ?? max) };
  }, [current, previous]);

  const y = (v: number) => baseline - (v / yMax) * plotH;
  const colW = n > 0 ? plotW / n : 0;
  const gap = Math.max(1, Math.min(8, colW * 0.2));
  const barArea = colW - gap;

  const tooltipX = hovered !== null ? PAD_LEFT + (hovered + 0.5) * colW : 0;
  const cur = hovered !== null ? current[hovered] : null;
  const prev = hovered !== null ? previous[hovered] : null;

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-4 text-sm" aria-label="Legend">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ backgroundColor: CURRENT_COLOR }} aria-hidden="true" />
          {currentName}
        </li>
        <li className="flex items-center gap-2 text-mute">
          <span className="size-3 rounded-sm" style={{ backgroundColor: PREVIOUS_COLOR }} aria-hidden="true" />
          {previousName}
        </li>
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
              const p = previous[i];
              let prevBar: string;
              let curBar: string;
              if (layout === "grouped") {
                // A 2px surface gap between the pair keeps them reading as two bars.
                const w = Math.max(1, (barArea - 2) / 2);
                prevBar = p ? barPath(x0, y(p), w, baseline - y(p)) : "";
                curBar = c ? barPath(x0 + w + 2, y(c), w, baseline - y(c)) : "";
              } else {
                const inset = barArea * 0.22;
                prevBar = p ? barPath(x0, y(p), barArea, baseline - y(p)) : "";
                curBar = c ? barPath(x0 + inset, y(c), Math.max(1, barArea - inset * 2), baseline - y(c)) : "";
              }
              const showLabel = i % labelEvery === 0;
              return (
                <g key={i}>
                  {prevBar && <path d={prevBar} fill={PREVIOUS_COLOR} />}
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
            <p className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: PREVIOUS_COLOR }} />
              <span className="text-mute">{previousName}</span>
              <span className="num ml-auto pl-3 font-bold">{prev === null || prev === undefined ? "—" : format(prev)}</span>
            </p>
            {cur !== null && cur !== undefined && prev !== null && prev !== undefined && (
              <div className="mt-1 border-t border-line pt-1">
                <DeltaBadge current={cur} previous={prev} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
