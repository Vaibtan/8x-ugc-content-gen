import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Context, Effect, Layer, Redacted } from "effect";

import { SupabaseError } from "@/lib/errors";
import { type Database } from "@/lib/db/database.types";
import { RuntimeConfig } from "@/lib/runtime/config";

type SupabaseResponse<A> = Readonly<{
  data: A | null;
  error: unknown | null;
}>;

export type SupabaseService = Readonly<{
  client: SupabaseClient<Database>;
  query: <A>(
    operation: string,
    run: (client: SupabaseClient<Database>) => PromiseLike<SupabaseResponse<A>>,
  ) => Effect.Effect<A, SupabaseError>;
}>;

/**
 * Database boundary used only by repository adapters. Use `Db` from a use
 * case; this service is deliberately not imported by product code.
 */
export class Supabase extends Context.Tag("founder-voice/Supabase")<
  Supabase,
  SupabaseService
>() {}

const makeService = (client: SupabaseClient<Database>): SupabaseService => ({
  client,
  query: <A>(
    operation: string,
    run: (client: SupabaseClient<Database>) => PromiseLike<SupabaseResponse<A>>,
  ) =>
    Effect.tryPromise({
      try: () => run(client),
      catch: (cause) => new SupabaseError({ operation, cause }),
    }).pipe(
      Effect.flatMap(({ data, error }) =>
        error !== null
          ? Effect.fail(new SupabaseError({ operation, cause: error }))
          : Effect.succeed(data as A),
      ),
    ),
});

const clientOptions = (accessToken?: string) => ({
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: accessToken
    ? { headers: { Authorization: `Bearer ${accessToken}` } }
    : undefined,
});

/** Privileged worker and public-capture client. Service role bypasses RLS. */
export const SupabaseServiceLive = Layer.effect(
  Supabase,
  Effect.gen(function* () {
    const config = yield* RuntimeConfig;
    return makeService(
      createClient<Database>(
        config.supabaseUrl,
        Redacted.value(config.supabaseServiceRoleKey),
        clientOptions(),
      ),
    );
  }),
);

/**
 * Per-request client. Supplying the caller's JWT lets Postgres enforce RLS for
 * every user-initiated repository operation.
 */
export const SupabaseForUser = (accessToken: string) =>
  Layer.effect(
    Supabase,
    Effect.gen(function* () {
      const config = yield* RuntimeConfig;
      return makeService(
        createClient<Database>(
          config.supabaseUrl,
          config.supabaseAnonKey,
          clientOptions(accessToken),
        ),
      );
    }),
  );
