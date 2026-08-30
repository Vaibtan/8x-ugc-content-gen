import { getAuthenticatedIdentity } from "@/lib/auth/server-client";
import {
  findOwnPack,
  listPackAssets,
  listPackJobs,
  retryAsset,
  updatePackStatus,
} from "@/lib/db/service";
import { runForUser } from "@/lib/runtime";

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
  return Response.json({ pack, assets, jobs });
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
  return Response.json({ error: "Unknown pack action." }, { status: 400 });
}
