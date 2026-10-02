import type { Totals } from "./statistics";

export interface CalendarActivity {
  id: number;
  name: string;
  sportType: string;
  distance: number;
  movingTime: number;
  elevation: number;
}

export interface CalendarDay {
  date: string;
  totals: Totals;
  activities: CalendarActivity[];
}

export interface CalendarReport {
  from: string;
  to: string;
  days: CalendarDay[];
}