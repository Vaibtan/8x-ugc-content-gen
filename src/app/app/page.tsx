import { redirect } from "next/navigation";

import { MobileShell } from "@/components/mobile-shell";
import { VoiceInterview } from "@/components/voice-interview";
import { getCurrentSession } from "@/lib/auth/server-client";
import { findOwnUser, findOwnVoiceProfile } from "@/lib/db/service";
import { runForUser } from "@/lib/runtime";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/");

  const user = await runForUser(
    session.access_token,
    findOwnUser(session.user.id),
  );
  const voiceProfile = await runForUser(
    session.access_token,
    findOwnVoiceProfile(session.user.id),
  );

  return (
    <MobileShell activePath="/app">
      <section className="pt-6 pb-2">
        <p className="text-sm font-semibold text-[var(--muted-foreground)]">
          Good to have you here,{" "}
          {user.display_name ?? session.user.email?.split("@")[0] ?? "Founder"}
        </p>
      </section>
      <VoiceInterview initialProfile={voiceProfile?.profile ?? null} />
    </MobileShell>
  );
}
