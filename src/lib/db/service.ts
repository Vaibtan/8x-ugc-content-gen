import { Context, Effect, Layer } from "effect";

import { type Database } from "@/lib/db/database.types";
import { SupabaseError, UserNotFound } from "@/lib/errors";
import { Supabase } from "@/lib/supabase/service";

export type UserRow = Database["public"]["Tables"]["users"]["Row"];

/**
 * Product use-cases depend on this repository boundary, never on Supabase.
 * The small surface is intentional: it makes in-memory test data a real seam.
 */
export type DbService = Readonly<{
  findOwnUser: (
    userId: string,
  ) => Effect.Effect<UserRow, SupabaseError | UserNotFound>;
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
    } satisfies DbService;
  }),
);

export const findOwnUser = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.findOwnUser(userId);
  });

export type InMemoryDb = Readonly<{
  layer: Layer.Layer<Db>;
  rows: () => ReadonlyArray<UserRow>;
}>;

/** A deterministic in-memory repository for the single application test seam. */
export const makeInMemoryDb = (
  seed: ReadonlyArray<UserRow> = [],
): InMemoryDb => {
  const users = new Map(seed.map((user) => [user.id, user]));

  return {
    layer: Layer.succeed(Db, {
      findOwnUser: (userId) => {
        const user = users.get(userId);
        return user
          ? Effect.succeed(user)
          : Effect.fail(new UserNotFound({ userId }));
      },
    }),
    rows: () => [...users.values()],
  };
};
