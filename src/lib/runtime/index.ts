import { ConfigError, Effect, Layer, ManagedRuntime } from "effect";

import { AuthGateway, AuthGatewayLive } from "@/lib/auth/service";
import { Db, DbLive } from "@/lib/db/service";
import {
  LLMPort,
  LLMPortLive,
  MailPort,
  MailPortLive,
  PublisherPort,
  PublisherPortLive,
  RendererPort,
  RendererPortLive,
  TTSPort,
  TTSPortLive,
} from "@/lib/ports";
import { RuntimeConfigLive } from "@/lib/runtime/config";
import { SupabaseForUser, SupabaseServiceLive } from "@/lib/supabase/service";

type AppServices =
  | AuthGateway
  | Db
  | LLMPort
  | TTSPort
  | RendererPort
  | MailPort
  | PublisherPort;

const adaptersLive: Layer.Layer<AppServices, ConfigError.ConfigError> =
  Layer.mergeAll(
    AuthGatewayLive,
    DbLive,
    LLMPortLive,
    TTSPortLive,
    RendererPortLive,
    MailPortLive,
    PublisherPortLive,
  ).pipe(Layer.provide(SupabaseServiceLive), Layer.provide(RuntimeConfigLive));

/** The sole application runtime used by server actions, route handlers and jobs. */
export const runtime = ManagedRuntime.make(adaptersLive);

export const runApp = <A, E, R extends AppServices>(
  effect: Effect.Effect<A, E, R>,
) => runtime.runPromise(effect);

const userDbLayer = (accessToken: string) =>
  DbLive.pipe(
    Layer.provide(SupabaseForUser(accessToken)),
    Layer.provide(RuntimeConfigLive),
  );

/**
 * Run an RLS-protected user repository program through the same application
 * runtime. The request's JWT is scoped to this effect, never to the global
 * service-role Db layer.
 */
export const runForUser = <A, E, R extends AppServices>(
  accessToken: string,
  effect: Effect.Effect<A, E, R>,
) => runtime.runPromise(effect.pipe(Effect.provide(userDbLayer(accessToken))));

/** Resolving these services builds the Config layer and fails clearly on a missing variable. */
export const verifyRuntimeConfiguration = Effect.gen(function* () {
  yield* Db;
});
