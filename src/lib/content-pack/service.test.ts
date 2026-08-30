import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it } from "vitest";

import { Db, makeInMemoryDb } from "@/lib/db/service";
import { RateLimited } from "@/lib/errors";
import { HOOK_PATTERNS } from "@/lib/content-pack/hook-library";
import {
  generateContentPack,
  packTextChunks,
  startContentPack,
} from "@/lib/content-pack/service";
import { makePackTextFixture } from "@/lib/content-pack/schema";
import { makeLLMPortFake } from "@/lib/ports";
import { makeInMemoryUsage } from "@/lib/usage/service";
import { makeVoiceProfileFixture } from "@/lib/voice/schema";

const input = {
  userId: "founder-1",
  idea: "Why small B2B teams should turn customer calls into content lessons.",
  pillar: "Founder-led distribution",
  goal: "leads" as const,
  voiceProfile: makeVoiceProfileFixture(),
  idempotencyKey: "phone-request-1",
};

describe("ContentPackService", () => {
  it("creates the full text pack, queues independent media jobs, and records a non-zero meter through the fake-layer seam", async () => {
    const db = makeInMemoryDb();
    const usage = makeInMemoryUsage();
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        usage.layer,
        makeLLMPortFake({ contentPacks: [makePackTextFixture()] }),
      ),
    );

    const result = await runtime.runPromise(generateContentPack(input));

    expect(result).toMatchObject({
      reused: false,
      pack: { status: "ready", costCents: expect.any(Number) },
    });
    expect(result.pack.costCents).toBeGreaterThan(0);
    expect(result.pack.costCents).toBeLessThanOrEqual(30);
    expect(db.packRows()).toHaveLength(1);
    expect(db.assetRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "post",
          status: "done",
          costCents: expect.any(Number),
        }),
        expect.objectContaining({ type: "newsletter", status: "done" }),
        expect.objectContaining({ type: "carousel", status: "queued" }),
        expect.objectContaining({ type: "video", status: "queued" }),
        expect.objectContaining({ type: "magnet", status: "queued" }),
      ]),
    );
    expect(db.jobRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "generate-pack-text", status: "done" }),
        expect.objectContaining({ type: "render-carousel", status: "queued" }),
        expect.objectContaining({ type: "render-video", status: "queued" }),
        expect.objectContaining({ type: "render-magnet", status: "queued" }),
      ]),
    );
    expect(db.assetVersionRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "generic", fidelityScore: null }),
        expect.objectContaining({
          action: "voice-pass",
          fidelityScore: expect.any(Number),
        }),
      ]),
    );
    expect(db.assetVersionRows()).toHaveLength(4);
    expect(db.usageRows()).toEqual(
      expect.arrayContaining([
      expect.objectContaining({
        operation: "openai.generate-pack-text.estimated",
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        costCents: expect.any(Number),
      }),
      expect.objectContaining({
        operation: "openai.voice-pass.terra.estimated",
      }),
      ]),
    );
    expect(db.usageRows()).toHaveLength(3);
  });

  it("reconnects by idempotency key without duplicating jobs or provider work", async () => {
    const db = makeInMemoryDb();
    const usage = makeInMemoryUsage();
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        usage.layer,
        makeLLMPortFake({ contentPacks: [makePackTextFixture()] }),
      ),
    );

    const first = await runtime.runPromise(generateContentPack(input));
    const second = await runtime.runPromise(generateContentPack(input));

    expect(second).toMatchObject({ reused: true, pack: { id: first.pack.id } });
    expect(db.packRows()).toHaveLength(1);
    expect(db.jobRows()).toHaveLength(4);
    expect(db.usageRows()).toHaveLength(3);
  });

  it("returns the persisted in-progress pack when a refresh races a running generation", async () => {
    const db = makeInMemoryDb();
    const usage = makeInMemoryUsage();
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        usage.layer,
        makeLLMPortFake({ contentPacks: [makePackTextFixture()] }),
      ),
    );
    const draft = await runtime.runPromise(startContentPack(input));
    const generationJob = db
      .jobRows()
      .find((job) => job.type === "generate-pack-text");
    if (!generationJob) throw new Error("Expected the generation job.");
    await runtime.runPromise(
      Effect.gen(function* () {
        const repository = yield* Db;
        return yield* repository.claimQueuedJob(generationJob.id);
      }),
    );

    const reconnect = await runtime.runPromise(generateContentPack(input));

    expect(reconnect).toMatchObject({ reused: true, pack: { id: draft.id } });
    expect(db.packRows()).toHaveLength(1);
    expect(db.jobRows()).toHaveLength(1);
    expect(db.usageRows()).toHaveLength(0);
  });

  it("keeps a provider failure typed and marks only the generation job failed", async () => {
    const db = makeInMemoryDb();
    const usage = makeInMemoryUsage();
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        usage.layer,
        makeLLMPortFake({
          contentPacks: [
            new RateLimited({
              operation: "content-pack",
              retryAfterSeconds: 30,
            }),
          ],
        }),
      ),
    );

    const outcome = await runtime.runPromise(
      generateContentPack(input).pipe(Effect.either),
    );

    expect(outcome).toMatchObject({
      _tag: "Left",
      left: { _tag: "RateLimited", retryAfterSeconds: 30 },
    });
    expect(db.jobRows()).toEqual([
      expect.objectContaining({ type: "generate-pack-text", status: "failed" }),
    ]);
    expect(db.assetRows()).toHaveLength(0);
  });

  it("resumes an automatic voice-pass failure without regenerating or replacing saved versions", async () => {
    const db = makeInMemoryDb();
    const usage = makeInMemoryUsage();
    let contentPackCalls = 0;
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        usage.layer,
        makeLLMPortFake({
          contentPacks: [makePackTextFixture()],
          voicePasses: [
            new RateLimited({
              operation: "voice-pass",
              retryAfterSeconds: 30,
            }),
          ],
          onContentPack: () => {
            contentPackCalls += 1;
          },
        }),
      ),
    );

    const first = await runtime.runPromise(
      generateContentPack(input).pipe(Effect.either),
    );

    expect(first).toMatchObject({
      _tag: "Left",
      left: { _tag: "RateLimited", retryAfterSeconds: 30 },
    });
    expect(contentPackCalls).toBe(1);
    expect(db.jobRows()).toEqual([
      expect.objectContaining({ type: "generate-pack-text", status: "failed" }),
    ]);
    expect(db.assetVersionRows()).toEqual([
      expect.objectContaining({ action: "generic" }),
    ]);

    const resumed = await runtime.runPromise(generateContentPack(input));

    expect(resumed).toMatchObject({ reused: false, pack: { status: "ready" } });
    expect(contentPackCalls).toBe(1);
    expect(db.jobRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "generate-pack-text", status: "done" }),
      ]),
    );
    expect(db.assetVersionRows()).toHaveLength(4);
    expect(db.assetVersionRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "generic" }),
        expect.objectContaining({ action: "voice-pass" }),
      ]),
    );
  });

  it("requeues only a failed media asset and creates one new retry job", async () => {
    const db = makeInMemoryDb();
    const usage = makeInMemoryUsage();
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        usage.layer,
        makeLLMPortFake({ contentPacks: [makePackTextFixture()] }),
      ),
    );
    await runtime.runPromise(generateContentPack(input));
    const video = db.assetRows().find((asset) => asset.type === "video");
    if (!video) throw new Error("Expected the video asset.");

    const retried = await runtime.runPromise(
      Effect.gen(function* () {
        const repository = yield* Db;
        yield* repository.updateAssetStatus({
          assetId: video.id,
          status: "failed",
          error: "worker unavailable",
        });
        return yield* repository.retryAsset(input.userId, video.id);
      }),
    );

    expect(retried).toMatchObject({ status: "queued", error: null });
    expect(db.jobRows()).toHaveLength(5);
    expect(db.jobRows().at(-1)).toMatchObject({
      assetId: video.id,
      type: "render-video",
      status: "queued",
      attempt: 1,
    });
  });

  it("seeds more than 300 patterns and keeps fixture posts LinkedIn-ready", () => {
    const pack = makePackTextFixture();

    expect(HOOK_PATTERNS.length).toBeGreaterThanOrEqual(300);
    for (const post of pack.postVariants) {
      expect(post).not.toMatch(/https?:\/\//i);
      expect(post.split("\n", 1)[0].length).toBeLessThanOrEqual(210);
      expect(post).toContain(`Comment ${pack.commentKeyword}`);
      for (const paragraph of post.split("\n\n")) {
        expect(paragraph.split("\n").length).toBeLessThanOrEqual(3);
      }
    }
    expect(pack.videoScript.trim().split(/\s+/).length).toBeLessThanOrEqual(
      150,
    );
    expect(
      pack.newsletter.body.trim().split(/\s+/).length,
    ).toBeGreaterThanOrEqual(120);
    expect(pack.newsletter.body.trim().split(/\s+/).length).toBeLessThanOrEqual(
      180,
    );
  });

  it("emits bounded, reconstructable content chunks for the SSE response", () => {
    const pack = makePackTextFixture();
    const chunks = packTextChunks(pack);

    expect(chunks).not.toHaveLength(0);
    expect(chunks.every((chunk) => chunk.delta.length <= 120)).toBe(true);
    expect(
      chunks
        .filter((chunk) => chunk.asset === "post")
        .map((chunk) => chunk.delta)
        .join(""),
    ).toBe(pack.postVariants.join("\n\n---\n\n"));
    expect(chunks.map((chunk) => chunk.asset)).toEqual(
      expect.arrayContaining(["post", "newsletter", "carousel", "video", "magnet"]),
    );
  });
});
