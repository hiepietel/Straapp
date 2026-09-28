export interface FilterOption<Id extends string = string> {
  id: Id;
  label: string;
}

export interface FilterTabsProps<Id extends string = string> {
  options: readonly FilterOption<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  /** Names the group for screen readers. */
  label?: string;
}

export default function FilterTabs<Id extends string>({
  options,
  value,
  onChange,
  label = "Filter by sport",
}: FilterTabsProps<Id>) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
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
