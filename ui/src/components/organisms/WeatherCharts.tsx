import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { niceTicks } from "../../utils/chartTicks";
import { useElementWidth } from "../../hooks/useElementWidth";
import { STEP_MS, compass, describeWeather, formatRain, formatTemp, formatWind } from "../../utils/weather";
import type { WeatherSample } from "../../types/weather";

// Three small charts on one time axis, never two units on one axis: temperature, precipitation
// and wind. Each has one hue; its second series (feels like, gusts) is the same hue, dashed.
const TEMP_COLOR = "#e34948";
const RAIN_COLOR = "#2a78d6";
const WIND_COLOR = "#1baf7a";

const PAD_LEFT = 48;
const PAD_RIGHT = 12;
const TITLE_H = 24;
const AXIS_H = 24;
const PANEL_GAP = 14;
/** Room above the wind lines for the direction arrows. */
const ARROW_ROW = 20;

interface Series {
  name: string;
  values: (number | null)[];
  dashed?: boolean;
}

interface Panel {
  title: string;
  color: string;
  kind: "line" | "bar";
  height: number;
  series: Series[];
  /** Whether the axis starts at 0 (amounts) or fits the values (temperature). */
  fromZero: boolean;
  /** At least this tall a scale, so a drizzle doesn't fill the chart. */
  minSpan: number;
  format: (v: number) => string;
  arrows?: boolean;
}

export interface WeatherChartsProps {
  /** Every 15 minutes, oldest first. */
  samples: readonly WeatherSample[];
  /** The activity, UTC ISO times: shaded on every chart. */
  start: string;
  end: string;
  utcOffsetSeconds: number;
}

/** A rounded-top bar standing on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0 || w <= 0) return "";
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** A line through the points, broken where a value is missing. */
function linePath(xs: readonly number[], ys: readonly (number | null)[]): string {
  let d = "";
  let open = false;
  ys.forEach((y, i) => {
    if (y === null) {
      open = false;
      return;
    }
    d += `${open ? "L" : "M"}${xs[i]!.toFixed(1)},${y.toFixed(1)}`;
    open = true;
  });
  return d;
}

