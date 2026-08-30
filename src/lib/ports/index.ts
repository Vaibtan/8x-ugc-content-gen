import { LanguageModel } from "@effect/ai";
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import { FetchHttpClient } from "@effect/platform";
import { Context, Effect, Layer, Schedule } from "effect";

import {
  GenerationFailed,
  ModerationBlocked,
  NotImplemented,
  QuotaExceeded,
  RateLimited,
  TranscriptionFailed,
} from "@/lib/errors";
import {
  type PackText,
  PackTextSchema,
  makePackTextFixture,
} from "@/lib/content-pack/schema";
import { RuntimeConfig } from "@/lib/runtime/config";
import {
  type VoiceProfile,
  VoiceProfileSchema,
  makeVoiceProfileFixture,
} from "@/lib/voice/schema";

export type VoiceProfileGenerationRequest = Readonly<{
  transcript: string;
  pastPosts: ReadonlyArray<string>;
}>;

export type ContentPackGenerationRequest = Readonly<{
  idea: string;
  pillar: string;
  goal: "reach" | "leads";
  voiceProfile: VoiceProfile;
  hookPatterns: ReadonlyArray<string>;
}>;

export type AudioInput = Readonly<{
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}>;

export type LLMPortFailure =
  | GenerationFailed
  | ModerationBlocked
  | QuotaExceeded
  | RateLimited
  | TranscriptionFailed;

/**
 * All generative work is isolated behind this port. `VoiceProfileSchema` is
 * passed directly to `LanguageModel.generateObject`, which the OpenAI adapter
 * sends as a strict JSON-schema response format.
 */
export class LLMPort extends Context.Tag("founder-voice/LLMPort")<
  LLMPort,
  Readonly<{
    generateVoiceProfile: (
      request: VoiceProfileGenerationRequest,
    ) => Effect.Effect<VoiceProfile, LLMPortFailure>;
    generateContentPack: (
      request: ContentPackGenerationRequest,
    ) => Effect.Effect<PackText, LLMPortFailure>;
    transcribe: (audio: AudioInput) => Effect.Effect<string, LLMPortFailure>;
  }>
>() {}

export class TTSPort extends Context.Tag("founder-voice/TTSPort")<
  TTSPort,
  Readonly<{
    synthesize: (input: {
      text: string;
      voiceId: string;
    }) => Effect.Effect<Uint8Array, NotImplemented>;
  }>
>() {}

export class RendererPort extends Context.Tag("founder-voice/RendererPort")<
  RendererPort,
  Readonly<{
    render: (input: {
      kind: "carousel" | "magnet" | "video";
      source: unknown;
    }) => Effect.Effect<string, NotImplemented>;
  }>
>() {}

export class MailPort extends Context.Tag("founder-voice/MailPort")<
  MailPort,
  Readonly<{
    send: (input: {
      to: string;
      subject: string;
      html: string;
    }) => Effect.Effect<void, NotImplemented>;
  }>
>() {}

export class PublisherPort extends Context.Tag("founder-voice/PublisherPort")<
  PublisherPort,
  Readonly<{
    publish: () => Effect.Effect<never, NotImplemented>;
  }>
>() {}

const notImplemented = <A>(capability: string) =>
  Effect.fail(new NotImplemented({ capability })) as Effect.Effect<
    A,
    NotImplemented
  >;

const providerMessage = (cause: unknown) => {
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
};

const classifyProviderError = (
  operation: string,
  cause: unknown,
  fallback: "generation" | "transcription",
): LLMPortFailure => {
  const message = providerMessage(cause);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("insufficient_quota") ||
    normalized.includes("quota")
  ) {
    return new QuotaExceeded({ operation, message });
  }
  if (
    normalized.includes("content_policy") ||
    normalized.includes("moderation")
  ) {
    return new ModerationBlocked({ operation, message });
  }
  if (normalized.includes("429") || normalized.includes("rate limit")) {
    return new RateLimited({ operation, retryAfterSeconds: null });
  }
  return fallback === "transcription"
    ? new TranscriptionFailed({ message, cause })
    : new GenerationFailed({ message, cause });
};

