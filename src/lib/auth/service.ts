import { createClient } from "@supabase/supabase-js";
import { Context, Effect, Layer } from "effect";

import { AuthenticationError } from "@/lib/errors";
import { RuntimeConfig } from "@/lib/runtime/config";

export class AuthGateway extends Context.Tag("founder-voice/AuthGateway")<
  AuthGateway,
  Readonly<{
    beginGoogleOAuth: () => Effect.Effect<string, AuthenticationError>;
    sendMagicLink: (email: string) => Effect.Effect<void, AuthenticationError>;
  }>
>() {}

const authFailure = (operation: string, cause: unknown) =>
  new AuthenticationError({
    operation,
    message:
      cause instanceof Error ? cause.message : "Supabase authentication failed",
    cause,
  });

export const AuthGatewayLive = Layer.effect(
  AuthGateway,
  Effect.gen(function* () {
    const config = yield* RuntimeConfig;
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const callback = new URL("/auth/callback", config.appUrl).toString();

    return {
      beginGoogleOAuth: () =>
        Effect.tryPromise({
          try: () =>
            client.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: callback },
            }),
          catch: (cause) => authFailure("google-oauth", cause),
        }).pipe(
          Effect.flatMap(({ data, error }) => {
            if (error) {
              return Effect.fail(authFailure("google-oauth", error));
            }
            return data.url
              ? Effect.succeed(data.url)
              : Effect.fail(
                  new AuthenticationError({
                    operation: "google-oauth",
                    message: "Supabase did not return an OAuth redirect URL",
                  }),
                );
          }),
        ),
      sendMagicLink: (email: string) =>
        Effect.tryPromise({
          try: () =>
            client.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: callback },
            }),
          catch: (cause) => authFailure("magic-link", cause),
        }).pipe(
          Effect.flatMap(({ error }) =>
            error ? Effect.fail(authFailure("magic-link", error)) : Effect.void,
          ),
        ),
    };
  }),
);

export const beginGoogleOAuth = Effect.gen(function* () {
  const auth = yield* AuthGateway;
  return yield* auth.beginGoogleOAuth();
});

export const sendMagicLink = (email: string) =>
  Effect.gen(function* () {
    const auth = yield* AuthGateway;
    return yield* auth.sendMagicLink(email);
  });
