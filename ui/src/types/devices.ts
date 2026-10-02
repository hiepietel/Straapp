import type { Totals } from "./statistics";

export interface DeviceItem {
  name: string;
  totals: Totals;
  firstUsed: string;
  lastUsed: string;
  years: { year: number; totals: Totals }[];
  color: number;
}

export interface DeviceReport {
  today: string;
  devices: DeviceItem[];
  months: { month: string; devices: Record<string, Totals> }[];
  timelines: { name: string; points: { date: string; totals: Totals }[] }[];
  historyFrom: string | null;
}