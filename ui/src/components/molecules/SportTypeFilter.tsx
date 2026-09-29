import { GROUPS, groupOfType, sportTypeLabel } from "../../utils/sports";
import type { SportGroupId } from "../../utils/sports";

export interface SportTypeFilterProps {
  /** The Strava sport types in the data (e.g. "Ride", "MountainBikeRide"); only these are offered. */
  types: readonly string[];
  /** The chosen sport types; empty means all of them. */
  value: ReadonlySet<string>;
  onChange: (value: ReadonlySet<string>) => void;
}

const GROUP_IDS = Object.keys(GROUPS) as SportGroupId[];
const PILL = "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors border";
const ON = "bg-ink text-chalk border-ink";
const PART = "bg-chalk text-ink border-ink";
const OFF = "bg-chalk text-ink hover:bg-white border-line";
const SUB_PILL = "rounded-full px-3 py-1 text-xs font-semibold transition-colors border";

// Sports in two levels: a group (Rides) picks all its types at once; once a group with more
// than one type is picked, its types (Ride, Gravel, MTB, Virtual ride…) can be picked one by one.
export default function SportTypeFilter({ types, value, onChange }: SportTypeFilterProps) {
  const byGroup = new Map<SportGroupId, string[]>();
  for (const type of [...new Set(types)].sort()) {
    const group = groupOfType(type);
    byGroup.set(group, [...(byGroup.get(group) ?? []), type]);
  }
  const groups = GROUP_IDS.filter((g) => byGroup.has(g));

  const chosenIn = (g: SportGroupId) => (byGroup.get(g) ?? []).filter((t) => value.has(t));
  const toggleGroup = (g: SportGroupId) => {
    const members = byGroup.get(g) ?? [];
    const next = new Set(value);
    if (chosenIn(g).length === members.length) members.forEach((t) => next.delete(t));
    else members.forEach((t) => next.add(t));
    onChange(next);
  };
  const toggleType = (t: string) => {
    const next = new Set(value);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    onChange(next);
  };

  // Sub-types show for every picked group that has a choice to make.
  const expanded = groups.filter((g) => chosenIn(g).length > 0 && (byGroup.get(g)?.length ?? 0) > 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by sport">
        <button
          type="button"
          aria-pressed={value.size === 0}
          onClick={() => onChange(new Set())}
          className={`${PILL} ${value.size === 0 ? ON : OFF}`}
        >
          All
        </button>
        {groups.map((g) => {
          const chosen = chosenIn(g).length;
          const all = chosen === (byGroup.get(g)?.length ?? 0);
          return (
            <button
              key={g}
              type="button"
              aria-pressed={all ? true : chosen > 0 ? "mixed" : false}
              onClick={() => toggleGroup(g)}
              className={`${PILL} ${all ? ON : chosen > 0 ? PART : OFF}`}
            >
              {GROUPS[g].label}
            </button>
          );
        })}
      </div>

      {expanded.map((g) => (
        <div key={g} className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${GROUPS[g].label} types`}>
          <span className="mr-1 text-xs text-mute">{GROUPS[g].label}:</span>
          {(byGroup.get(g) ?? []).map((t) => {
            const on = value.has(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleType(t)}
                className={`${SUB_PILL} ${on ? ON : OFF}`}
              >
                {sportTypeLabel(t)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
