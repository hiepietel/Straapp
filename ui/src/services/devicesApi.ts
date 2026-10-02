import { apiGet } from "./api";
import type { DeviceReport } from "../types/devices";

/** Prepared by the API from stored activities; never reaches Strava. */
export function fetchDeviceReport(today: string): Promise<DeviceReport> {
  return apiGet<DeviceReport>("/api/devices", { today });
}