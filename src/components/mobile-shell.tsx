import {
  CalendarDays,
  CircleUserRound,
  House,
  Lightbulb,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tab = Readonly<{
  href: string;
  label: string;
  icon: LucideIcon;
}>;

const tabs: ReadonlyArray<Tab> = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/create", label: "Create", icon: Lightbulb },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/leads", label: "Leads", icon: CircleUserRound },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function MobileShell({
  children,
  activePath,
}: Readonly<{ children: ReactNode; activePath: string }>) {
  return (
    <div className="min-h-dvh bg-[var(--background)] pb-24 text-[var(--foreground)]">
      <header className="mx-auto flex w-full max-w-screen-sm items-center justify-between px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link className="text-base font-black tracking-[-0.04em]" href="/app">
          founder<span className="text-[var(--accent)]">voice</span>
        </Link>
        <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
          MVP
        </span>
      </header>
      <main className="mx-auto w-full max-w-screen-sm px-5">{children}</main>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--border)] bg-[color:var(--card)]/95 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
      >
        <div className="mx-auto grid w-full max-w-screen-sm grid-cols-5 px-2">
          {tabs.map(({ href, label, icon: Icon }) => {
            const current = activePath === href;
            return (
              <Link
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition",
                  current
                    ? "bg-[var(--muted)] text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
                href={href}
                key={href}
              >
                <Icon
                  aria-hidden="true"
                  size={20}
                  strokeWidth={current ? 2.5 : 2}
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
