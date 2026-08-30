import { Context, Effect, Layer } from "effect";

import { NotImplemented } from "@/lib/errors";

export type GenerationRequest = Readonly<{
  schemaName: string;
  prompt: string;
  model?: "gpt-5.6-luna" | "gpt-5.6-terra";
}>;

export class LLMPort extends Context.Tag("founder-voice/LLMPort")<
  LLMPort,
  Readonly<{
    generate: (
      request: GenerationRequest,
    ) => Effect.Effect<unknown, NotImplemented>;
    transcribe: (audio: Uint8Array) => Effect.Effect<string, NotImplemented>;
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

/** Provider-specific implementations arrive in later tickets. */
export const LLMPortLive = Layer.succeed(LLMPort, {
  generate: () => notImplemented("LLMPort.generate"),
  transcribe: () => notImplemented("LLMPort.transcribe"),
});
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

/** Test doubles are intentional seams, not mocks of implementation details. */
export const makeLLMPortFake = (responses: Record<string, unknown> = {}) =>
  Layer.succeed(LLMPort, {
    generate: (request: GenerationRequest) =>
      Effect.succeed(responses[request.schemaName]),
    transcribe: () => Effect.succeed("fake transcript"),
  });

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
