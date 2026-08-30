import { Context, Effect, Layer, Schema } from "effect";

import {
  BRAND_ASSET_BUCKET,
  BRAND_ASSET_CONTENT_TYPES,
  type BrandAssetContentType,
  type BrandAssetKind,
  BrandKit,
  type BrandKit as BrandKitType,
  type BrandKitInput,
} from "@/lib/brand-kit/schema";
import {
  type AssetStatus,
  type AssetType,
  type JobStatus,
  type PackStatus,
  type PackText,
  PackTextSchema,
} from "@/lib/content-pack/schema";
import { type Database, type Json } from "@/lib/db/database.types";
import { SupabaseError, UserNotFound } from "@/lib/errors";
import { Supabase } from "@/lib/supabase/service";
import {
  type VoiceInterview,
  type VoiceProfile,
  VoiceInterviewSchema,
  VoiceProfileSchema,
} from "@/lib/voice/schema";
import { type VoicePassAction } from "@/lib/voice-pass/schema";
import {
  type CalendarItem,
  type Strategy,
  StrategySchema,
  strategyValidationIssue,
} from "@/lib/strategy/schema";

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
type BrandKitRow = Database["public"]["Tables"]["brand_kits"]["Row"];
type VoiceProfileDbRow = Database["public"]["Tables"]["voice_profiles"]["Row"];
type StrategyDbRow = Database["public"]["Tables"]["strategies"]["Row"];
type CalendarItemDbRow = Database["public"]["Tables"]["calendar_items"]["Row"];
type PackDbRow = Database["public"]["Tables"]["packs"]["Row"];
type AssetDbRow = Database["public"]["Tables"]["assets"]["Row"];
type AssetVersionDbRow =
  Database["public"]["Tables"]["asset_versions"]["Row"];
type JobDbRow = Database["public"]["Tables"]["jobs"]["Row"];

export type VoiceProfileRow = Readonly<{
  user_id: string;
  profile: VoiceProfile;
  interview: VoiceInterview;
  created_at: string;
  updated_at: string;
}>;

export type StrategyRow = Readonly<{
  id: string;
  user_id: string;
  strategy: Strategy;
  created_at: string;
  updated_at: string;
}>;

export type PackRow = Readonly<{
  id: string;
  userId: string;
  idea: string;
  pillar: string;
  goal: "reach" | "leads";
  status: PackStatus;
  idempotencyKey: string;
  text: PackText | null;
  costCents: number;
  createdAt: string;
  updatedAt: string;
}>;

export type AssetRow = Readonly<{
  id: string;
  packId: string;
  type: AssetType;
  status: AssetStatus;
  content: unknown | null;
  fileUrl: string | null;
  error: string | null;
  costCents: number;
  createdAt: string;
  updatedAt: string;
}>;

/** A durable snapshot of a text asset, ordered per asset from generic to current. */
export type AssetVersion = Readonly<{
  id: string;
  assetId: string;
  version: number;
  action: "generic" | VoicePassAction;
  content: string;
  fidelityScore: number | null;
  diffNotes: ReadonlyArray<string>;
  createdAt: string;
}>;

export type JobRow = Readonly<{
  id: string;
  packId: string;
  assetId: string | null;
  type:
    | "generate-pack-text"
    | "render-carousel"
    | "render-video"
    | "render-magnet";
  status: JobStatus;
  idempotencyKey: string;
  attempt: number;
  error: string | null;
  costCents: number;
  createdAt: string;
  updatedAt: string;
}>;

