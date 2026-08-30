import { Either, Schema } from "effect";

import { getAuthenticatedIdentity } from "@/lib/auth/server-client";
import {
  generateContentPack,
  packTextChunks,
  startContentPack,
} from "@/lib/content-pack/service";
import { findOwnVoiceProfile } from "@/lib/db/service";
import { runApp, runForUser } from "@/lib/runtime";

const GeneratePackRequest = Schema.Struct({
  idea: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(4000)),
  pillar: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(160)),
  goal: Schema.Literal("reach", "leads"),
  idempotencyKey: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(160),
  ),
});

const event = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

/**
 * Starts with a persisted draft, then keeps the SSE response open while the
 * text assets arrive as bounded content deltas. The durable pack and job rows
 * make a refresh safe; later media work remains delegated to Inngest.
 */
export async function POST(request: Request) {
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    return Response.json(
      { error: "Sign in before generating a pack." },
      { status: 401 },
    );
  }

  const decoded = Schema.decodeUnknownEither(GeneratePackRequest)(
    await request.json().catch(() => null),
  );
  if (Either.isLeft(decoded)) {
    return Response.json(
      { error: "Enter an idea, choose a pillar, and choose a goal." },
      { status: 400 },
    );
  }

  const profile = await runForUser(
    identity.accessToken,
    findOwnVoiceProfile(identity.userId),
  );
  if (profile === null) {
    return Response.json(
      { error: "Finish the voice interview before generating a pack." },
      { status: 409 },
    );
  }

  const input = {
    userId: identity.userId,
    idea: decoded.right.idea.trim(),
    pillar: decoded.right.pillar.trim(),
    goal: decoded.right.goal,
    idempotencyKey: decoded.right.idempotencyKey,
    voiceProfile: profile.profile,
  } as const;
  const draft = await runForUser(identity.accessToken, startContentPack(input));

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        new TextEncoder().encode(event({ type: "pack-created", pack: draft })),
      );
      try {
        if (draft.text !== null) {
          controller.enqueue(
            new TextEncoder().encode(
              event({ type: "pack-ready", pack: draft }),
            ),
          );
        } else {
          controller.enqueue(
            new TextEncoder().encode(
              event({ type: "pack-generating", packId: draft.id }),
            ),
          );
          // Text creation is short-lived and remains in this request solely
          // so clients see content deltas. The idempotency anchor is already
          // durable, and the longer renderer jobs are still independent.
          const result = await runApp(generateContentPack(input));
          for (const chunk of packTextChunks(result.pack.text!)) {
            controller.enqueue(
              new TextEncoder().encode(
                event({ type: "pack-text-chunk", packId: draft.id, ...chunk }),
              ),
            );
          }
          controller.enqueue(
            new TextEncoder().encode(event({ type: "pack-ready", ...result })),
          );
        }
      } catch (cause) {
        controller.enqueue(
          new TextEncoder().encode(
            event({
              type: "pack-failed",
              message:
                cause instanceof Error
                  ? cause.message
                  : "Pack generation could not start.",
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
