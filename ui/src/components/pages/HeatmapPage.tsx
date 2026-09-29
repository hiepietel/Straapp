import { useMemo, useState } from "react";
import DashboardTemplate from "../templates/DashboardTemplate";
import HeatmapMap from "../organisms/HeatmapMap";
import type { MapRoute } from "../organisms/HeatmapMap";
import PeriodFilter, { defaultPeriod, periodDays } from "../molecules/PeriodFilter";
import PillMultiSelect from "../molecules/PillMultiSelect";
import SportTypeFilter from "../molecules/SportTypeFilter";
import Notice from "../molecules/Notice";
import Spinner from "../atoms/Spinner";
import { useHeatmap } from "../../hooks/useHeatmap";
import { isDemo } from "../../services/auth";
import { decodePolyline } from "../../utils/polyline";
import { formatDistance } from "../../utils/format";

export default function HeatmapPage() {
  const [period, setPeriod] = useState(() => defaultPeriod("12m"));
  const [sportTypes, setSportTypes] = useState<ReadonlySet<string>>(new Set());
  const [gearIds, setGearIds] = useState<ReadonlySet<string>>(new Set());

  const { from, to } = periodDays(period);
  const { report, status, error, retry } = useHeatmap({ from, to });

  // Decoded once per load; the filters below only pick from these.
  const decoded = useMemo<MapRoute[]>(
    () =>
      (report?.routes ?? [])
        .map((r) => ({ ...r, points: decodePolyline(r.polyline) }))
        .filter((r) => r.points.length >= 2),
    [report]
  );

  const presentTypes = useMemo(() => [...new Set(decoded.map((r) => r.sportType))], [decoded]);
  const gearOptions = useMemo(
    () => (report?.gear ?? []).map((g) => ({ id: g.id, label: g.retired ? `${g.name} (retired)` : g.name })),
    [report]
  );

  // A choice that isn't in this date range (e.g. a bike you didn't ride then) is ignored, not applied.
  const visible = useMemo(() => {
    const sportFilter = new Set([...sportTypes].filter((t) => presentTypes.includes(t)));
    const gearFilter = new Set([...gearIds].filter((g) => gearOptions.some((o) => o.id === g)));
    return decoded.filter(
      (r) =>
        (sportFilter.size === 0 || sportFilter.has(r.sportType)) &&
        (gearFilter.size === 0 || (r.gearId !== null && gearFilter.has(r.gearId)))
    );
  }, [decoded, sportTypes, gearIds, presentTypes, gearOptions]);

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
          <PeriodFilter value={period} onChange={setPeriod} />
          {presentTypes.length > 1 && (
            <SportTypeFilter types={presentTypes} value={sportTypes} onChange={setSportTypes} />
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