const decodeVoiceProfileRow = (row: VoiceProfileDbRow) =>
  Effect.try({
    try: () => ({
      user_id: row.user_id,
      profile: Schema.decodeUnknownSync(VoiceProfileSchema)(row.profile_json),
      interview: Schema.decodeUnknownSync(VoiceInterviewSchema)(
        row.interview_json,
      ),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
    catch: (cause) =>
      new SupabaseError({ operation: "voice_profiles.decode", cause }),
  });

const decodePackRow = (row: PackDbRow): Effect.Effect<PackRow, SupabaseError> =>
  Effect.try({
    try: () => ({
      id: row.id,
      userId: row.user_id,
      idea: row.idea,
      pillar: row.pillar,
      goal: row.goal,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      text:
        row.content_json === null
          ? null
          : Schema.decodeUnknownSync(PackTextSchema)(row.content_json),
      costCents: row.cost_cents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
    catch: (cause) => new SupabaseError({ operation: "packs.decode", cause }),
  });

const decodeAssetRow = (row: AssetDbRow): AssetRow => ({
  id: row.id,
  packId: row.pack_id,
  type: row.type,
  status: row.status,
  content: row.content_json,
  fileUrl: row.file_url,
  error: row.error,
  costCents: row.cost_cents,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const decodeAssetVersionRow = (
  row: AssetVersionDbRow,
): Effect.Effect<AssetVersion, SupabaseError> =>
  Effect.try({
    try: () => ({
      id: row.id,
      assetId: row.asset_id,
      version: row.version,
      action: row.action,
      content: row.content,
      fidelityScore: row.fidelity_score,
      diffNotes: Schema.decodeUnknownSync(Schema.Array(Schema.String))(
        row.diff_notes,
      ),
      createdAt: row.created_at,
    }),
    catch: (cause) =>
      new SupabaseError({ operation: "asset_versions.decode", cause }),
  });

const decodeJobRow = (row: JobDbRow): JobRow => ({
  id: row.id,
  packId: row.pack_id,
  assetId: row.asset_id,
  type: row.type,
  status: row.status,
  idempotencyKey: row.idempotency_key,
  attempt: row.attempt,
  error: row.error,
  costCents: row.cost_cents,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Product use-cases depend on this repository boundary, never on Supabase.
 * The small surface is intentional: it makes in-memory test data a real seam.
 */
export type DbService = Readonly<{
  findOwnUser: (
    userId: string,
  ) => Effect.Effect<UserRow, SupabaseError | UserNotFound>;
  loadBrandKit: (
    userId: string,
  ) => Effect.Effect<BrandKitType | null, SupabaseError>;
  saveBrandKit: (
    userId: string,
    input: BrandKitInput,
  ) => Effect.Effect<BrandKitType, SupabaseError>;
  uploadBrandAsset: (
    userId: string,
    kind: BrandAssetKind,
    contentType: BrandAssetContentType,
    contents: Blob,
  ) => Effect.Effect<string, SupabaseError>;
  createBrandAssetReadUrl: (
    path: string,
  ) => Effect.Effect<string, SupabaseError>;
  getUsageCents: (userId: string) => Effect.Effect<number, SupabaseError>;
  createUsageEvent: (input: {
    userId: string;
    packId: string;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    characters: number;
    costCents: number;
  }) => Effect.Effect<void, SupabaseError>;
  findOwnVoiceProfile: (
    userId: string,
  ) => Effect.Effect<VoiceProfileRow | null, SupabaseError>;
  saveVoiceProfile: (input: {
    userId: string;
    profile: VoiceProfile;
    interview: VoiceInterview;
  }) => Effect.Effect<VoiceProfileRow, SupabaseError>;
  findOwnStrategy: (
    userId: string,
  ) => Effect.Effect<StrategyRow | null, SupabaseError>;
  saveStrategy: (
    userId: string,
    strategy: Strategy,
  ) => Effect.Effect<StrategyRow, SupabaseError>;
  createPack: (input: {
    userId: string;
    idea: string;
    pillar: string;
    goal: "reach" | "leads";
    idempotencyKey: string;
  }) => Effect.Effect<PackRow, SupabaseError>;
  findOwnPack: (
    userId: string,
    packId: string,
  ) => Effect.Effect<PackRow | null, SupabaseError>;
  findOwnPackByIdempotencyKey: (
    userId: string,
    idempotencyKey: string,
  ) => Effect.Effect<PackRow | null, SupabaseError>;
  listOwnPacks: (
    userId: string,
  ) => Effect.Effect<ReadonlyArray<PackRow>, SupabaseError>;
  saveGeneratedPack: (input: {
    packId: string;
    text: PackText;
    costCents: number;
  }) => Effect.Effect<PackRow, SupabaseError>;
  updatePackStatus: (
    packId: string,
    status: PackStatus,
  ) => Effect.Effect<PackRow, SupabaseError>;
  updatePackCost: (input: {
    packId: string;
    costCents: number;
  }) => Effect.Effect<PackRow, SupabaseError>;
  upsertAsset: (input: {
    packId: string;
    type: AssetType;
    status: AssetStatus;
    content: unknown | null;
    fileUrl?: string | null;
    error?: string | null;
    costCents?: number;
  }) => Effect.Effect<AssetRow, SupabaseError>;
  updateAssetContent: (input: {
    assetId: string;
    content: unknown | null;
  }) => Effect.Effect<AssetRow, SupabaseError>;
  listPackAssets: (
    packId: string,
  ) => Effect.Effect<ReadonlyArray<AssetRow>, SupabaseError>;
  createAssetVersion: (input: {
    assetId: string;
    action: "generic" | VoicePassAction;
    content: string;
    fidelityScore: number | null;
    diffNotes: ReadonlyArray<string>;
  }) => Effect.Effect<AssetVersion, SupabaseError>;
  listAssetVersions: (
    assetId: string,
  ) => Effect.Effect<ReadonlyArray<AssetVersion>, SupabaseError>;
  updateAssetStatus: (input: {
    assetId: string;
    status: AssetStatus;
    error?: string | null;
    fileUrl?: string | null;
    costCents?: number;
  }) => Effect.Effect<AssetRow, SupabaseError>;
  enqueueJob: (input: {
    packId: string;
    assetId: string | null;
    type: JobRow["type"];
    idempotencyKey: string;
    attempt?: number;
  }) => Effect.Effect<JobRow, SupabaseError>;
  listPackJobs: (
    packId: string,
  ) => Effect.Effect<ReadonlyArray<JobRow>, SupabaseError>;
  updateJobStatus: (input: {
    jobId: string;
    status: JobStatus;
    error?: string | null;
    costCents?: number;
  }) => Effect.Effect<JobRow, SupabaseError>;
  claimQueuedJob: (
    jobId: string,
  ) => Effect.Effect<JobRow | null, SupabaseError>;
  retryAsset: (
    userId: string,
    assetId: string,
  ) => Effect.Effect<AssetRow, SupabaseError>;
}>;

export class Db extends Context.Tag("founder-voice/Db")<Db, DbService>() {}

const decodeBrandKit = (
  operation: string,
  row: BrandKitRow,
): Effect.Effect<BrandKitType, SupabaseError> =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(BrandKit)(row),
    catch: (cause) => new SupabaseError({ operation, cause }),
  });

const decodeStrategyRow = (
  row: StrategyDbRow,
  calendarRows: ReadonlyArray<CalendarItemDbRow>,
): Effect.Effect<StrategyRow, SupabaseError> =>
  Effect.try({
    try: () => {
      const stored = Schema.decodeUnknownSync(StrategySchema)(
        row.strategy_json,
      );
      const calendar: ReadonlyArray<CalendarItem> = [...calendarRows]
        .sort((left, right) =>
          left.scheduled_for.localeCompare(right.scheduled_for),
        )
        .map((item) => ({
          date: item.scheduled_for,
          pillarId: item.pillar_id,
          format: item.format,
          hook: item.hook,
          funnelStage: item.funnel_stage,
        }));
      const strategy = Schema.decodeUnknownSync(StrategySchema)({
        ...stored,
        calendar,
      });
      const issue = strategyValidationIssue(strategy);
      if (issue !== null) throw new Error(issue);
      return {
        id: row.id,
        user_id: row.user_id,
        strategy,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    },
    catch: (cause) =>
      new SupabaseError({ operation: "strategies.decode", cause }),
  });

const makeAssetPath = (
  userId: string,
  kind: BrandAssetKind,
  contentType: BrandAssetContentType,
) =>
  `${userId}/${kind}/${crypto.randomUUID()}.${BRAND_ASSET_CONTENT_TYPES[contentType]}`;

const toSupabaseError = (operation: string) => (cause: unknown) =>
  new SupabaseError({ operation, cause });

const jobTypeForAsset = (type: AssetType): JobRow["type"] | null => {
  switch (type) {
    case "carousel":
      return "render-carousel";
    case "video":
      return "render-video";
    case "magnet":
      return "render-magnet";
    default:
      return null;
  }
};

const validateOwnedAssetPaths = (
  userId: string,
  input: BrandKitInput,
): Effect.Effect<void, SupabaseError> => {
  const pathIsOwned = (path: string | null, kind: BrandAssetKind) =>
    path === null || path.startsWith(`${userId}/${kind}/`);

  return pathIsOwned(input.headshot_path, "headshot") &&
    pathIsOwned(input.logo_path, "logo")
    ? Effect.void
    : Effect.fail(
        new SupabaseError({
          operation: "brand_kits.validate-asset-paths",
          cause: new Error("Brand assets must belong to the current user."),
        }),
      );
};

export const DbLive = Layer.effect(
  Db,
  Effect.gen(function* () {
    const supabase = yield* Supabase;

    return {
      findOwnUser: (userId: string) =>
        supabase
          .query("users.select-own", (client) =>
            client.from("users").select().eq("id", userId).maybeSingle(),
          )
          .pipe(
            Effect.flatMap((user) =>
              user === null
                ? Effect.fail(new UserNotFound({ userId }))
                : Effect.succeed(user),
            ),
          ),
      loadBrandKit: (userId) =>
        supabase
          .query<BrandKitRow | null>("brand_kits.select-own", (client) =>
            client
              .from("brand_kits")
              .select()
              .eq("user_id", userId)
              .maybeSingle(),
          )
          .pipe(
            Effect.flatMap((row) =>
              row === null
                ? Effect.succeed(null)
                : decodeBrandKit("brand_kits.decode", row),
            ),
          ),
      saveBrandKit: (userId, input) =>
        Effect.gen(function* () {
          yield* validateOwnedAssetPaths(userId, input);
          const row = yield* supabase.query<BrandKitRow>(
            "brand_kits.upsert-own",
            (client) =>
              client
                .from("brand_kits")
                .upsert(
                  {
                    user_id: userId,
                    display_name: input.display_name,
                    handle: input.handle,
                    headshot_path: input.headshot_path,
                    logo_path: input.logo_path,
                    primary_color: input.primary_color,
                    secondary_color: input.secondary_color,
                    font: input.font,
                  },
                  { onConflict: "user_id" },
                )
                .select()
                .single(),
          );
          return yield* decodeBrandKit("brand_kits.decode", row);
        }),
      uploadBrandAsset: (userId, kind, contentType, contents) => {
        const path = makeAssetPath(userId, kind, contentType);
        return Effect.tryPromise({
          try: async () => {
            const { error } = await supabase.client.storage
              .from(BRAND_ASSET_BUCKET)
              .upload(path, contents, { contentType, upsert: false });
            if (error !== null) {
              throw error;
            }
            return path;
          },
          catch: toSupabaseError("brand_assets.upload"),
        });
      },
      createBrandAssetReadUrl: (path) =>
        Effect.tryPromise({
          try: async () => {
            const { data, error } = await supabase.client.storage
              .from(BRAND_ASSET_BUCKET)
              .createSignedUrl(path, 60 * 60);
            if (error !== null || data === null) {
              throw error ?? new Error("Supabase did not create a read URL.");
            }
            return data.signedUrl;
          },
          catch: toSupabaseError("brand_assets.create-signed-read"),
        }),
      getUsageCents: (userId) =>
        supabase
          .query<
            ReadonlyArray<{ cost_cents: number }>
          >("usage_events.select-own", (client) => client.from("usage_events").select("cost_cents").eq("user_id", userId))
          .pipe(
            Effect.map((events) =>
              events.reduce((total, event) => total + event.cost_cents, 0),
            ),
          ),
      createUsageEvent: (input) =>
        supabase
          .query(
            "usage_events.insert",
            (client) =>
              client
                .from("usage_events")
                .insert({
                  user_id: input.userId,
                  pack_id: input.packId,
                  operation: input.operation,
                  input_tokens: input.inputTokens,
                  output_tokens: input.outputTokens,
                  characters: input.characters,
                  cost_cents: input.costCents,
                })
                .select("id")
                .single() as unknown as PromiseLike<{
                data: { id: string } | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.asVoid),
      findOwnVoiceProfile: (userId: string) =>
        supabase
          .query<VoiceProfileDbRow | null>(
            "voice_profiles.select-own",
            (client) =>
              client
                .from("voice_profiles")
                .select()
                .eq("user_id", userId)
                .maybeSingle() as unknown as PromiseLike<{
                data: VoiceProfileDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(
            Effect.flatMap((profile) =>
              profile === null
                ? Effect.succeed(null)
                : decodeVoiceProfileRow(profile),
            ),
          ),
      saveVoiceProfile: ({ userId, profile, interview }) =>
        supabase
          .query<VoiceProfileDbRow>(
            "voice_profiles.upsert",
            (client) =>
              client
                .from("voice_profiles")
                .upsert({
                  user_id: userId,
                  profile_json: Schema.encodeSync(VoiceProfileSchema)(
                    profile,
                  ) as unknown as Json,
                  interview_json: Schema.encodeSync(VoiceInterviewSchema)(
                    interview,
                  ) as unknown as Json,
                })
                .select()
                .single() as unknown as PromiseLike<{
                data: VoiceProfileDbRow;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.flatMap(decodeVoiceProfileRow)),
      findOwnStrategy: (userId) =>
        Effect.gen(function* () {
          const strategy = yield* supabase.query<StrategyDbRow | null>(
            "strategies.select-own",
            (client) =>
              client
                .from("strategies")
                .select()
                .eq("user_id", userId)
                .maybeSingle() as unknown as PromiseLike<{
                data: StrategyDbRow | null;
                error: unknown | null;
              }>,
          );
          if (strategy === null) return null;
          const calendar = yield* supabase.query<
            ReadonlyArray<CalendarItemDbRow>
          >(
            "calendar_items.select-own",
            (client) =>
              client
                .from("calendar_items")
                .select()
                .eq("strategy_id", strategy.id)
                .order("scheduled_for", {
                  ascending: true,
                }) as unknown as PromiseLike<{
                data: ReadonlyArray<CalendarItemDbRow> | null;
                error: unknown | null;
              }>,
          );
          return yield* decodeStrategyRow(strategy, calendar);
        }),
      saveStrategy: (userId, strategy) =>
        Effect.gen(function* () {
          const issue = strategyValidationIssue(strategy);
          if (issue !== null) {
            return yield* Effect.fail(
              new SupabaseError({
                operation: "strategies.validate",
                cause: new Error(issue),
              }),
            );
          }
          const encodedStrategy = Schema.encodeSync(StrategySchema)(
            strategy,
          ) as unknown as Json;
          const encodedCalendar = (
            encodedStrategy as unknown as { calendar: Json }
          ).calendar;
          const row = yield* supabase.query<StrategyDbRow>(
            "strategies.replace-own",
            (client) =>
              client
                .rpc("save_strategy_with_calendar", {
                  p_user_id: userId,
                  p_strategy_json: encodedStrategy,
                  p_calendar_json: encodedCalendar,
                })
                .select()
                .single() as unknown as PromiseLike<{
                data: StrategyDbRow;
                error: unknown | null;
              }>,
          );
          const calendar = yield* supabase.query<
            ReadonlyArray<CalendarItemDbRow>
          >(
            "calendar_items.select-after-replace",
            (client) =>
              client
                .from("calendar_items")
                .select()
                .eq("strategy_id", row.id)
                .order("scheduled_for", {
                  ascending: true,
                }) as unknown as PromiseLike<{
                data: ReadonlyArray<CalendarItemDbRow> | null;
                error: unknown | null;
              }>,
          );
          return yield* decodeStrategyRow(row, calendar);
        }),
      createPack: (input) =>
        supabase
          .query<PackDbRow>(
            "packs.insert",
            (client) =>
              client
                .from("packs")
                .insert({
                  user_id: input.userId,
                  idea: input.idea,
                  pillar: input.pillar,
                  goal: input.goal,
                  idempotency_key: input.idempotencyKey,
                })
                .select()
                .single() as unknown as PromiseLike<{
                data: PackDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.flatMap(decodePackRow)),
      findOwnPack: (userId, packId) =>
        supabase
          .query<PackDbRow | null>(
            "packs.select-own",
            (client) =>
              client
                .from("packs")
                .select()
                .eq("id", packId)
                .eq("user_id", userId)
                .maybeSingle() as unknown as PromiseLike<{
                data: PackDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(
            Effect.flatMap((row) =>
              row === null ? Effect.succeed(null) : decodePackRow(row),
            ),
          ),
      findOwnPackByIdempotencyKey: (userId, idempotencyKey) =>
        supabase
          .query<PackDbRow | null>(
            "packs.select-idempotency",
            (client) =>
              client
                .from("packs")
                .select()
                .eq("user_id", userId)
                .eq("idempotency_key", idempotencyKey)
                .maybeSingle() as unknown as PromiseLike<{
                data: PackDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(
            Effect.flatMap((row) =>
              row === null ? Effect.succeed(null) : decodePackRow(row),
            ),
          ),
      listOwnPacks: (userId) =>
        supabase
          .query<ReadonlyArray<PackDbRow>>(
            "packs.list-own",
            (client) =>
              client
                .from("packs")
                .select()
                .eq("user_id", userId)
                .order("updated_at", {
                  ascending: false,
                }) as unknown as PromiseLike<{
                data: ReadonlyArray<PackDbRow> | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.flatMap((rows) => Effect.all(rows.map(decodePackRow)))),
      saveGeneratedPack: ({ packId, text, costCents }) =>
        supabase
          .query<PackDbRow>(
            "packs.save-generated",
            (client) =>
              client
                .from("packs")
                .update({
                  content_json: Schema.encodeSync(PackTextSchema)(
                    text,
                  ) as unknown as Json,
                  cost_cents: costCents,
                  status: "ready",
                })
                .eq("id", packId)
                .select()
                .single() as unknown as PromiseLike<{
                data: PackDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.flatMap(decodePackRow)),
      updatePackStatus: (packId, status) =>
        supabase
          .query<PackDbRow>(
            "packs.update-status",
            (client) =>
              client
                .from("packs")
                .update({ status })
                .eq("id", packId)
                .select()
                .single() as unknown as PromiseLike<{
                data: PackDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.flatMap(decodePackRow)),
      updatePackCost: ({ packId, costCents }) =>
        supabase
          .query<PackDbRow>(
            "packs.update-cost",
            (client) =>
              client
                .from("packs")
                .update({ cost_cents: costCents })
                .eq("id", packId)
                .select()
                .single() as unknown as PromiseLike<{
                data: PackDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.flatMap(decodePackRow)),
      upsertAsset: (input) =>
        supabase
          .query<AssetDbRow>(
            "assets.upsert",
            (client) =>
              client
                .from("assets")
                .upsert(
                  {
                    pack_id: input.packId,
                    type: input.type,
                    status: input.status,
                    content_json: input.content as Json | null,
                    file_url: input.fileUrl ?? null,
                    error: input.error ?? null,
                    cost_cents: input.costCents ?? 0,
                  },
                  { onConflict: "pack_id,type" },
                )
                .select()
                .single() as unknown as PromiseLike<{
                data: AssetDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.map(decodeAssetRow)),
      updateAssetContent: ({ assetId, content }) =>
        supabase
          .query<AssetDbRow>(
            "assets.update-content",
            (client) =>
              client
                .from("assets")
                .update({ content_json: content as Json | null })
                .eq("id", assetId)
                .select()
                .single() as unknown as PromiseLike<{
                data: AssetDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.map(decodeAssetRow)),
      listPackAssets: (packId) =>
        supabase
          .query<ReadonlyArray<AssetDbRow>>(
            "assets.list-pack",
            (client) =>
              client
                .from("assets")
                .select()
                .eq("pack_id", packId)
                .order("created_at", {
                  ascending: true,
                }) as unknown as PromiseLike<{
                data: ReadonlyArray<AssetDbRow> | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.map((rows) => rows.map(decodeAssetRow))),
      createAssetVersion: (input) =>
        Effect.gen(function* () {
          const latest = yield* supabase.query<ReadonlyArray<AssetVersionDbRow>>(
            "asset_versions.select-latest",
            (client) =>
              client
                .from("asset_versions")
                .select()
                .eq("asset_id", input.assetId)
                .order("version", { ascending: false })
                .limit(1) as unknown as PromiseLike<{
                data: ReadonlyArray<AssetVersionDbRow> | null;
                error: unknown | null;
              }>,
          );
          const version = (latest[0]?.version ?? 0) + 1;
          return yield* supabase
            .query<AssetVersionDbRow>(
              "asset_versions.insert",
              (client) =>
                client
                  .from("asset_versions")
                  .insert({
                    asset_id: input.assetId,
                    version,
                    action: input.action,
                    content: input.content,
                    fidelity_score: input.fidelityScore,
                    diff_notes: input.diffNotes as unknown as Json,
                  })
                  .select()
                  .single() as unknown as PromiseLike<{
                  data: AssetVersionDbRow | null;
                  error: unknown | null;
                }>,
            )
            .pipe(Effect.flatMap(decodeAssetVersionRow));
        }),
      listAssetVersions: (assetId) =>
        supabase
          .query<ReadonlyArray<AssetVersionDbRow>>(
            "asset_versions.list",
            (client) =>
              client
                .from("asset_versions")
                .select()
                .eq("asset_id", assetId)
                .order("version", { ascending: true }) as unknown as PromiseLike<{
                data: ReadonlyArray<AssetVersionDbRow> | null;
                error: unknown | null;
              }>,
          )
          .pipe(
            Effect.flatMap((rows) =>
              Effect.all(rows.map(decodeAssetVersionRow)),
            ),
          ),
      updateAssetStatus: (input) =>
        supabase
          .query<AssetDbRow>(
            "assets.update-status",
            (client) =>
              client
                .from("assets")
                .update({
                  status: input.status,
                  error: input.error,
                  file_url: input.fileUrl,
                  cost_cents: input.costCents,
                })
                .eq("id", input.assetId)
                .select()
                .single() as unknown as PromiseLike<{
                data: AssetDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.map(decodeAssetRow)),
      enqueueJob: (input) =>
        Effect.gen(function* () {
          const existing = yield* supabase.query<JobDbRow | null>(
            "jobs.select-idempotency",
            (client) =>
              client
                .from("jobs")
                .select()
                .eq("idempotency_key", input.idempotencyKey)
                .maybeSingle() as unknown as PromiseLike<{
                data: JobDbRow | null;
                error: unknown | null;
              }>,
          );
          if (existing !== null) return decodeJobRow(existing);
          const created = yield* supabase.query<JobDbRow>(
            "jobs.insert",
            (client) =>
              client
                .from("jobs")
                .insert({
                  pack_id: input.packId,
                  asset_id: input.assetId,
                  type: input.type,
                  idempotency_key: input.idempotencyKey,
                  attempt: input.attempt ?? 0,
                })
                .select()
                .single() as unknown as PromiseLike<{
                data: JobDbRow | null;
                error: unknown | null;
              }>,
          );
          return decodeJobRow(created);
        }),
      listPackJobs: (packId) =>
        supabase
          .query<ReadonlyArray<JobDbRow>>(
            "jobs.list-pack",
            (client) =>
              client
                .from("jobs")
                .select()
                .eq("pack_id", packId)
                .order("created_at", {
                  ascending: true,
                }) as unknown as PromiseLike<{
                data: ReadonlyArray<JobDbRow> | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.map((rows) => rows.map(decodeJobRow))),
      updateJobStatus: (input) =>
        supabase
          .query<JobDbRow>(
            "jobs.update-status",
            (client) =>
              client
                .from("jobs")
                .update({
                  status: input.status,
                  error: input.error,
                  cost_cents: input.costCents,
                })
                .eq("id", input.jobId)
                .select()
                .single() as unknown as PromiseLike<{
                data: JobDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.map(decodeJobRow)),
      claimQueuedJob: (jobId) =>
        supabase
          .query<JobDbRow | null>(
            "jobs.claim-queued",
            (client) =>
              client
                .from("jobs")
                .update({ status: "running" })
                .eq("id", jobId)
                .eq("status", "queued")
                .select()
                .maybeSingle() as unknown as PromiseLike<{
                data: JobDbRow | null;
                error: unknown | null;
              }>,
          )
          .pipe(Effect.map((job) => (job === null ? null : decodeJobRow(job)))),
      retryAsset: (userId, assetId) =>
        Effect.gen(function* () {
          const asset = yield* supabase.query<AssetDbRow | null>(
            "assets.select-for-retry",
            (client) =>
              client
                .from("assets")
                .select()
                .eq("id", assetId)
                .maybeSingle() as unknown as PromiseLike<{
                data: AssetDbRow | null;
                error: unknown | null;
              }>,
          );
          if (asset === null) {
            return yield* Effect.fail(
              new SupabaseError({
                operation: "assets.retry",
                cause: new Error("Asset was not found."),
              }),
            );
          }
          const pack = yield* supabase.query<PackDbRow | null>(
            "packs.select-for-asset-retry",
            (client) =>
              client
                .from("packs")
                .select()
                .eq("id", asset.pack_id)
                .eq("user_id", userId)
                .maybeSingle() as unknown as PromiseLike<{
                data: PackDbRow | null;
                error: unknown | null;
              }>,
          );
          if (pack === null || asset.status !== "failed") {
            return yield* Effect.fail(
              new SupabaseError({
                operation: "assets.retry",
                cause: new Error("Only a failed asset in your pack can retry."),
              }),
            );
          }
          const type = jobTypeForAsset(asset.type);
          if (type === null) {
            return yield* Effect.fail(
              new SupabaseError({
                operation: "assets.retry",
                cause: new Error(
                  "This text asset does not have a renderer job.",
                ),
              }),
            );
          }
          const retried = yield* supabase.query<AssetDbRow>(
            "assets.retry-update",
            (client) =>
              client
                .from("assets")
                .update({ status: "queued", error: null })
                .eq("id", assetId)
                .select()
                .single() as unknown as PromiseLike<{
                data: AssetDbRow | null;
                error: unknown | null;
              }>,
          );
          yield* supabase.query<JobDbRow>(
            "jobs.retry-insert",
            (client) =>
              client
                .from("jobs")
                .insert({
                  pack_id: asset.pack_id,
                  asset_id: asset.id,
                  type,
                  idempotency_key: `${asset.id}:${type}:${asset.updated_at}`,
                  attempt: 1,
                })
                .select()
                .single() as unknown as PromiseLike<{
                data: JobDbRow | null;
                error: unknown | null;
              }>,
          );
          return decodeAssetRow(retried);
        }),
    } satisfies DbService;
  }),
);

export const findOwnUser = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.findOwnUser(userId);
  });

export const loadBrandKit = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.loadBrandKit(userId);
  });

export const saveBrandKit = (userId: string, input: BrandKitInput) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.saveBrandKit(userId, input);
  });

export const uploadBrandAsset = (
  userId: string,
  kind: BrandAssetKind,
  contentType: BrandAssetContentType,
  contents: Blob,
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.uploadBrandAsset(userId, kind, contentType, contents);
  });

export const createBrandAssetReadUrl = (path: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.createBrandAssetReadUrl(path);
  });

export const getUsageCents = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.getUsageCents(userId);
  });

export const createPack = (input: {
  userId: string;
  idea: string;
  pillar: string;
  goal: "reach" | "leads";
  idempotencyKey: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.createPack(input);
  });

export const findOwnPack = (userId: string, packId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.findOwnPack(userId, packId);
  });

export const findOwnPackByIdempotencyKey = (
  userId: string,
  idempotencyKey: string,
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.findOwnPackByIdempotencyKey(userId, idempotencyKey);
  });

export const listOwnPacks = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.listOwnPacks(userId);
  });

export const updatePackStatus = (packId: string, status: PackStatus) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.updatePackStatus(packId, status);
  });

export const listAssetVersions = (assetId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.listAssetVersions(assetId);
  });

export const listPackAssets = (packId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.listPackAssets(packId);
  });

export const listPackJobs = (packId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.listPackJobs(packId);
  });

export const retryAsset = (userId: string, assetId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.retryAsset(userId, assetId);
  });

export const findOwnVoiceProfile = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.findOwnVoiceProfile(userId);
  });

export const saveVoiceProfile = (input: {
  userId: string;
  profile: VoiceProfile;
  interview: VoiceInterview;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.saveVoiceProfile(input);
  });

export const findOwnStrategy = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.findOwnStrategy(userId);
  });

export const saveStrategy = (userId: string, strategy: Strategy) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.saveStrategy(userId, strategy);
  });

