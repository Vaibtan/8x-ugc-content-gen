import { Context, Effect, Layer, Schema } from "effect";

import { type Database, type Json } from "@/lib/db/database.types";
import { SupabaseError, UserNotFound } from "@/lib/errors";
import { Supabase } from "@/lib/supabase/service";
import {
  type VoiceInterview,
  type VoiceProfile,
  VoiceInterviewSchema,
  VoiceProfileSchema,
} from "@/lib/voice/schema";

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
type VoiceProfileDbRow = Database["public"]["Tables"]["voice_profiles"]["Row"];

export type VoiceProfileRow = Readonly<{
  user_id: string;
  profile: VoiceProfile;
  interview: VoiceInterview;
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
  findOwnVoiceProfile: (
    userId: string,
  ) => Effect.Effect<VoiceProfileRow | null, SupabaseError>;
  saveVoiceProfile: (input: {
    userId: string;
    profile: VoiceProfile;
    interview: VoiceInterview;
  }) => Effect.Effect<VoiceProfileRow, SupabaseError>;
}>;

export class Db extends Context.Tag("founder-voice/Db")<Db, DbService>() {}

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
    } satisfies DbService;
  }),
);

export const findOwnUser = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.findOwnUser(userId);
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

export type InMemoryDb = Readonly<{
  layer: Layer.Layer<Db>;
  rows: () => ReadonlyArray<UserRow>;
  voiceProfileRows: () => ReadonlyArray<VoiceProfileRow>;
}>;

/** A deterministic in-memory repository for the single application test seam. */
export const makeInMemoryDb = (
  seed: ReadonlyArray<UserRow> = [],
  voiceProfileSeed: ReadonlyArray<VoiceProfileRow> = [],
): InMemoryDb => {
  const users = new Map(seed.map((user) => [user.id, user]));
  const voiceProfiles = new Map(
    voiceProfileSeed.map((profile) => [profile.user_id, profile]),
  );

  return {
    layer: Layer.succeed(Db, {
      findOwnUser: (userId) => {
        const user = users.get(userId);
        return user
          ? Effect.succeed(user)
          : Effect.fail(new UserNotFound({ userId }));
      },
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
    }),
    rows: () => [...users.values()],
    voiceProfileRows: () => [...voiceProfiles.values()],
  };
};
