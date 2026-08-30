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
import { type Database, type Json } from "@/lib/db/database.types";
import { SupabaseError, UserNotFound } from "@/lib/errors";
import { Supabase } from "@/lib/supabase/service";
import {
  type VoiceInterview,
  type VoiceProfile,
  VoiceInterviewSchema,
  VoiceProfileSchema,
} from "@/lib/voice/schema";
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
          const row = yield* supabase.query<StrategyDbRow>(
            "strategies.upsert-own",
            (client) =>
              client
                .from("strategies")
                .upsert(
                  {
                    user_id: userId,
                    strategy_json: Schema.encodeSync(StrategySchema)(
                      strategy,
                    ) as unknown as Json,
                  },
                  { onConflict: "user_id" },
                )
                .select()
                .single() as unknown as PromiseLike<{
                data: StrategyDbRow;
                error: unknown | null;
              }>,
          );
          yield* supabase.query<null>(
            "calendar_items.delete-own",
            (client) =>
              client
                .from("calendar_items")
                .delete()
                .eq("strategy_id", row.id) as unknown as PromiseLike<{
                data: null;
                error: unknown | null;
              }>,
          );
          const calendar = yield* supabase.query<
            ReadonlyArray<CalendarItemDbRow>
          >(
            "calendar_items.insert-own",
            (client) =>
              client
                .from("calendar_items")
                .insert(
                  strategy.calendar.map((item) => ({
                    user_id: userId,
                    strategy_id: row.id,
                    scheduled_for: item.date,
                    pillar_id: item.pillarId,
                    format: item.format,
                    hook: item.hook,
                    funnel_stage: item.funnelStage,
                  })),
                )
                .select() as unknown as PromiseLike<{
                data: ReadonlyArray<CalendarItemDbRow> | null;
                error: unknown | null;
              }>,
          );
          return yield* decodeStrategyRow(row, calendar);
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
      getUsageCents: () => Effect.succeed(0),
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
    }),
    rows: () => [...users.values()],
    brandKitRows: () => [...brandKits.values()],
    voiceProfileRows: () => [...voiceProfiles.values()],
    strategyRows: () => [...strategies.values()],
  };
};