export type InMemoryDb = Readonly<{
  layer: Layer.Layer<Db>;
  rows: () => ReadonlyArray<UserRow>;
  brandKitRows: () => ReadonlyArray<BrandKitType>;
  voiceProfileRows: () => ReadonlyArray<VoiceProfileRow>;
  strategyRows: () => ReadonlyArray<StrategyRow>;
  packRows: () => ReadonlyArray<PackRow>;
  assetRows: () => ReadonlyArray<AssetRow>;
  assetVersionRows: () => ReadonlyArray<AssetVersion>;
  jobRows: () => ReadonlyArray<JobRow>;
  usageRows: () => ReadonlyArray<{
    userId: string;
    packId: string;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    characters: number;
    costCents: number;
  }>;
}>;

/** A deterministic in-memory repository for the single application test seam. */
export const makeInMemoryDb = (
  seed: ReadonlyArray<UserRow> = [],
  brandKitSeed: ReadonlyArray<BrandKitType> = [],
  voiceProfileSeed: ReadonlyArray<VoiceProfileRow> = [],
  strategySeed: ReadonlyArray<StrategyRow> = [],
): InMemoryDb => {
  const users = new Map(seed.map((user) => [user.id, user]));
  const brandKits = new Map(brandKitSeed.map((kit) => [kit.user_id, kit]));
  const voiceProfiles = new Map(
    voiceProfileSeed.map((profile) => [profile.user_id, profile]),
  );
  const strategies = new Map(
    strategySeed.map((strategy) => [strategy.user_id, strategy]),
  );
  const packs = new Map<string, PackRow>();
  const assets = new Map<string, AssetRow>();
  const assetVersions = new Map<string, AssetVersion>();
  const jobs = new Map<string, JobRow>();
  const usageEvents: Array<{
    userId: string;
    packId: string;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    characters: number;
    costCents: number;
  }> = [];
  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-${++sequence}`;
  const timestamp = () => "2026-08-30T00:00:00.000Z";

  return {
    layer: Layer.succeed(Db, {
      findOwnUser: (userId) => {
        const user = users.get(userId);
        return user
          ? Effect.succeed(user)
          : Effect.fail(new UserNotFound({ userId }));
      },
      loadBrandKit: (userId) => Effect.succeed(brandKits.get(userId) ?? null),
      saveBrandKit: (userId, input) =>
        Effect.gen(function* () {
          yield* validateOwnedAssetPaths(userId, input);
          const previous = brandKits.get(userId);
          const timestamp = new Date().toISOString();
          const brandKit: BrandKitType = {
            user_id: userId,
            ...input,
            created_at: previous?.created_at ?? timestamp,
            updated_at: timestamp,
          };
          brandKits.set(userId, brandKit);
          return brandKit;
        }),
      uploadBrandAsset: (userId, kind, contentType, _contents) =>
        Effect.succeed(makeAssetPath(userId, kind, contentType)),
      createBrandAssetReadUrl: (path) =>
        Effect.succeed(`https://storage.example.test/read/${path}`),
      getUsageCents: (userId) =>
        Effect.succeed(
          usageEvents
            .filter((event) => event.userId === userId)
            .reduce((total, event) => total + event.costCents, 0),
        ),
      createUsageEvent: (input) =>
        Effect.sync(() => {
          usageEvents.push(input);
        }),
      findOwnVoiceProfile: (userId) =>
        Effect.succeed(voiceProfiles.get(userId) ?? null),
      saveVoiceProfile: ({ userId, profile, interview }) =>
        Effect.sync(() => {
          const existing = voiceProfiles.get(userId);
          const now = "2026-08-30T00:00:00.000Z";
          const row: VoiceProfileRow = {
            user_id: userId,
            profile,
            interview,
            created_at: existing?.created_at ?? now,
            updated_at: now,
          };
          voiceProfiles.set(userId, row);
          return row;
        }),
      findOwnStrategy: (userId) =>
        Effect.succeed(strategies.get(userId) ?? null),
      saveStrategy: (userId, strategy) =>
        Effect.gen(function* () {
          const issue = strategyValidationIssue(strategy);
          if (issue !== null) {
            return yield* Effect.fail(
              new SupabaseError({
                operation: "strategies.validate",
                cause: new Error(issue),
              }),
            );
          }
          const existing = strategies.get(userId);
          const now = "2026-08-30T00:00:00.000Z";
          const row: StrategyRow = {
            id: existing?.id ?? `strategy-${userId}`,
            user_id: userId,
            strategy,
            created_at: existing?.created_at ?? now,
            updated_at: now,
          };
          strategies.set(userId, row);
          return row;
        }),
      createPack: (input) =>
        Effect.sync(() => {
          const existing = [...packs.values()].find(
            (pack) =>
              pack.userId === input.userId &&
              pack.idempotencyKey === input.idempotencyKey,
          );
          if (existing) return existing;
          const now = timestamp();
          const pack: PackRow = {
            id: nextId("pack"),
            userId: input.userId,
            idea: input.idea,
            pillar: input.pillar,
            goal: input.goal,
            status: "draft",
            idempotencyKey: input.idempotencyKey,
            text: null,
            costCents: 0,
            createdAt: now,
            updatedAt: now,
          };
          packs.set(pack.id, pack);
          return pack;
        }),
      findOwnPack: (userId, packId) =>
        Effect.succeed(
          (() => {
            const pack = packs.get(packId);
            return pack?.userId === userId ? pack : null;
          })(),
        ),
      findOwnPackByIdempotencyKey: (userId, idempotencyKey) =>
        Effect.succeed(
          [...packs.values()].find(
            (pack) =>
              pack.userId === userId && pack.idempotencyKey === idempotencyKey,
          ) ?? null,
        ),
      listOwnPacks: (userId) =>
        Effect.succeed(
          [...packs.values()]
            .filter((pack) => pack.userId === userId)
            .sort((left, right) =>
              right.updatedAt.localeCompare(left.updatedAt),
            ),
        ),
      saveGeneratedPack: ({ packId, text, costCents }) =>
        Effect.sync(() => {
          const pack = packs.get(packId);
          if (!pack) {
            throw new Error(`No pack ${packId} exists.`);
          }
          const saved: PackRow = {
            ...pack,
            text,
            costCents,
            status: "ready",
            updatedAt: timestamp(),
          };
          packs.set(packId, saved);
          return saved;
        }),
      updatePackStatus: (packId, status) =>
        Effect.sync(() => {
          const pack = packs.get(packId);
          if (!pack) throw new Error(`No pack ${packId} exists.`);
          const saved: PackRow = { ...pack, status, updatedAt: timestamp() };
          packs.set(packId, saved);
          return saved;
        }),
      updatePackCost: ({ packId, costCents }) =>
        Effect.sync(() => {
          const pack = packs.get(packId);
          if (!pack) throw new Error(`No pack ${packId} exists.`);
          const saved: PackRow = {
            ...pack,
            costCents,
            updatedAt: timestamp(),
          };
          packs.set(packId, saved);
          return saved;
        }),
      upsertAsset: (input) =>
        Effect.sync(() => {
          const existing = [...assets.values()].find(
            (asset) =>
              asset.packId === input.packId && asset.type === input.type,
          );
          const now = timestamp();
          const saved: AssetRow = {
            id: existing?.id ?? nextId("asset"),
            packId: input.packId,
            type: input.type,
            status: input.status,
            content: input.content,
            fileUrl: input.fileUrl ?? null,
            error: input.error ?? null,
            costCents: input.costCents ?? 0,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };
          assets.set(saved.id, saved);
          return saved;
        }),
      updateAssetContent: ({ assetId, content }) =>
        Effect.sync(() => {
          const asset = assets.get(assetId);
          if (!asset) throw new Error(`No asset ${assetId} exists.`);
          const saved: AssetRow = {
            ...asset,
            content,
            updatedAt: timestamp(),
          };
          assets.set(assetId, saved);
          return saved;
        }),
      listPackAssets: (packId) =>
        Effect.succeed(
          [...assets.values()].filter((asset) => asset.packId === packId),
        ),
      createAssetVersion: (input) =>
        Effect.sync(() => {
          const versions = [...assetVersions.values()].filter(
            (version) => version.assetId === input.assetId,
          );
          const saved: AssetVersion = {
            id: nextId("asset-version"),
            assetId: input.assetId,
            version: (versions.at(-1)?.version ?? 0) + 1,
            action: input.action,
            content: input.content,
            fidelityScore: input.fidelityScore,
            diffNotes: [...input.diffNotes],
            createdAt: timestamp(),
          };
          assetVersions.set(saved.id, saved);
          return saved;
        }),
      listAssetVersions: (assetId) =>
        Effect.succeed(
          [...assetVersions.values()]
            .filter((version) => version.assetId === assetId)
            .sort((left, right) => left.version - right.version),
        ),
      updateAssetStatus: (input) =>
        Effect.sync(() => {
          const asset = assets.get(input.assetId);
          if (!asset) throw new Error(`No asset ${input.assetId} exists.`);
          const saved: AssetRow = {
            ...asset,
            status: input.status,
            error: input.error ?? asset.error,
            fileUrl: input.fileUrl ?? asset.fileUrl,
            costCents: input.costCents ?? asset.costCents,
            updatedAt: timestamp(),
          };
          assets.set(saved.id, saved);
          return saved;
        }),
      enqueueJob: (input) =>
        Effect.sync(() => {
          const existing = [...jobs.values()].find(
            (job) => job.idempotencyKey === input.idempotencyKey,
          );
          if (existing) return existing;
          const now = timestamp();
          const job: JobRow = {
            id: nextId("job"),
            packId: input.packId,
            assetId: input.assetId,
            type: input.type,
            status: "queued",
            idempotencyKey: input.idempotencyKey,
            attempt: input.attempt ?? 0,
            error: null,
            costCents: 0,
            createdAt: now,
            updatedAt: now,
          };
          jobs.set(job.id, job);
          return job;
        }),
      listPackJobs: (packId) =>
        Effect.succeed(
          [...jobs.values()].filter((job) => job.packId === packId),
        ),
      updateJobStatus: (input) =>
        Effect.sync(() => {
          const job = jobs.get(input.jobId);
          if (!job) throw new Error(`No job ${input.jobId} exists.`);
          const saved: JobRow = {
            ...job,
            status: input.status,
            error: input.error ?? job.error,
            costCents: input.costCents ?? job.costCents,
            updatedAt: timestamp(),
          };
          jobs.set(saved.id, saved);
          return saved;
        }),
      claimQueuedJob: (jobId) =>
        Effect.sync(() => {
          const job = jobs.get(jobId);
          if (!job || job.status !== "queued") return null;
          const claimed: JobRow = {
            ...job,
            status: "running",
            updatedAt: timestamp(),
          };
          jobs.set(jobId, claimed);
          return claimed;
        }),
      retryAsset: (userId, assetId) =>
        Effect.gen(function* () {
          const asset = assets.get(assetId);
          const pack = asset ? packs.get(asset.packId) : undefined;
          if (
            !asset ||
            !pack ||
            pack.userId !== userId ||
            asset.status !== "failed"
          ) {
            return yield* Effect.fail(
              new SupabaseError({
                operation: "assets.retry",
                cause: new Error("Only a failed asset in your pack can retry."),
              }),
            );
          }
          const type = jobTypeForAsset(asset.type);
          if (!type) {
            return yield* Effect.fail(
              new SupabaseError({
                operation: "assets.retry",
                cause: new Error("This asset cannot retry."),
              }),
            );
          }
          const queued: AssetRow = {
            ...asset,
            status: "queued",
            error: null,
            updatedAt: timestamp(),
          };
          assets.set(assetId, queued);
          const job: JobRow = {
            id: nextId("job"),
            packId: pack.id,
            assetId,
            type,
            status: "queued",
            idempotencyKey: `${assetId}:${type}:retry-${jobs.size + 1}`,
            attempt: 1,
            error: null,
            costCents: 0,
            createdAt: timestamp(),
            updatedAt: timestamp(),
          };
          jobs.set(job.id, job);
          return queued;
        }),
    }),
    rows: () => [...users.values()],
    brandKitRows: () => [...brandKits.values()],
    voiceProfileRows: () => [...voiceProfiles.values()],
    strategyRows: () => [...strategies.values()],
    packRows: () => [...packs.values()],
    assetRows: () => [...assets.values()],
    assetVersionRows: () => [...assetVersions.values()],
    jobRows: () => [...jobs.values()],
    usageRows: () => [...usageEvents],
  };
};
