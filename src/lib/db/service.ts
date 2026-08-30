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
import { type Database } from "@/lib/db/database.types";
import { SupabaseError, UserNotFound } from "@/lib/errors";
import { Supabase } from "@/lib/supabase/service";

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
type BrandKitRow = Database["public"]["Tables"]["brand_kits"]["Row"];

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

export type InMemoryDb = Readonly<{
  layer: Layer.Layer<Db>;
  rows: () => ReadonlyArray<UserRow>;
  brandKitRows: () => ReadonlyArray<BrandKitType>;
}>;

/** A deterministic in-memory repository for the single application test seam. */
export const makeInMemoryDb = (
  seed: ReadonlyArray<UserRow> = [],
  brandKitSeed: ReadonlyArray<BrandKitType> = [],
): InMemoryDb => {
  const users = new Map(seed.map((user) => [user.id, user]));
  const brandKits = new Map(brandKitSeed.map((kit) => [kit.user_id, kit]));

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
    }),
    rows: () => [...users.values()],
    brandKitRows: () => [...brandKits.values()],
  };
};
