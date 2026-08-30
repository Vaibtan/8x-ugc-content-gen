import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it } from "vitest";

import { Db, makeInMemoryDb } from "@/lib/db/service";
import { makeLLMPortFake } from "@/lib/ports";
import { makeInMemoryUsage } from "@/lib/usage/service";
import { makeVoiceProfileFixture } from "@/lib/voice/schema";
import { runVoicePass, assetContentAsText } from "@/lib/voice-pass/service";
import { makeVoicePassResultFixture } from "@/lib/voice-pass/schema";

const profile = makeVoiceProfileFixture();

const seedTextAsset = (runtime: ManagedRuntime.ManagedRuntime<Db, never>) =>
  runtime.runPromise(
    Effect.gen(function* () {
      const db = yield* Db;
      const pack = yield* db.createPack({
        userId: "founder-1",
        idea: "A concrete lesson from customer calls",
        pillar: "Founder-led distribution",
        goal: "leads",
        idempotencyKey: "voice-pass-test-pack",
      });
      const asset = yield* db.upsertAsset({
        packId: pack.id,
        type: "post",
        status: "done",
        content: {
          variants: ["Generic opening", "Generic proof", "Generic CTA"],
        },
      });
      yield* db.createAssetVersion({
        assetId: asset.id,
        action: "generic",
        content: assetContentAsText(asset.content),
        fidelityScore: null,
        diffNotes: [],
      });
      return { pack, asset };
    }),
  );

describe("VoicePassService", () => {
  it("appends each steering rewrite without losing generic or previous versions", async () => {
    const db = makeInMemoryDb();
    const usage = makeInMemoryUsage();
    const requestedActions: string[] = [];
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        usage.layer,
        makeLLMPortFake({
          voicePasses: [
            makeVoicePassResultFixture({
              rewrittenDraft: "A more founder-like rewrite.",
              fidelityScore: 91,
              diffNotes: ["Used a sharper hook."],
            }),
            makeVoicePassResultFixture({
              rewrittenDraft: "A shorter founder-like rewrite.",
              fidelityScore: 93,
              diffNotes: ["Removed two qualifying sentences."],
            }),
          ],
          onVoicePass: ({ action }) => requestedActions.push(action),
        }),
      ),
    );
    const { pack, asset } = await seedTextAsset(runtime);

    const first = await runtime.runPromise(
      runVoicePass({
        userId: "founder-1",
        packId: pack.id,
        assetId: asset.id,
        voiceProfile: profile,
        action: "more-like-my-voice",
      }),
    );
    const second = await runtime.runPromise(
      runVoicePass({
        userId: "founder-1",
        packId: pack.id,
        assetId: asset.id,
        voiceProfile: profile,
        action: "shorter",
      }),
    );

    expect(requestedActions).toEqual(["more-like-my-voice", "shorter"]);
    expect(second.asset.content).toBe("A shorter founder-like rewrite.");
    expect(second.pack.costCents).toBeGreaterThan(first.pack.costCents);
    expect(db.assetVersionRows()).toEqual([
      expect.objectContaining({
        version: 1,
        action: "generic",
        fidelityScore: null,
      }),
      expect.objectContaining({
        version: 2,
        action: "more-like-my-voice",
        content: "A more founder-like rewrite.",
        fidelityScore: 91,
      }),
      expect.objectContaining({
        version: 3,
        action: "shorter",
        content: "A shorter founder-like rewrite.",
        fidelityScore: 93,
      }),
    ]);
    expect(db.usageRows()).toEqual([
      expect.objectContaining({
        operation: "openai.voice-pass.terra.estimated",
      }),
      expect.objectContaining({
        operation: "openai.voice-pass.terra.estimated",
      }),
    ]);
  });

  it("only permits an authenticated founder to steer a text asset in their own pack", async () => {
    const db = makeInMemoryDb();
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(db.layer, makeInMemoryUsage().layer, makeLLMPortFake()),
    );
    const { pack, asset } = await seedTextAsset(runtime);

    const exit = await runtime.runPromiseExit(
      runVoicePass({
        userId: "another-founder",
        packId: pack.id,
        assetId: asset.id,
        voiceProfile: profile,
        action: "punchier-hook",
      }),
    );

    expect(exit._tag).toBe("Failure");
    expect(db.assetVersionRows()).toHaveLength(1);
  });

  it("steers carousel, video, and magnet source text while retaining every generic version", async () => {
    const db = makeInMemoryDb();
    const requestedDrafts: string[] = [];
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        makeInMemoryUsage().layer,
        makeLLMPortFake({
          voicePasses: [
            makeVoicePassResultFixture({
              rewrittenDraft: "Carousel in the founder's voice.",
            }),
            makeVoicePassResultFixture({
              rewrittenDraft: "Video in the founder's voice.",
            }),
            makeVoicePassResultFixture({
              rewrittenDraft: "Magnet in the founder's voice.",
            }),
          ],
          onVoicePass: ({ draft }) => requestedDrafts.push(draft),
        }),
      ),
    );
    const seeded = await runtime.runPromise(
      Effect.gen(function* () {
        const repository = yield* Db;
        const pack = yield* repository.createPack({
          userId: "founder-1",
          idea: "A concrete lesson from customer calls",
          pillar: "Founder-led distribution",
          goal: "leads",
          idempotencyKey: "voice-pass-media-pack",
        });
        const assets = yield* Effect.all([
          repository.upsertAsset({
            packId: pack.id,
            type: "carousel",
            status: "queued",
            content: [{ title: "Generic slide", body: "Generic explanation" }],
          }),
          repository.upsertAsset({
            packId: pack.id,
            type: "video",
            status: "queued",
            content: { script: "Generic video script" },
          }),
          repository.upsertAsset({
            packId: pack.id,
            type: "magnet",
            status: "queued",
            content: {
              type: "checklist",
              title: "Generic checklist",
              bullets: ["Generic step"],
            },
          }),
        ]);
        for (const asset of assets) {
          yield* repository.createAssetVersion({
            assetId: asset.id,
            action: "generic",
            content: assetContentAsText(asset.content),
            fidelityScore: null,
            diffNotes: [],
          });
        }
        return { pack, assets };
      }),
    );

    const actions = ["more-like-my-voice", "punchier-hook", "shorter"] as const;
    const outcomes = [];
    for (const [index, asset] of seeded.assets.entries()) {
      outcomes.push(
        await runtime.runPromise(
          runVoicePass({
            userId: "founder-1",
            packId: seeded.pack.id,
            assetId: asset.id,
            voiceProfile: profile,
            action: actions[index]!,
          }),
        ),
      );
    }

    expect(requestedDrafts).toEqual([
      "1. Generic slide\nGeneric explanation",
      "Generic video script",
      "Generic checklist\nGeneric step",
    ]);
    expect(outcomes.map((outcome) => outcome.asset.content)).toEqual([
      "Carousel in the founder's voice.",
      "Video in the founder's voice.",
      "Magnet in the founder's voice.",
    ]);
    for (const asset of seeded.assets) {
      expect(
        db.assetVersionRows().filter((version) => version.assetId === asset.id),
      ).toEqual([
        expect.objectContaining({ action: "generic", fidelityScore: null }),
        expect.objectContaining({ fidelityScore: expect.any(Number) }),
      ]);
    }
  });
});
