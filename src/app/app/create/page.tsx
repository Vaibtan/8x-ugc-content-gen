import { redirect } from "next/navigation";

import { ContentPackWorkspace } from "@/components/content-pack-workspace";
import { MobileShell } from "@/components/mobile-shell";
import { getCurrentSession } from "@/lib/auth/server-client";
import { findOwnVoiceProfile, listOwnPacks } from "@/lib/db/service";
import { runForUser } from "@/lib/runtime";

export default async function CreatePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/");
  const [voiceProfile, packs] = await Promise.all([
    runForUser(session.access_token, findOwnVoiceProfile(session.user.id)),
    runForUser(session.access_token, listOwnPacks(session.user.id)),
  ]);
  return (
    <MobileShell activePath="/app/create">
      <ContentPackWorkspace
        canGenerate={voiceProfile !== null}
        initialPacks={packs}
      />
    </MobileShell>
  );
}
