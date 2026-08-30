import { Effect } from "effect";

import { type AssetRow, Db, type JobRow, type PackRow } from "@/lib/db/service";
import { sampleHookPatterns } from "@/lib/content-pack/hook-library";
import { type PackText } from "@/lib/content-pack/schema";
import { LLMPort } from "@/lib/ports";
import { SupabaseError } from "@/lib/errors";
import { Usage } from "@/lib/usage/service";
import { type VoiceProfile } from "@/lib/voice/schema";
import {
  VoicePassService,
  assetContentAsText,
} from "@/lib/voice-pass/service";

export type ContentPackInput = Readonly<{
  userId: string;
  idea: string;
  pillar: string;
  goal: "reach" | "leads";
  voiceProfile: VoiceProfile;
  /** Stable across reconnects; this is the no-duplicate-work boundary. */
  idempotencyKey: string;
}>;

export type ContentPackResult = Readonly<{
  pack: PackRow;
  assets: ReadonlyArray<AssetRow>;
  jobs: ReadonlyArray<JobRow>;
  reused: boolean;
}>;

export type ContentPackDraftInput = Omit<ContentPackInput, "voiceProfile">;

export type PackTextChunk = Readonly<{
  asset: "post" | "newsletter" | "carousel" | "video" | "magnet";
  delta: string;
}>;

type PackAssets = Readonly<{
  post: AssetRow;
  newsletter: AssetRow;
  carousel: AssetRow;
  video: AssetRow;
  magnet: AssetRow;
}>;

const characterCount = (text: PackText) => JSON.stringify(text).length;

const chunksFor = (asset: PackTextChunk["asset"], value: string) =>
  Array.from({ length: Math.ceil(value.length / 120) }, (_, index) => ({
    asset,
    delta: value.slice(index * 120, (index + 1) * 120),
  }));

/**
 * Convert the validated structured result into bounded SSE deltas. The client
 * can render each asset before its durable media jobs finish, while the final
 * database value remains the one strict-schema-validated PackText object.
 */
export const packTextChunks = (text: PackText): ReadonlyArray<PackTextChunk> =>
  [
    ...chunksFor("post", text.postVariants.join("\n\n---\n\n")),
    ...chunksFor("newsletter", `${text.newsletter.subject}\n\n${text.newsletter.body}`),
    ...chunksFor(
      "carousel",
      text.carouselSlides
        .map((slide, index) => `${index + 1}. ${slide.title}\n${slide.body}`)
        .join("\n\n"),
    ),
    ...chunksFor("video", text.videoScript),
    ...chunksFor(
      "magnet",
      `${text.magnet.title}\n\n${text.magnet.bullets.join("\n")}`,
    ),
  ];

/**
 * We do not receive provider token accounting from a strict-object response
 * today, so meter a documented conservative estimate. It is still durable and
 * non-zero, and gets replaced by actual provider usage when exposed by the
 * adapter without changing this use case or the usage ledger shape.
 */
const estimateGenerationUsage = (input: ContentPackInput, text: PackText) => {
  const inputTokens = Math.max(
    1,
    Math.ceil(
      (input.idea.length +
        input.pillar.length +
        JSON.stringify(input.voiceProfile).length +
        sampleHookPatterns(`${input.idea}:${input.pillar}`).join(" ").length) /
        4,
    ),
  );
  const characters = characterCount(text);
  const outputTokens = Math.max(1, Math.ceil(characters / 4));
  // gpt-5.6-luna research pricing: $0.20/M input and $1.20/M output.
  const costCents = Math.max(
    1,
    Math.ceil(inputTokens * 0.00002 + outputTokens * 0.00012),
  );
  return { inputTokens, outputTokens, characters, costCents };
};

const packAssets = (
  packId: string,
  text: PackText,
  costCents: number,
): Effect.Effect<PackAssets, SupabaseError, Db> =>
  Effect.gen(function* () {
    const db = yield* Db;
    const post = yield* db.upsertAsset({
      packId,
      type: "post",
      status: "done",
      content: {
        variants: text.postVariants,
        commentKeyword: text.commentKeyword,
      },
      costCents,
    });
    const newsletter = yield* db.upsertAsset({
      packId,
      type: "newsletter",
      status: "done",
      content: text.newsletter,
    });
    const carousel = yield* db.upsertAsset({
      packId,
      type: "carousel",
      status: "queued",
      content: text.carouselSlides,
    });
    const video = yield* db.upsertAsset({
      packId,
      type: "video",
      status: "queued",
      content: { script: text.videoScript },
    });
    const magnet = yield* db.upsertAsset({
      packId,
      type: "magnet",
      status: "queued",
      content: text.magnet,
    });
    return { post, newsletter, carousel, video, magnet };
  });

const findExistingPackAssets = (
  assets: ReadonlyArray<AssetRow>,
): PackAssets | null => {
  const find = (type: AssetRow["type"]) =>
    assets.find((asset) => asset.type === type) ?? null;
  const post = find("post");
  const newsletter = find("newsletter");
  const carousel = find("carousel");
  const video = find("video");
  const magnet = find("magnet");
  return post && newsletter && carousel && video && magnet
    ? { post, newsletter, carousel, video, magnet }
    : null;
};

/**
 * Complete only missing automatic voice-pass work. This makes a retry after a
 * provider failure resume from the durable generic versions instead of
 * regenerating a pack or overwriting a founder's saved history.
 */
