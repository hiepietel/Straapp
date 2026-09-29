import { useEffect, useId, useRef, useState } from "react";
import { BarChart3, Bike, Flame, ListChecks, LogOut, Menu, UserRound, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Avatar from "../atoms/Avatar";
import { GEAR_HREF, HEATMAP_HREF, LIST_HREF, PROFILE_HREF, STATISTICS_HREF } from "../../hooks/useRoute";
import type { Route } from "../../hooks/useRoute";
import type { CurrentUser } from "../../services/auth";

export interface HeaderProps {
  athlete: CurrentUser | null;
  route: Route;
  /** Shown only when there is a session to end (not in demo mode). */
  onLogout?: (() => void) | undefined;
}

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which routes count as "here" for this link. */
  matches: readonly Route["name"][];
}

const LINKS: readonly NavLink[] = [
  { href: LIST_HREF, label: "Activities", icon: ListChecks, matches: ["list", "activity"] },
  { href: STATISTICS_HREF, label: "Statistics", icon: BarChart3, matches: ["statistics"] },
  { href: HEATMAP_HREF, label: "Heatmap", icon: Flame, matches: ["heatmap"] },
  { href: GEAR_HREF, label: "Gear", icon: Bike, matches: ["gear"] },
  { href: PROFILE_HREF, label: "Profile", icon: UserRound, matches: ["profile"] },
];

// The app-wide top bar: a hamburger that opens the navigation drawer, the app name, and the
// athlete. Sticky and compact, so it stays on screen without costing much height.
export default function Header({ athlete, route, onLogout }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const name = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(" ") || "Straapp";

  // Any navigation (a link here, or back/forward) closes the drawer.
  useEffect(() => {
    setOpen(false);
  }, [route]);

  // While open: Esc closes it, focus moves into it, and returns to the toggle afterwards.
  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      toggle?.focus();
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-[1100] border-b border-line bg-pavement/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              ref={toggleRef}
              type="button"
              aria-expanded={open}
              aria-controls={drawerId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
              className="rounded-md p-2 hover:bg-chalk"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <a href={LIST_HREF} className="text-base font-extrabold tracking-tight">
              Straapp
            </a>
          </div>

          <a
            href={PROFILE_HREF}
            className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-semibold hover:bg-chalk"
            aria-label={`View profile: ${name}`}
          >
            <Avatar src={athlete?.profileUrl} name={name} className="size-8 text-xs" />
            <span className="hidden sm:inline">{name}</span>
          </a>
        </div>
      </header>

      {/* The drawer: always rendered so it can slide, but inert and hidden from AT when closed. */}
      <div
        className={`fixed inset-0 z-[1200] bg-ink/40 transition-opacity motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        id={drawerId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-[1300] flex w-72 max-w-[85vw] flex-col bg-chalk shadow-xl transition-transform motion-reduce:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-extrabold tracking-tight">Straapp</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-2 hover:bg-pavement"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {LINKS.map(({ href, label, icon: Icon, matches }) => {
              const current = matches.includes(route.name);
              return (
                <li key={href}>
                  <a
                    href={href}
                    aria-current={current ? "page" : undefined}
                    // Same route (e.g. already on Statistics): no route change will close it.
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 font-semibold ${
                      current ? "bg-ink text-chalk" : "hover:bg-pavement"
                    }`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {onLogout && (
          <div className="border-t border-line p-2">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 font-semibold text-mute hover:bg-pavement hover:text-ink"
            >
              <LogOut className="size-5" aria-hidden="true" />
              Log out
            </button>
          </div>
        )}
      </div>
    </>
  );
}
