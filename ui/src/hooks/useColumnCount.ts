import { useCallback, useState } from "react";

const STORAGE_KEY = "straapp.grid-columns";
export const DEFAULT_COLUMNS = 3;
export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 6;

function readStored(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(n) && n >= MIN_COLUMNS && n <= MAX_COLUMNS ? n : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

/** How many activity cards sit side by side — a per-viewer preference, remembered locally. */
export function useColumnCount(): [number, (columns: number) => void] {
  const [columns, setColumns] = useState(readStored);

  const update = useCallback((next: number) => {
    setColumns(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage blocked: the choice still applies for this tab, just doesn't persist.
    }
  }, []);

  return [columns, update];
}