const completeAutomaticVoicePasses = (
  input: ContentPackInput,
  packId: string,
  assets: PackAssets,
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    for (const asset of [assets.post, assets.newsletter]) {
      const versions = yield* db.listAssetVersions(asset.id);
      if (!versions.some((version) => version.action === "generic")) {
        yield* db.createAssetVersion({
          assetId: asset.id,
          action: "generic",
          content: assetContentAsText(asset.content),
          fidelityScore: null,
          diffNotes: [],
        });
      }
      if (!versions.some((version) => version.action === "voice-pass")) {
        yield* VoicePassService.run({
          userId: input.userId,
          packId,
          assetId: asset.id,
          voiceProfile: input.voiceProfile,
          action: "voice-pass",
        });
      }
    }
  });

const queueMediaJobs = (packId: string, assets: PackAssets) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* Effect.all([
      db.enqueueJob({
        packId,
        assetId: assets.carousel.id,
        type: "render-carousel",
        idempotencyKey: `${packId}:render-carousel`,
      }),
      db.enqueueJob({
        packId,
        assetId: assets.video.id,
        type: "render-video",
        idempotencyKey: `${packId}:render-video`,
      }),
      db.enqueueJob({
        packId,
        assetId: assets.magnet.id,
        type: "render-magnet",
        idempotencyKey: `${packId}:render-magnet`,
      }),
    ]);
  });

const hydrate = (pack: PackRow) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return {
      pack,
      assets: yield* db.listPackAssets(pack.id),
      jobs: yield* db.listPackJobs(pack.id),
      reused: true,
    } satisfies ContentPackResult;
  });

/** Persist the idempotency anchor before submitting durable background work. */
export const startContentPack = (input: ContentPackDraftInput) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const existing = yield* db.findOwnPackByIdempotencyKey(
      input.userId,
      input.idempotencyKey,
    );
    const pack = existing ?? (yield* db.createPack(input));
    yield* db.enqueueJob({
      packId: pack.id,
      assetId: null,
      type: "generate-pack-text",
      idempotencyKey: `${pack.id}:generate-pack-text`,
    });
    return pack;
  });

/**
 * The text-generation domain use case. It persists its idempotency anchor
 * first, so callers can reconnect by key instead of creating a second pack.
 * Media work is queued independently, making one failed renderer non-blocking.
 */
export const generateContentPack = (input: ContentPackInput) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const llm = yield* LLMPort;
    const usage = yield* Usage;
    const previous = yield* db.findOwnPackByIdempotencyKey(
      input.userId,
      input.idempotencyKey,
    );
    const pack =
      previous ??
      (yield* db.createPack({
        userId: input.userId,
        idea: input.idea,
        pillar: input.pillar,
        goal: input.goal,
        idempotencyKey: input.idempotencyKey,
      }));
    const priorJobs = yield* db.listPackJobs(pack.id);
    const previousGenerationJob = priorJobs.find(
      (job) => job.type === "generate-pack-text",
    );
    if (previousGenerationJob?.status === "failed") {
      yield* db.updateJobStatus({
        jobId: previousGenerationJob.id,
        status: "queued",
        error: null,
      });
    }
    const generationJob = yield* db.enqueueJob({
      packId: pack.id,
      assetId: null,
      type: "generate-pack-text",
      idempotencyKey: `${pack.id}:generate-pack-text`,
    });
    const claimedJob = yield* db.claimQueuedJob(generationJob.id);
    if (claimedJob === null) {
      return yield* hydrate(pack);
    }

    const savedPack =
      previous?.text === null || previous === null
        ? yield* Effect.gen(function* () {
            const text = yield* llm
              .generateContentPack({
                idea: input.idea,
                pillar: input.pillar,
                goal: input.goal,
                voiceProfile: input.voiceProfile,
                hookPatterns: sampleHookPatterns(`${input.idea}:${input.pillar}`),
              })
              .pipe(
                Effect.tapError((error) =>
                  db
                    .updateJobStatus({
                      jobId: generationJob.id,
                      status: "failed",
                      error: error._tag,
                    })
                    .pipe(Effect.ignore),
                ),
              );
            const metered = estimateGenerationUsage(input, text);
            yield* usage.record({
              userId: input.userId,
              packId: pack.id,
              operation: "openai.generate-pack-text.estimated",
              ...metered,
            });
            const costCents = yield* usage.flush({
              userId: input.userId,
              packId: pack.id,
            });
            return yield* db.saveGeneratedPack({
              packId: pack.id,
              text,
              costCents,
            });
          })
        : previous;
    const existingAssets = yield* db.listPackAssets(savedPack.id);
    const assets =
      findExistingPackAssets(existingAssets) ??
      (yield* packAssets(
        savedPack.id,
        savedPack.text as PackText,
        savedPack.costCents,
      ));
    yield* completeAutomaticVoicePasses(input, savedPack.id, assets).pipe(
      Effect.tapError((error) =>
        db
          .updateJobStatus({
            jobId: generationJob.id,
            status: "failed",
            error: error._tag,
          })
          .pipe(Effect.ignore),
      ),
    );
    const mediaJobs = yield* queueMediaJobs(savedPack.id, assets);
    const finalPack =
      (yield* db.findOwnPack(input.userId, savedPack.id)) ?? savedPack;
    const completedGeneration = yield* db.updateJobStatus({
      jobId: generationJob.id,
      status: "done",
      costCents: finalPack.costCents,
    });
    return {
      pack: finalPack,
      assets: yield* db.listPackAssets(savedPack.id),
      jobs: [completedGeneration, ...mediaJobs],
      reused: false,
    } satisfies ContentPackResult;
  });

/** Named service facade for callers that prefer a use-case object boundary. */
export const ContentPackService = {
  start: startContentPack,
  generate: generateContentPack,
} as const;