const retryableSchedule = Schedule.exponential("250 millis").pipe(
  Schedule.intersect(Schedule.recurs(2)),
);

const isRetryableProviderFailure = (error: LLMPortFailure) =>
  error._tag === "RateLimited" ||
  error._tag === "GenerationFailed" ||
  error._tag === "TranscriptionFailed";

/** Three total attempts: initial call plus two exponential-backoff retries. */
export const withProviderPolicy = <A>(
  effect: Effect.Effect<A, LLMPortFailure>,
  timeoutError: () => GenerationFailed | TranscriptionFailed,
) =>
  effect.pipe(
    Effect.timeoutFail({ duration: "30 seconds", onTimeout: timeoutError }),
    Effect.retry({
      schedule: retryableSchedule,
      while: isRetryableProviderFailure,
    }),
  );

const profilePrompt = ({
  transcript,
  pastPosts,
}: VoiceProfileGenerationRequest) =>
  [
    "Create a voice profile for a B2B founder from the interview transcript and optional past posts.",
    "Preserve their real language; do not invent claims or cite source text verbatim unless it is already present.",
    "Interview transcript:",
    transcript,
    "Past posts:",
    pastPosts.length > 0 ? pastPosts.join("\n\n---\n\n") : "None provided.",
  ].join("\n\n");

const contentPackPrompt = ({
  idea,
  pillar,
  goal,
  voiceProfile,
  hookPatterns,
}: ContentPackGenerationRequest) =>
  [
    "Create a complete B2B founder content pack as strict JSON.",
    `Goal: ${goal}. Pillar: ${pillar}.`,
    "The LinkedIn post variants must use short paragraphs (at most three lines each), put the hook in their first 210 characters, never include a URL, and end with a save or comment CTA using the returned comment keyword.",
    "The video script must be 150 words or fewer. The newsletter body must be 120 to 180 words.",
    "Founder idea:",
    idea,
    "Voice profile:",
    JSON.stringify(voiceProfile),
    "Use these hook patterns as inspiration, never as unverifiable claims:",
    hookPatterns.join("\n"),
  ].join("\n\n");

const languageModelLayer = (
  apiKey: Parameters<typeof OpenAiClient.layer>[0]["apiKey"],
) =>
  OpenAiLanguageModel.layer({ model: "gpt-5.6-luna" }).pipe(
    Layer.provide(OpenAiClient.layer({ apiKey })),
    Layer.provide(FetchHttpClient.layer),
  );

const openAiClientLayer = (
  apiKey: Parameters<typeof OpenAiClient.layer>[0]["apiKey"],
) => OpenAiClient.layer({ apiKey }).pipe(Layer.provide(FetchHttpClient.layer));