export default function WeatherCharts({ samples: hours, start, end, utcOffsetSeconds }: WeatherChartsProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);
  const [hovered, setHovered] = useState<number | null>(null);

  const n = hours.length;
  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const colW = n ? plotW / n : 0;
  const first = n ? Date.parse(hours[0]!.time) : 0;
  const colX = (i: number) => PAD_LEFT + (i + 0.5) * colW;
  const timeX = (t: number) => Math.min(PAD_LEFT + plotW, Math.max(PAD_LEFT, PAD_LEFT + ((t - first) / STEP_MS + 0.5) * colW));

  const localHour = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    return (iso: string) => fmt.format(new Date(Date.parse(iso) + utcOffsetSeconds * 1000));
  }, [utcOffsetSeconds]);

  const panels = useMemo<Panel[]>(
    () => [
      {
        title: "Temperature",
        color: TEMP_COLOR,
        kind: "line",
        height: 130,
        series: [
          { name: "Temperature", values: hours.map((h) => h.temperature) },
          { name: "Feels like", values: hours.map((h) => h.apparentTemperature), dashed: true },
        ],
        fromZero: false,
        minSpan: 4,
        format: formatTemp,
      },
      {
        title: "Precipitation",
        color: RAIN_COLOR,
        kind: "bar",
        height: 80,
        series: [{ name: "Precipitation", values: hours.map((h) => h.precipitation) }],
        fromZero: true,
        minSpan: 1,
        format: formatRain,
      },
      {
        title: "Wind",
        color: WIND_COLOR,
        kind: "line",
        height: 110,
        series: [
          { name: "Wind", values: hours.map((h) => h.windSpeed) },
          { name: "Gusts", values: hours.map((h) => h.windGusts), dashed: true },
        ],
        fromZero: true,
        minSpan: 10,
        format: formatWind,
        arrows: true,
      },
    ],
    [hours]
  );

  // Where each panel sits, and its scale.
  const layout = useMemo(() => {
    let top = 0;
    return panels.map((p) => {
      const values = p.series.flatMap((s) => s.values).filter((v): v is number => v !== null);
      let lo = p.fromZero ? 0 : Math.floor(Math.min(...values, Infinity));
      let hi = Math.ceil(Math.max(...values, -Infinity));
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        lo = 0;
        hi = p.minSpan;
      }
      if (hi - lo < p.minSpan) {
        const pad = (p.minSpan - (hi - lo)) / 2;
        hi += p.fromZero ? pad * 2 : pad;
        lo -= p.fromZero ? 0 : pad;
      }
      const ticks = niceTicks(lo, hi, p.kind === "bar" ? 2 : 3);
      const yLo = Math.min(lo, ticks[0] ?? lo);
      const yHi = Math.max(hi, ticks[ticks.length - 1] ?? hi);
      const plotTop = top + TITLE_H + (p.arrows ? ARROW_ROW : 0);
      const plotBottom = top + TITLE_H + p.height;
      const y = (v: number) => plotBottom - ((v - yLo) / (yHi - yLo || 1)) * (plotBottom - plotTop);
      const entry = { panel: p, top, plotTop, plotBottom, ticks, y };
      top = plotBottom + PANEL_GAP;
      return entry;
    });
  }, [panels]);

  const svgHeight = (layout[layout.length - 1]?.plotBottom ?? 0) + AXIS_H;
  const shadeFrom = timeX(Date.parse(start));
  const shadeTo = timeX(Date.parse(end));
  const xs = hours.map((_, i) => colX(i));
  // Labels on whole hours (local time), every hour if they fit, else every 2nd, 3rd…
  const hourW = colW * (3600_000 / STEP_MS);
  const labelEveryHours = Math.max(1, Math.ceil(48 / Math.max(hourW, 1)));
  const isLabelled = (iso: string) => {
    const local = new Date(Date.parse(iso) + utcOffsetSeconds * 1000);
    return local.getUTCMinutes() === 0 && local.getUTCHours() % labelEveryHours === 0;
  };

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || colW <= 0) return;
    setHovered(Math.min(n - 1, Math.max(0, Math.floor((e.clientX - rect.left - PAD_LEFT) / colW))));
  };

  const h = hovered !== null ? hours[hovered] : undefined;
  const hx = hovered !== null ? colX(hovered) : 0;

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: svgHeight }}>
      {width > 0 && n > 0 && (
        <svg width={width} height={svgHeight} className="block touch-none select-none" aria-hidden="true">
          {/* The activity itself, across every panel. */}
          <rect
            x={shadeFrom}
            y={0}
            width={Math.max(2, shadeTo - shadeFrom)}
            height={svgHeight - AXIS_H}
            className="fill-ink"
            fillOpacity="0.06"
          />
          <text x={shadeFrom + 4} y={14} className="fill-mute text-xs">
            Activity
          </text>

          {layout.map(({ panel: p, top, plotTop, plotBottom, ticks, y }) => (
            <g key={p.title}>
              <text x={PAD_LEFT} y={top + 15} className="fill-ink text-sm font-semibold">
                {p.title}
              </text>
              {/* Legend for the second, dashed series; one series needs none beyond the title. */}
              {p.series.length > 1 && (
                <g transform={`translate(${PAD_LEFT + p.title.length * 8 + 16}, ${top + 11})`}>
                  {p.series.map((s, i) => (
                    <g key={s.name} transform={`translate(${i * 110}, 0)`}>
                      <line x1={0} x2={18} y1={0} y2={0} stroke={p.color} strokeWidth="2" strokeDasharray={s.dashed ? "4 3" : undefined} />
                      <text x={24} y={4} className="fill-mute text-xs">
                        {s.name}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y(t)} y2={y(t)} className="stroke-line" />
                  <text x={PAD_LEFT - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="num fill-mute text-xs">
                    {p.format(t)}
                  </text>
                </g>
              ))}

              {p.kind === "bar"
                ? p.series[0]!.values.map((v, i) => {
                    if (!v) return null;
                    // A 2px gap between bars while there's room for one.
                    const gap = colW > 6 ? 2 : 0;
                    const w = Math.max(1, colW - gap);
                    return <path key={i} d={barPath(PAD_LEFT + i * colW + gap / 2, y(v), w, plotBottom - y(v))} fill={p.color} />;
                  })
                : p.series.map((s) => (
                    <path
                      key={s.name}
                      d={linePath(xs, s.values.map((v) => (v === null ? null : y(v))))}
                      fill="none"
                      stroke={p.color}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeDasharray={s.dashed ? "4 3" : undefined}
                    />
                  ))}

              {/* Arrows point where the wind blows to: a wind from the north points down. */}
              {p.arrows &&
                hours.map((hour, i) =>
                  hour.windDirection === null || i % Math.max(1, Math.ceil(16 / Math.max(colW, 1))) !== 0 ? null : (
                    <path
                      key={i}
                      d="M0,-6 L4,5 L0,2.5 L-4,5 Z"
                      transform={`translate(${colX(i)}, ${plotTop - ARROW_ROW / 2}) rotate(${hour.windDirection + 180})`}
                      className="fill-mute"
                    />
                  )
                )}

              <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={plotBottom} y2={plotBottom} className="stroke-mute" />
            </g>
          ))}

          {hours.map((hour, i) =>
            isLabelled(hour.time) ? (
              <text key={hour.time} x={colX(i)} y={svgHeight - 7} textAnchor="middle" className="num fill-mute text-xs">
                {localHour(hour.time)}
              </text>
            ) : null
          )}

          {hovered !== null && (
            <line x1={hx} x2={hx} y1={0} y2={svgHeight - AXIS_H} className="stroke-mute" />
          )}
          {hovered !== null &&
            layout.flatMap(({ panel: p, y }) =>
              p.kind === "line"
                ? p.series.map((s) => {
                    const v = s.values[hovered];
                    return v === null || v === undefined ? null : (
                      <circle key={`${p.title}-${s.name}`} cx={hx} cy={y(v)} r="4" fill={p.color} strokeWidth="2" className="stroke-chalk" />
                    );
                  })
                : []
            )}

          <rect
            x={PAD_LEFT}
            y={0}
            width={plotW}
            height={svgHeight}
            fill="transparent"
            style={{ pointerEvents: "all" }}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHovered(null)}
            className="cursor-crosshair"
          />
        </svg>
      )}

      {h && (
        <div
          className="pointer-events-none absolute top-6 z-10 min-w-52 rounded-md border border-line bg-chalk px-3 py-2 text-sm shadow-md"
          style={{ left: hx, transform: hx > width / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
        >
          <p className="font-semibold">
            {localHour(h.time)} · {describeWeather(h.weatherCode, h.isDay).label}
          </p>
          <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
            {h.temperature !== null && (
              <>
                <dt className="text-mute">Temperature</dt>
                <dd className="num text-right font-semibold">{formatTemp(h.temperature)}</dd>
              </>
            )}
            {h.apparentTemperature !== null && (
              <>
                <dt className="text-mute">Feels like</dt>
                <dd className="num text-right font-semibold">{formatTemp(h.apparentTemperature)}</dd>
              </>
            )}
            {h.precipitation !== null && (
              <>
                <dt className="text-mute">Precipitation</dt>
                <dd className="num text-right font-semibold">{formatRain(h.precipitation)}</dd>
              </>
            )}
            {h.windSpeed !== null && (
              <>
                <dt className="text-mute">Wind</dt>
                <dd className="num text-right font-semibold">
                  {formatWind(h.windSpeed)}
                  {h.windDirection !== null && ` from ${compass(h.windDirection)}`}
                </dd>
              </>
            )}
            {h.windGusts !== null && (
              <>
                <dt className="text-mute">Gusts</dt>
                <dd className="num text-right font-semibold">{formatWind(h.windGusts)}</dd>
              </>
            )}
            {h.relativeHumidity !== null && (
              <>
                <dt className="text-mute">Humidity</dt>
                <dd className="num text-right font-semibold">{h.relativeHumidity}%</dd>
              </>
            )}
            {h.cloudCover !== null && (
              <>
                <dt className="text-mute">Cloud cover</dt>
                <dd className="num text-right font-semibold">{h.cloudCover}%</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
