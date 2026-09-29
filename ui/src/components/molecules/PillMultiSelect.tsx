export interface PillOption<Id extends string = string> {
  id: Id;
  label: string;
}

export interface PillMultiSelectProps<Id extends string = string> {
  options: readonly PillOption<Id>[];
  /** An empty set means "all of them" — that's what the "All" pill selects. */
  value: ReadonlySet<Id>;
  onChange: (value: ReadonlySet<Id>) => void;
  /** Names the group for screen readers. */
  label: string;
}

const PILL = "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors";
const ON = "bg-ink text-chalk";
const OFF = "bg-chalk text-ink hover:bg-white border border-line";

export default function PillMultiSelect<Id extends string>({ options, value, onChange, label }: PillMultiSelectProps<Id>) {
  const toggle = (id: Id) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      <button
        type="button"
        aria-pressed={value.size === 0}
        onClick={() => onChange(new Set())}
        className={`${PILL} ${value.size === 0 ? ON : OFF}`}
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
            className={`${PILL} ${active ? ON : OFF}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