/** OpenAI Responses for strict JSON and gpt-4o-mini-transcribe for audio. */
export const LLMPortLive = Layer.effect(
  LLMPort,
  Effect.gen(function* () {
    const config = yield* RuntimeConfig;
    const modelLayer = languageModelLayer(config.openAiApiKey);
    const clientLayer = openAiClientLayer(config.openAiApiKey);

    return {
      generateVoiceProfile: (request) =>
        withProviderPolicy(
          LanguageModel.generateObject({
            objectName: "voice_profile",
            prompt: profilePrompt(request),
            schema: VoiceProfileSchema,
          }).pipe(
            Effect.map((response) => response.value),
            Effect.provide(modelLayer),
            Effect.mapError((cause) =>
              classifyProviderError("voice-profile", cause, "generation"),
            ),
          ),
          () =>
            new GenerationFailed({
              message: "Voice-profile generation timed out after 30 seconds.",
              cause: "timeout",
            }),
        ),
      generateContentPack: (request) =>
        withProviderPolicy(
          LanguageModel.generateObject({
            objectName: "pack_text",
            prompt: contentPackPrompt(request),
            schema: PackTextSchema,
          }).pipe(
            Effect.map((response) => response.value),
            Effect.provide(modelLayer),
            Effect.mapError((cause) =>
              classifyProviderError("content-pack", cause, "generation"),
            ),
          ),
          () =>
            new GenerationFailed({
              message: "Content-pack generation timed out after 30 seconds.",
              cause: "timeout",
            }),
        ),
      transcribe: (audio) =>
        withProviderPolicy(
          Effect.gen(function* () {
            const client = yield* OpenAiClient.OpenAiClient;
            const bytes = audio.bytes.buffer.slice(
              audio.bytes.byteOffset,
              audio.bytes.byteOffset + audio.bytes.byteLength,
            ) as ArrayBuffer;
            const response = yield* client.client.createTranscription({
              file: new Blob([bytes], { type: audio.mimeType }),
              model: "gpt-4o-mini-transcribe",
              response_format: "json",
            });
            return response.text;
          }).pipe(
            Effect.provide(clientLayer),
            Effect.mapError((cause) =>
              classifyProviderError(
                "voice-transcription",
                cause,
                "transcription",
              ),
            ),
          ),
          () =>
            new TranscriptionFailed({
              message: "Voice transcription timed out after 30 seconds.",
              cause: "timeout",
            }),
        ),
    };
  }),
);

export const TTSPortLive = Layer.succeed(TTSPort, {
  synthesize: () => notImplemented("TTSPort.synthesize"),
});
export const RendererPortLive = Layer.succeed(RendererPort, {
  render: () => notImplemented("RendererPort.render"),
});
export const MailPortLive = Layer.succeed(MailPort, {
  send: () => notImplemented("MailPort.send"),
});
export const PublisherPortLive = Layer.succeed(PublisherPort, {
  publish: () => notImplemented("PublisherPort.publish"),
});

export type LLMPortFakeOptions = Readonly<{
  voiceProfiles?: ReadonlyArray<VoiceProfile | LLMPortFailure>;
  contentPacks?: ReadonlyArray<PackText | LLMPortFailure>;
  transcriptions?: ReadonlyArray<string | LLMPortFailure>;
}>;

const isLLMPortFailure = (value: unknown): value is LLMPortFailure =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  [
    "GenerationFailed",
    "ModerationBlocked",
    "QuotaExceeded",
    "RateLimited",
    "TranscriptionFailed",
  ].includes((value as { _tag: string })._tag);

/**
 * Deterministic fake for the sole use-case test seam. Queues make provider
 * failures explicit instead of coupling tests to implementation details.
 */
export const makeLLMPortFake = (options: LLMPortFakeOptions = {}) => {
  const voiceProfiles = [
    ...(options.voiceProfiles ?? [makeVoiceProfileFixture()]),
  ];
  const transcriptions = [...(options.transcriptions ?? ["fake transcript"])];
  const contentPacks = [...(options.contentPacks ?? [makePackTextFixture()])];

  return Layer.succeed(LLMPort, {
    generateVoiceProfile: () => {
      const next = voiceProfiles.shift() ?? makeVoiceProfileFixture();
      return isLLMPortFailure(next) ? Effect.fail(next) : Effect.succeed(next);
    },
    generateContentPack: () => {
      const next = contentPacks.shift() ?? makePackTextFixture();
      return isLLMPortFailure(next) ? Effect.fail(next) : Effect.succeed(next);
    },
    transcribe: () => {
      const next = transcriptions.shift() ?? "fake transcript";
      return isLLMPortFailure(next) ? Effect.fail(next) : Effect.succeed(next);
    },
  });
};

export const TTSPortFake = Layer.succeed(TTSPort, {
  synthesize: () => Effect.succeed(new Uint8Array()),
});
export const RendererPortFake = Layer.succeed(RendererPort, {
  render: () => Effect.succeed("memory://rendered-asset"),
});
export const MailPortFake = Layer.succeed(MailPort, {
  send: () => Effect.void,
});
export const PublisherPortFake = PublisherPortLive;
