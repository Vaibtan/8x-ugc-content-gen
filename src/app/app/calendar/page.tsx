import { redirect } from "next/navigation";

import { StrategyCalendar } from "@/components/strategy-calendar";
import { MobileShell } from "@/components/mobile-shell";
import { getCurrentSession } from "@/lib/auth/server-client";
import { findOwnStrategy, findOwnVoiceProfile } from "@/lib/db/service";
import { runForUser } from "@/lib/runtime";

export default async function CalendarPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/");

  const [voiceProfile, strategy] = await Promise.all([
    runForUser(session.access_token, findOwnVoiceProfile(session.user.id)),
    runForUser(session.access_token, findOwnStrategy(session.user.id)),
  ]);

  return (
    <MobileShell activePath="/app/calendar">
      <section className="pt-6 pb-2">
        <p className="text-sm font-semibold text-[var(--muted-foreground)]">
          Your plan
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">
          Strategy that compounds.
        </h1>
      </section>
      <StrategyCalendar
        hasVoiceProfile={voiceProfile !== null}
        initialStrategy={strategy?.strategy ?? null}
      />
    </MobileShell>
  );
}
