import { useMemo, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { niceTicks } from "../../utils/chartTicks";
import { useElementWidth } from "../../hooks/useElementWidth";
import type { ChartSeries } from "../../utils/chartSeries";
import { lowerBound } from "../../utils/routeFraction";
import type { FractionRange } from "../../utils/routeFraction";

// Drawn in real pixels (the SVG is measured, not stretched with a viewBox), so axis text
// renders at its true size instead of being squashed or smeared with the chart's width.
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;
/** Room for the y-axis labels — only needed when one series (one unit) is showing. */
const PAD_LEFT_AXIS = 64;
const PAD_LEFT_BARE = 12;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const formatKm = (km: number) => `${Number(km.toFixed(2))} km`;

export interface StreamChartProps {
  /** Metres, ascending; indexed the same as every series' values. */
  distance: readonly number[];
  /** The visible series, in their fixed order. */
  series: readonly ChartSeries[];
  /** Plot height in pixels. */
  height: number;
  formatDistance: (m: number) => string;
  /** Where along the activity (0–1) is hovered/focused, shared across every chart and the
   *  route map — moving the crosshair on one moves it everywhere else too. */
  hoverFraction: number | null;
  onHoverFractionChange: (fraction: number | null) => void;
  /** A stretch to shade (e.g. the split being looked at), as distance fractions. */
  highlightRange?: FractionRange | null;
  highlightLabel?: string | undefined;
}

interface Scaled {
  series: ChartSeries;
  ys: number[];
  yMin: number;
  yMax: number;
}

// A distance chart of one or more series. With one series it has a real y-axis in that
// series' unit. With several, each is scaled to its own range across the full height —
// never two competing y-axes — and the exact numbers live in the crosshair tooltip.
// The hover position is a controlled prop, so every chart and the map stay in lockstep.
export default function StreamChart({
  distance,
  series,
  height,
  formatDistance,
  hoverFraction,
  onHoverFractionChange,
  highlightRange = null,
  highlightLabel,
}: StreamChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);

  const single = series.length === 1;
  const padLeft = single ? PAD_LEFT_AXIS : PAD_LEFT_BARE;
  const plotW = Math.max(0, width - padLeft - PAD_RIGHT);
  const plotH = Math.max(0, height - PAD_TOP - PAD_BOTTOM);
  const baselineY = PAD_TOP + plotH;

  const n = Math.min(distance.length, ...series.map((s) => s.values.length));
  const maxDistance = (n > 0 ? distance[n - 1] : 0) || 1;
  // The shared hover position is a fraction of *distance*, so find the sample nearest it.
  const hoverIndex = useMemo(() => {
    if (hoverFraction === null || n < 2) return null;
    const target = clamp(hoverFraction, 0, 1) * maxDistance;
    const i = Math.min(lowerBound(distance.slice(0, n), target), n - 1);
    return i > 0 && target - distance[i - 1]! < distance[i]! - target ? i - 1 : i;
  }, [hoverFraction, distance, n, maxDistance]);

  const xs = useMemo(
    () => Array.from({ length: n }, (_, i) => padLeft + (distance[i]! / maxDistance) * plotW),
    [distance, n, maxDistance, padLeft, plotW]
  );

  const scaled = useMemo<Scaled[]>(
    () =>
      series.map((s) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < n; i++) {
          const v = s.values[i]!;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const headroom = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
        // An area sits on the floor of its own range, so it doesn't get extra room below.
        const yMin = s.variant === "area" ? lo - headroom * 0.5 : lo - headroom;
        const yMax = hi + headroom;
        const range = yMax - yMin || 1;
        const ys = Array.from({ length: n }, (_, i) => PAD_TOP + (1 - (s.values[i]! - yMin) / range) * plotH);
        return { series: s, ys, yMin, yMax };
      }),
    [series, n, plotH]
  );

  const xTicks = useMemo(() => {
    const count = Math.max(2, Math.floor(plotW / 110));
    return niceTicks(0, maxDistance / 1000, count).filter((km) => km * 1000 <= maxDistance + 1e-6);
  }, [plotW, maxDistance]);

  const yTicks = useMemo(() => {
    const only = scaled[0];
    if (!single || !only) return [];
    return niceTicks(only.yMin, only.yMax, Math.max(3, Math.floor(plotH / 60))).filter(
      (t) => t >= only.yMin && t <= only.yMax
    );
  }, [scaled, single, plotH]);

  if (n < 2) return null;

  const updateFromClientX = (clientX: number) => {
    const el = wrapRef.current;
    if (!el || plotW <= 0) return;
    const rect = el.getBoundingClientRect();
    onHoverFractionChange(clamp((clientX - rect.left - padLeft) / plotW, 0, 1));
  };

  const onPointerMove = (e: PointerEvent<SVGRectElement>) => updateFromClientX(e.clientX);
  const onPointerLeave = () => onHoverFractionChange(null);

  const onKeyDown = (e: KeyboardEvent<SVGRectElement>) => {
    const current = hoverIndex ?? 0;
    const step = e.shiftKey ? Math.max(1, Math.round(n / 20)) : 1;
    const next =
      e.key === "ArrowRight"
        ? Math.min(n - 1, current + step)
        : e.key === "ArrowLeft"
          ? Math.max(0, current - step)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    onHoverFractionChange(distance[next]! / maxDistance);
  };

  const hoverX = hoverIndex !== null ? xs[hoverIndex]! : null;
  // Keep the tooltip on whichever side of the crosshair has more room.
  const tooltipOnLeft = hoverX !== null && hoverX > width / 2;
  const label = series.map((s) => s.title).join(", ");

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="block touch-none select-none">
          {/* Horizontal grid (with labels when there's a single unit to label). */}
          {single
            ? yTicks.map((t) => {
                const s = scaled[0]!;
                const y = PAD_TOP + (1 - (t - s.yMin) / (s.yMax - s.yMin || 1)) * plotH;
                return (
                  <g key={t}>
                    <line x1={padLeft} y1={y} x2={width - PAD_RIGHT} y2={y} className="stroke-line" />
                    <text
                      x={padLeft - 8}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="num fill-mute text-xs"
                    >
                      {s.series.format(t)}
                    </text>
                  </g>
                );
              })
            : [0.25, 0.5, 0.75].map((f) => (
                <line
                  key={f}
                  x1={padLeft}
                  y1={PAD_TOP + f * plotH}
                  x2={width - PAD_RIGHT}
                  y2={PAD_TOP + f * plotH}
                  className="stroke-line"
                  strokeDasharray="2 4"
                />
              ))}

          {/* Distance axis. */}
          <line x1={padLeft} y1={baselineY} x2={width - PAD_RIGHT} y2={baselineY} className="stroke-line" />
          {xTicks.map((km) => {
            const x = padLeft + ((km * 1000) / maxDistance) * plotW;
            return (
              <g key={km}>
                <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} className="stroke-line" />
                <text
                  x={x}
                  y={baselineY + 18}
                  textAnchor={x - padLeft < 20 ? "start" : x > width - PAD_RIGHT - 20 ? "end" : "middle"}
                  className="num fill-mute text-xs"
                >
                  {formatKm(km)}
                </text>
              </g>
            );
          })}

          {highlightRange && (
            <g aria-hidden="true">
              <rect
                x={padLeft + highlightRange.start * plotW}
                y={PAD_TOP}
                width={Math.max(1, (highlightRange.end - highlightRange.start) * plotW)}
                height={plotH}
                className="fill-paint"
                fillOpacity="0.28"
              />
              {highlightLabel && (
                <text
                  x={padLeft + ((highlightRange.start + highlightRange.end) / 2) * plotW}
                  y={PAD_TOP + 12}
                  textAnchor="middle"
                  className="num fill-ink text-xs font-semibold"
                >
                  {highlightLabel}
                </text>
              )}
            </g>
          )}

          {/* Areas first, so every line draws over them. */}
          {scaled.map(({ series: s, ys }) => {
            if (s.variant !== "area") return null;
            const top = xs.map((x, i) => `${x.toFixed(1)} ${ys[i]!.toFixed(1)}`).join("L");
            const d = `M${top}L${xs[n - 1]!.toFixed(1)} ${baselineY}L${xs[0]!.toFixed(1)} ${baselineY}Z`;
            return <path key={`${s.key}-area`} d={d} fill={s.color} fillOpacity={single ? 0.18 : 0.12} />;
          })}
          {scaled.map(({ series: s, ys }) => (
            <path
              key={s.key}
              d={"M" + xs.map((x, i) => `${x.toFixed(1)} ${ys[i]!.toFixed(1)}`).join("L")}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {hoverX !== null && hoverIndex !== null && (
            <g aria-hidden="true">
              <line x1={hoverX} y1={PAD_TOP} x2={hoverX} y2={baselineY} className="stroke-mute" />
              {scaled.map(({ series: s, ys }) => (
                <circle
                  key={s.key}
                  cx={hoverX}
                  cy={ys[hoverIndex]}
                  r="4.5"
                  fill={s.color}
                  strokeWidth="2"
                  className="stroke-chalk"
                />
              ))}
            </g>
          )}

          <rect
            x={padLeft}
            y={0}
            width={plotW}
            height={height}
            fill="transparent"
            // A transparent fill isn't reliably "painted" for hit-testing across browsers —
            // without this, the rect can silently stop receiving pointer events.
            style={{ pointerEvents: "all" }}
            tabIndex={0}
            role="slider"
            aria-label={`${label}, by distance`}
            aria-valuemin={0}
            aria-valuemax={n - 1}
            aria-valuenow={hoverIndex ?? 0}
            aria-valuetext={
              hoverIndex !== null
                ? `${formatDistance(distance[hoverIndex]!)}: ${series
                    .map((s) => `${s.title} ${s.format(s.values[hoverIndex]!)}`)
                    .join(", ")}`
                : undefined
            }
            onPointerMove={onPointerMove}
            onPointerDown={onPointerMove}
            onPointerLeave={onPointerLeave}
            onFocus={() => onHoverFractionChange(hoverFraction ?? 0)}
            onBlur={onPointerLeave}
            onKeyDown={onKeyDown}
            className="cursor-crosshair focus:outline-none"
          />
        </svg>
      )}

      {hoverX !== null && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute z-10 min-w-36 rounded-md border border-line bg-chalk px-3 py-2 shadow-md"
          style={{
            top: PAD_TOP,
            left: hoverX,
            transform: tooltipOnLeft ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="num mb-1 text-xs font-semibold text-mute">{formatDistance(distance[hoverIndex]!)}</p>
          <ul className="space-y-0.5">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-sm leading-tight">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-mute">{s.title}</span>
                <span className="num ml-auto pl-3 font-bold">{s.format(s.values[hoverIndex]!)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
