import { Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { MobileShell } from "@/components/mobile-shell";
import { getCurrentSession } from "@/lib/auth/server-client";
import { findOwnUser } from "@/lib/db/service";
import { runForUser } from "@/lib/runtime";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/");

  const user = await runForUser(
    session.access_token,
    findOwnUser(session.user.id),
  );

  return (
    <MobileShell activePath="/app">
      <section className="pt-6">
        <p className="text-sm font-semibold text-[var(--muted-foreground)]">
          Good to have you here
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
          {user.display_name ?? session.user.email?.split("@")[0] ?? "Founder"},
          make your next idea travel.
        </h1>
      </section>
      <section className="mt-8 rounded-3xl bg-[var(--primary)] p-6 text-[var(--primary-foreground)]">
        <Sparkles aria-hidden="true" className="text-[#ffc9a9]" size={26} />
        <h2 className="mt-5 text-xl font-bold">
          Your strategy starts with a five-minute interview.
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#d9e9e0]">
          Voice answers are optional. You can always type instead.
        </p>
      </section>
      <section className="mt-5 grid gap-3">
        {[
          "Set up your brand kit",
          "Answer your founder interview",
          "Generate a 30-day calendar",
        ].map((item, index) => (
          <div
            className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
            key={item}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-sm font-black text-[var(--primary)]">
              {index + 1}
            </span>
            <p className="text-sm font-semibold">{item}</p>
          </div>
        ))}
      </section>
    </MobileShell>
  );
}
