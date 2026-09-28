import { useCallback, useState } from "react";
import { SERIES_KEYS, isSeriesKey } from "../utils/chartSeries";
import type { SeriesKey } from "../utils/chartSeries";

const STORAGE_KEY = "straapp.charts";
export const MAX_CHARTS = 3;

export type ChartSize = "s" | "m" | "l";
export const CHART_SIZES: readonly ChartSize[] = ["s", "m", "l"];
const isChartSize = (value: unknown): value is ChartSize => CHART_SIZES.includes(value as ChartSize);

export interface ChartPanel {
  id: number;
  /** Which lines are switched on. Keys this activity didn't record are simply skipped. */
  series: SeriesKey[];
  size: ChartSize;
}

// One big chart with everything on it; the reader switches off what they don't want.
const DEFAULT_LAYOUT: ChartPanel[] = [{ id: 1, series: [...SERIES_KEYS], size: "l" }];

function readStored(): ChartPanel[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_LAYOUT;
    const panels = raw.slice(0, MAX_CHARTS).map((p, i): ChartPanel => {
      const { series, size } = (p ?? {}) as Record<string, unknown>;
      return {
        id: i + 1,
        series: Array.isArray(series) ? series.filter(isSeriesKey) : [],
        size: isChartSize(size) ? size : "m",
      };
    });
    return panels;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function store(panels: ChartPanel[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
  } catch {
    // Storage blocked: the layout still applies for this tab, just doesn't persist.
  }
}

export interface ChartLayout {
  panels: ChartPanel[];
  update: (id: number, change: Partial<Omit<ChartPanel, "id">>) => void;
  /** Adds a chart showing `series`; does nothing once there are MAX_CHARTS. */
  add: (series: SeriesKey[]) => void;
  remove: (id: number) => void;
}

/** How many charts there are, what each shows and how tall — remembered locally, like the map settings. */
export function useChartLayout(): ChartLayout {
  const [panels, setPanels] = useState(readStored);

  const change = useCallback((fn: (current: ChartPanel[]) => ChartPanel[]) => {
    setPanels((current) => {
      const next = fn(current);
      store(next);
      return next;
    });
  }, []);

  const update = useCallback<ChartLayout["update"]>(
    (id, patch) => change((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [change]
  );

  const add = useCallback<ChartLayout["add"]>(
    (series) =>
      change((current) =>
        current.length >= MAX_CHARTS
          ? current
          : [...current, { id: Math.max(0, ...current.map((p) => p.id)) + 1, series, size: "m" }]
      ),
    [change]
  );

  const remove = useCallback<ChartLayout["remove"]>(
    (id) => change((current) => (current.length > 1 ? current.filter((p) => p.id !== id) : current)),
    [change]
  );

  return { panels, update, add, remove };
}
