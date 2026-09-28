import { Check, Plus, X } from "lucide-react";
import StreamChart from "./StreamChart";
import Button from "../atoms/Button";
import { CHART_SIZES, MAX_CHARTS, useChartLayout } from "../../hooks/useChartLayout";
import type { ChartPanel, ChartSize } from "../../hooks/useChartLayout";
import { buildChartSeries } from "../../utils/chartSeries";
import type { ChartSeries, SeriesKey } from "../../utils/chartSeries";
import { formatDistance } from "../../utils/format";
import type { SportGroupId } from "../../utils/sports";
import type { ActivityStreams } from "../../types/strava";
import type { FractionRange } from "../../utils/routeFraction";

const HEIGHTS: Record<ChartSize, number> = { s: 180, m: 280, l: 420 };
const SIZE_LABELS: Record<ChartSize, string> = { s: "Small", m: "Medium", l: "Large" };

/** Whether there's anything at all to chart — the caller uses this to decide whether the
 *  "Charts" section should exist, rather than showing an empty shell. */
export function hasChartableStreams(streams: ActivityStreams, group: SportGroupId): boolean {
  if (!streams.distance || streams.distance.data.length < 2) return false;
  return buildChartSeries(streams, group).length > 0;
}

export interface ActivityChartsProps {
  streams: ActivityStreams;
  group: SportGroupId;
  /** Shared with every chart (and the route map above) so they scrub in lockstep. */
  hoverFraction: number | null;
  onHoverFractionChange: (fraction: number | null) => void;
  /** The split being looked at, shaded on every chart. */
  highlightRange?: FractionRange | null;
  highlightLabel?: string | undefined;
}

// Up to MAX_CHARTS charts, each showing whichever of the recorded series the reader ticks.
// It starts as one large chart with everything on; the layout is remembered across visits.
export default function ActivityCharts({
  streams,
  group,
  hoverFraction,
  onHoverFractionChange,
  highlightRange = null,
  highlightLabel,
}: ActivityChartsProps) {
  const layout = useChartLayout();
  const distance = streams.distance?.data;
  const available = buildChartSeries(streams, group);
  if (!distance || distance.length < 2 || available.length === 0) return null;

  // A new chart starts with the first measure not already on screen, so it adds something.
  const shown = new Set(layout.panels.flatMap((p) => p.series));
  const nextSeries = available.find((s) => !shown.has(s.key)) ?? available[0]!;

  return (
    <div className="flex flex-col gap-8">
      {layout.panels.map((panel, i) => (
        <ChartCard
          key={panel.id}
          index={i}
          panel={panel}
          available={available}
          distance={distance}
          canRemove={layout.panels.length > 1}
          onChange={(change) => layout.update(panel.id, change)}
          onRemove={() => layout.remove(panel.id)}
          hoverFraction={hoverFraction}
          onHoverFractionChange={onHoverFractionChange}
          highlightRange={highlightRange}
          highlightLabel={highlightLabel}
        />
      ))}

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          className="gap-2"
          disabled={layout.panels.length >= MAX_CHARTS}
          onClick={() => layout.add([nextSeries.key])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add chart
        </Button>
        <p className="text-sm text-mute">
          {layout.panels.length} of {MAX_CHARTS} charts
        </p>
      </div>
    </div>
  );
}

interface ChartCardProps {
  index: number;
  panel: ChartPanel;
  available: readonly ChartSeries[];
  distance: readonly number[];
  canRemove: boolean;
  onChange: (change: Partial<Omit<ChartPanel, "id">>) => void;
  onRemove: () => void;
  hoverFraction: number | null;
  onHoverFractionChange: (fraction: number | null) => void;
  highlightRange: FractionRange | null;
  highlightLabel: string | undefined;
}

function ChartCard({
  index,
  panel,
  available,
  distance,
  canRemove,
  onChange,
  onRemove,
  hoverFraction,
  onHoverFractionChange,
  highlightRange,
  highlightLabel,
}: ChartCardProps) {
  const visible = available.filter((s) => panel.series.includes(s.key));
  const only = visible.length === 1 ? visible[0] : undefined;

  const toggle = (key: SeriesKey) =>
    onChange({
      series: panel.series.includes(key) ? panel.series.filter((k) => k !== key) : [...panel.series, key],
    });

  return (
    <section
      aria-label={`Chart ${index + 1}`}
      className="rounded-lg border border-line bg-chalk p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        {/* The legend doubles as the on/off switches for each line. */}
        <div role="group" aria-label="Visible lines" className="flex flex-wrap gap-2">
          {available.map((s) => {
            const on = panel.series.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
                  on ? "border-ink/30 bg-pavement text-ink" : "border-line text-mute hover:bg-pavement"
                }`}
              >
                <span
                  className="flex size-4 items-center justify-center rounded-sm border-2"
                  style={{ borderColor: s.color, backgroundColor: on ? s.color : "transparent" }}
                  aria-hidden="true"
                >
                  {on && <Check className="size-3 text-white" strokeWidth={3} />}
                </span>
                {s.title}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div role="group" aria-label="Chart size" className="flex overflow-hidden rounded-md border border-line">
            {CHART_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                title={SIZE_LABELS[size]}
                aria-label={SIZE_LABELS[size]}
                aria-pressed={panel.size === size}
                onClick={() => onChange({ size })}
                className={`px-2.5 py-1 text-sm font-semibold uppercase ${
                  panel.size === size ? "bg-ink text-chalk" : "text-mute hover:bg-pavement"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove chart ${index + 1}`}
              title="Remove chart"
              className="rounded-md border border-line p-1.5 text-mute hover:bg-pavement hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {only && <SeriesSummary series={only} />}

      {visible.length > 0 ? (
        <StreamChart
          distance={distance}
          series={visible}
          height={HEIGHTS[panel.size]}
          formatDistance={formatDistance}
          hoverFraction={hoverFraction}
          onHoverFractionChange={onHoverFractionChange}
          highlightRange={highlightRange}
          highlightLabel={highlightLabel}
        />
      ) : (
        <p
          className="flex items-center justify-center rounded-md border border-dashed border-line text-sm text-mute"
          style={{ height: HEIGHTS[panel.size] }}
        >
          Pick at least one line above to draw this chart.
        </p>
      )}
    </section>
  );
}

/** "avg · max" for a single-series chart, where the header has room to say it. */
function SeriesSummary({ series }: { series: ChartSeries }) {
  const { values, format } = series;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = values.reduce((a, b) => Math.max(a, b), -Infinity);
  return (
    <p className="num mb-2 text-sm text-mute">
      avg <span className="font-semibold text-ink">{format(avg)}</span> · max{" "}
      <span className="font-semibold text-ink">{format(max)}</span>
    </p>
  );
}
