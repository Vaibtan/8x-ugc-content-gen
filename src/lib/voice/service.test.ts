import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it } from "vitest";

import { makeInMemoryDb } from "@/lib/db/service";
import { RateLimited } from "@/lib/errors";
import { makeLLMPortFake } from "@/lib/ports";
import { generateVoiceProfile } from "@/lib/voice/service";
import { makeVoiceProfileFixture } from "@/lib/voice/schema";
import { voiceErrorState } from "@/lib/voice/ui-error";

const interview = {
  answers: [
    {
      questionId: "offer",
      question: "What do you sell?",
      answer: "We help B2B teams turn expert knowledge into qualified demand.",
    },
  ],
  pastPosts: ["The practical playbook beats a pretty strategy deck."],
};

describe("VoiceProfileService", () => {
  it("generates and persists a profile through the agreed fake-layer seam", async () => {
    const db = makeInMemoryDb();
    const profile = makeVoiceProfileFixture({
      signaturePhrases: ["Make it useful before you make it clever."],
    });
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(db.layer, makeLLMPortFake({ voiceProfiles: [profile] })),
    );

    await expect(
      runtime.runPromise(
        generateVoiceProfile({ userId: "founder-1", interview }),
      ),
    ).resolves.toEqual(profile);
    expect(db.voiceProfileRows()).toEqual([
      expect.objectContaining({ user_id: "founder-1", profile }),
    ]);
  });

  it("surfaces a rate limit without collapsing it into a generic UI error", async () => {
    const db = makeInMemoryDb();
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        makeLLMPortFake({
          voiceProfiles: [
            new RateLimited({
              operation: "voice-profile",
              retryAfterSeconds: 10,
            }),
          ],
        }),
      ),
    );

    const result = await runtime.runPromise(
      generateVoiceProfile({ userId: "founder-1", interview }).pipe(
        Effect.either,
      ),
    );

    expect(result).toMatchObject({
      _tag: "Left",
      left: { _tag: "RateLimited", retryAfterSeconds: 10 },
    });
    if (result._tag === "Left") {
      expect(voiceErrorState(result.left)).toMatchObject({
        code: "rate_limited",
        retryAfterSeconds: 10,
      });
    }
  });
});
