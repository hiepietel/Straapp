import type { SportGroupId } from "../../utils/sports";

export interface SportOption {
  id: SportGroupId;
  label: string;
}

export interface SportMultiSelectProps {
  options: readonly SportOption[];
  /** An empty set means "every type" — that's what the "All" pill selects. */
  value: ReadonlySet<SportGroupId>;
  onChange: (value: ReadonlySet<SportGroupId>) => void;
}

export default function SportMultiSelect({ options, value, onChange }: SportMultiSelectProps) {
  const toggle = (id: SportGroupId) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter statistics by activity type">
      <button
        type="button"
        aria-pressed={value.size === 0}
        onClick={() => onChange(new Set())}
        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          value.size === 0 ? "bg-ink text-chalk" : "bg-chalk text-ink hover:bg-white border border-line"
        }`}
      >
        All
      </button>
      {options.map((option) => {
        const active = value.has(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-ink text-chalk" : "bg-chalk text-ink hover:bg-white border border-line"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
