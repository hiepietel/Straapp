import { useMemo, useState } from "react";
import DashboardTemplate from "../templates/DashboardTemplate";
import HeatmapMap from "../organisms/HeatmapMap";
import type { MapRoute } from "../organisms/HeatmapMap";
import FilterTabs from "../molecules/FilterTabs";
import type { FilterOption } from "../molecules/FilterTabs";
import PillMultiSelect from "../molecules/PillMultiSelect";
import Notice from "../molecules/Notice";
import Spinner from "../atoms/Spinner";
import { useHeatmap } from "../../hooks/useHeatmap";
import { isDemo } from "../../services/auth";
import { decodePolyline } from "../../utils/polyline";
import { formatDistance } from "../../utils/format";
import { GROUPS } from "../../utils/sports";
import type { SportGroupId } from "../../utils/sports";

type PeriodId = "30d" | "3m" | "12m" | "year" | "lastYear" | "all" | "custom";

const PERIODS: FilterOption<PeriodId>[] = [
  { id: "30d", label: "Last 30 days" },
  { id: "3m", label: "Last 3 months" },
  { id: "12m", label: "Last 12 months" },
  { id: "year", label: "This year" },
  { id: "lastYear", label: "Last year" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

const GROUP_IDS = Object.keys(GROUPS) as SportGroupId[];

/** The browser's local calendar day, "YYYY-MM-DD", `days`/`months` from today. */
function localDay(offset: { days?: number; months?: number } = {}): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + (offset.months ?? 0), now.getDate() + (offset.days ?? 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The local days a period covers, both included; undefined where it's open. */
function periodDays(period: PeriodId, custom: { from: string; to: string }): { from?: string; to?: string } {
  const year = new Date().getFullYear();
  switch (period) {
    case "30d":
      return { from: localDay({ days: -29 }) };
    case "3m":
      return { from: localDay({ months: -3 }) };
    case "12m":
      return { from: localDay({ months: -12 }) };
    case "year":
      return { from: `${year}-01-01` };
    case "lastYear":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case "all":
      return {};
    case "custom":
      return { ...(custom.from && { from: custom.from }), ...(custom.to && { to: custom.to }) };
  }
}

export default function HeatmapPage() {
  const [period, setPeriod] = useState<PeriodId>("12m");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [sports, setSports] = useState<ReadonlySet<SportGroupId>>(new Set());
  const [gearIds, setGearIds] = useState<ReadonlySet<string>>(new Set());

  const { from, to } = periodDays(period, custom);
  const { report, status, error, retry } = useHeatmap({ from, to });

  // Decoded once per load; the filters below only pick from these.
  const decoded = useMemo<MapRoute[]>(
    () =>
      (report?.routes ?? [])
        .map((r) => ({ ...r, points: decodePolyline(r.polyline) }))
        .filter((r) => r.points.length >= 2),
    [report]
  );

  const sportOptions = useMemo(() => {
    const present = new Set(decoded.map((r) => r.sport));
    return GROUP_IDS.filter((id) => present.has(id)).map((id) => ({ id, label: GROUPS[id].label }));
  }, [decoded]);
  const gearOptions = useMemo(
    () => (report?.gear ?? []).map((g) => ({ id: g.id, label: g.retired ? `${g.name} (retired)` : g.name })),
    [report]
  );

  // A choice that isn't in this date range (e.g. a bike you didn't ride then) is ignored, not applied.
  const visible = useMemo(() => {
    const sportFilter = new Set([...sports].filter((s) => sportOptions.some((o) => o.id === s)));
    const gearFilter = new Set([...gearIds].filter((g) => gearOptions.some((o) => o.id === g)));
    return decoded.filter(
      (r) => (sportFilter.size === 0 || sportFilter.has(r.sport)) && (gearFilter.size === 0 || (r.gearId !== null && gearFilter.has(r.gearId)))
    );
  }, [decoded, sports, gearIds, sportOptions, gearOptions]);

  const distance = visible.reduce((sum, r) => sum + r.distance, 0);

  return (
    <DashboardTemplate
      header={
        <header className="pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Heatmap</h1>
          <p className="mt-1 text-mute">Everywhere you've been. The more often, the hotter the colour.</p>
        </header>
      }
      notice={
        error ? (
          <Notice tone="error" actionLabel="Try again" onAction={retry}>
            {error}
          </Notice>
        ) : (
          isDemo && <Notice>You are seeing demo routes.</Notice>
        )
      }
      filters={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <FilterTabs options={PERIODS} value={period} onChange={setPeriod} label="Date range" />
            {period === "custom" && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
                <label className="flex items-center gap-1.5">
                  From
                  <input
                    type="date"
                    value={custom.from}
                    max={custom.to || undefined}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                    className="rounded-md border border-line bg-chalk px-2 py-1 text-ink"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  To
                  <input
                    type="date"
                    value={custom.to}
                    min={custom.from || undefined}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                    className="rounded-md border border-line bg-chalk px-2 py-1 text-ink"
                  />
                </label>
              </div>
            )}
          </div>
          {sportOptions.length > 1 && (
            <PillMultiSelect options={sportOptions} value={sports} onChange={setSports} label="Filter by sport" />
          )}
          {gearOptions.length > 0 && (
            <PillMultiSelect options={gearOptions} value={gearIds} onChange={setGearIds} label="Filter by gear" />
          )}
          <p className="num flex items-center gap-3 text-sm text-mute" aria-live="polite">
            {report && (
              <span>
                {visible.length.toLocaleString()} {visible.length === 1 ? "activity" : "activities"} ·{" "}
                {formatDistance(distance)}
              </span>
            )}
            {status === "loading" && <Spinner label={report ? "Updating" : "Loading your routes"} />}
          </p>
        </div>
      }
    >
      {report && decoded.length === 0 && status === "ready" && (
        <div className="mb-4">
          <Notice>No activities with a route in this date range.</Notice>
        </div>
      )}
      <HeatmapMap routes={visible} gear={report?.gear ?? []} fitKey={report} />
    </DashboardTemplate>
  );
}
