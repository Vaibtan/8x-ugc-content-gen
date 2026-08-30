import { getAuthenticatedIdentity } from "@/lib/auth/server-client";
import {
  findOwnPack,
  findOwnVoiceProfile,
  listAssetVersions,
  listPackAssets,
  listPackJobs,
  retryAsset,
  updatePackStatus,
} from "@/lib/db/service";
import { runForUser } from "@/lib/runtime";
import { VoicePassService } from "@/lib/voice-pass/service";

type RouteContext = Readonly<{ params: Promise<{ packId: string }> }>;

export async function GET(_request: Request, { params }: RouteContext) {
  const identity = await getAuthenticatedIdentity();
  if (!identity)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const { packId } = await params;
  const pack = await runForUser(
    identity.accessToken,
    findOwnPack(identity.userId, packId),
  );
  if (!pack)
    return Response.json({ error: "Pack not found." }, { status: 404 });
  const [assets, jobs] = await Promise.all([
    runForUser(identity.accessToken, listPackAssets(packId)),
    runForUser(identity.accessToken, listPackJobs(packId)),
  ]);
  const versions = await Promise.all(
    assets
      .filter((asset) => asset.type === "post" || asset.type === "newsletter")
      .map(async (asset) => [
        asset.id,
        await runForUser(identity.accessToken, listAssetVersions(asset.id)),
      ] as const),
  );
  return Response.json({
    pack,
    assets,
    jobs,
    assetVersions: Object.fromEntries(versions),
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const identity = await getAuthenticatedIdentity();
  if (!identity)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const { packId } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    assetId?: string;
  } | null;

  if (body?.action === "mark-posted") {
    const pack = await runForUser(
      identity.accessToken,
      updatePackStatus(packId, "posted"),
    );
    return Response.json({ pack });
  }
  if (body?.action === "retry" && typeof body.assetId === "string") {
    const asset = await runForUser(
      identity.accessToken,
      retryAsset(identity.userId, body.assetId),
    );
    return Response.json({ asset });
  }
  if (
    typeof body?.assetId === "string" &&
    (body.action === "more-like-my-voice" ||
      body.action === "punchier-hook" ||
      body.action === "shorter")
  ) {
    const profile = await runForUser(
      identity.accessToken,
      findOwnVoiceProfile(identity.userId),
    );
    if (profile === null) {
      return Response.json(
        { error: "Finish the voice interview before steering a rewrite." },
        { status: 409 },
      );
    }
    const outcome = await runForUser(
      identity.accessToken,
      VoicePassService.run({
        userId: identity.userId,
        packId,
        assetId: body.assetId,
        voiceProfile: profile.profile,
        action: body.action,
      }),
    );
    return Response.json(outcome);
  }
  return Response.json({ error: "Unknown pack action." }, { status: 400 });
}
