import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

// The heading row is the toggle; the content stays mounted while hidden so it keeps its state.
export default function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section>
      <h2 className="text-lg font-bold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          className="flex w-full items-center justify-between gap-3 border-b border-line pb-2 text-left hover:text-mute"
        >
          {title}
          <ChevronDown
            className={`size-5 shrink-0 text-mute transition-transform motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="mt-4">
        {children}
      </div>
    </section>
  );
}
