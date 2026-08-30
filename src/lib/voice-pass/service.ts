import { Effect } from "effect";

import {
  type AssetRow,
  type AssetVersion,
  Db,
  type PackRow,
} from "@/lib/db/service";
import { SupabaseError } from "@/lib/errors";
import { LLMPort } from "@/lib/ports";
import { Usage } from "@/lib/usage/service";
import { type VoiceProfile } from "@/lib/voice/schema";
import { type VoicePassAction } from "@/lib/voice-pass/schema";

export type VoicePassInput = Readonly<{
  userId: string;
  packId: string;
  assetId: string;
  voiceProfile: VoiceProfile;
  action: VoicePassAction;
}>;

export type VoicePassOutcome = Readonly<{
  pack: PackRow;
  asset: AssetRow;
  version: AssetVersion;
}>;

const isTextAsset = (asset: AssetRow) =>
  asset.type === "post" || asset.type === "newsletter";

/** Convert legacy structured content into the original human-readable draft. */
export const assetContentAsText = (content: unknown | null): string => {
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    const value = content as {
      variants?: ReadonlyArray<string>;
      subject?: string;
      body?: string;
    };
    if (value.variants) return value.variants.join("\n\n---\n\n");
    if (value.subject !== undefined || value.body !== undefined) {
      return `${value.subject ?? ""}\n\n${value.body ?? ""}`.trim();
    }
  }
  return content === null ? "" : JSON.stringify(content, null, 2);
};

const estimateVoicePassUsage = (draft: string, rewrittenDraft: string) => {
  const inputTokens = Math.max(1, Math.ceil(draft.length / 4));
  const outputTokens = Math.max(1, Math.ceil(rewrittenDraft.length / 4));
  // Research gives terra a $2/M input and $12/M output ceiling. Meter the
  // conservative ceiling rather than presenting a lower estimate as exact.
  const costCents = Math.max(
    1,
    Math.ceil(inputTokens * 0.0002 + outputTokens * 0.0012),
  );
  return {
    inputTokens,
    outputTokens,
    characters: rewrittenDraft.length,
    costCents,
  };
};

const missing = (operation: string, message: string) =>
  new SupabaseError({ operation, cause: new Error(message) });

/**
 * Rewrites the latest durable text version and appends a new immutable
 * version. This is deliberately the same path for the automatic final pass
 * and each founder steering action, so neither can silently erase history.
 */
export const runVoicePass = (input: VoicePassInput) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const llm = yield* LLMPort;
    const usage = yield* Usage;
    const pack = yield* db.findOwnPack(input.userId, input.packId);
    if (pack === null) {
      return yield* Effect.fail(
        missing("voice_pass.pack", "Pack not found for this founder."),
      );
    }
    const assets = yield* db.listPackAssets(pack.id);
    const asset = assets.find((candidate) => candidate.id === input.assetId);
    if (!asset || !isTextAsset(asset)) {
      return yield* Effect.fail(
        missing(
          "voice_pass.asset",
          "Only a text asset in this pack can be rewritten.",
        ),
      );
    }
    const history = yield* db.listAssetVersions(asset.id);
    const draft = history.at(-1)?.content ?? assetContentAsText(asset.content);
    if (!draft.trim()) {
      return yield* Effect.fail(
        missing("voice_pass.draft", "This text asset has no draft to rewrite."),
      );
    }

    const result = yield* llm.generateVoicePass({
      draft,
      voiceProfile: input.voiceProfile,
      action: input.action,
    });
    const metered = estimateVoicePassUsage(draft, result.rewrittenDraft);
    yield* usage.record({
      userId: input.userId,
      packId: pack.id,
      operation: "openai.voice-pass.terra.estimated",
      ...metered,
    });
    const addedCostCents = yield* usage.flush({
      userId: input.userId,
      packId: pack.id,
    });
    const version = yield* db.createAssetVersion({
      assetId: asset.id,
      action: input.action,
      content: result.rewrittenDraft,
      fidelityScore: result.fidelityScore,
      diffNotes: result.diffNotes,
    });
    const updatedAsset = yield* db.updateAssetContent({
      assetId: asset.id,
      content: result.rewrittenDraft,
    });
    const updatedPack = yield* db.updatePackCost({
      packId: pack.id,
      costCents: pack.costCents + addedCostCents,
    });
    return {
      pack: updatedPack,
      asset: updatedAsset,
      version,
    } satisfies VoicePassOutcome;
  });

/** Named service facade for server actions and the content-pack pipeline. */
export const VoicePassService = { run: runVoicePass } as const;
