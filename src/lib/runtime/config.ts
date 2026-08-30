import { Config, Context, Effect, Layer, Redacted } from "effect";

/**
 * The complete server configuration boundary. Keep provider keys here so every
 * production adapter gets its configuration through Effect Config rather than
 * reaching into process.env itself.
 */
export type AppConfig = Readonly<{
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: Redacted.Redacted<string>;
  openAiApiKey: Redacted.Redacted<string>;
  elevenLabsApiKey: Redacted.Redacted<string>;
  resendApiKey: Redacted.Redacted<string>;
  inngestEventKey: Redacted.Redacted<string>;
  inngestSigningKey: Redacted.Redacted<string>;
  postHogKey: string;
  postHogHost: string;
}>;

export class RuntimeConfig extends Context.Tag("founder-voice/RuntimeConfig")<
  RuntimeConfig,
  AppConfig
>() {}

const config = Config.all({
  appUrl: Config.string("NEXT_PUBLIC_APP_URL"),
  supabaseUrl: Config.string("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: Config.string("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: Config.redacted("SUPABASE_SERVICE_ROLE_KEY"),
  openAiApiKey: Config.redacted("OPENAI_API_KEY"),
  elevenLabsApiKey: Config.redacted("ELEVENLABS_API_KEY"),
  resendApiKey: Config.redacted("RESEND_API_KEY"),
  inngestEventKey: Config.redacted("INNGEST_EVENT_KEY"),
  inngestSigningKey: Config.redacted("INNGEST_SIGNING_KEY"),
  postHogKey: Config.string("NEXT_PUBLIC_POSTHOG_KEY").pipe(
    Config.withDefault(""),
  ),
  postHogHost: Config.string("NEXT_PUBLIC_POSTHOG_HOST").pipe(
    Config.withDefault("https://us.i.posthog.com"),
  ),
});

export const RuntimeConfigLive = Layer.effect(RuntimeConfig, config);

export const readRuntimeConfig = Effect.gen(function* () {
  return yield* RuntimeConfig;
});
