import type { AthleteZones, ZoneRange } from "../../types/strava";

const CELL = "px-3 py-2 sm:px-4";

function formatRange(zone: ZoneRange, unit: string): string {
  return zone.max < 0 ? `${zone.min}+ ${unit}` : `${zone.min}–${zone.max} ${unit}`;
}

function ZoneTable({ title, zones, unit }: { title: string; zones: ZoneRange[]; unit: string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-mute">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-line bg-chalk">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="border-b border-line text-mute">
            <tr>
              <th scope="col" className={CELL + " font-semibold"}>
                Zone
              </th>
              <th scope="col" className={CELL + " font-semibold"}>
                Range
              </th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone, i) => (
              <tr key={i} className="border-b border-line last:border-b-0">
                <th scope="row" className={CELL + " num font-semibold"}>
                  Z{i + 1}
                </th>
                <td className={CELL + " num"}>{formatRange(zone, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface AthleteZonesPanelProps {
  zones: AthleteZones;
}

// GET /athlete/zones — heart-rate and power training zones.
export default function AthleteZonesPanel({ zones }: AthleteZonesPanelProps) {
  const heartRate = zones.heart_rate?.zones ?? [];
  const power = zones.power?.zones ?? [];

  if (heartRate.length === 0 && power.length === 0) {
    return <p className="text-sm text-mute">No training zones are set up on this Strava account.</p>;
  }

  return (
    <div className="space-y-6">
      {heartRate.length > 0 && <ZoneTable title="Heart rate" zones={heartRate} unit="bpm" />}
      {power.length > 0 && <ZoneTable title="Power" zones={power} unit="W" />}
    </div>
  );
}
