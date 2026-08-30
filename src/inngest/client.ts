import { Inngest } from "inngest";
import { Effect, Redacted } from "effect";

import type { ContentPackInput } from "@/lib/content-pack/service";
import { RuntimeConfig } from "@/lib/runtime/config";

/**
 * Inngest owns persistence between steps. Effect owns only the provider retry
 * inside a step, which is why the function below deliberately uses retries: 0.
 */
export const inngest = new Inngest({
  id: "founder-voice",
});

/** Provider credentials enter outbound durable work through Effect Config. */
export const sendContentPackGeneration = (data: ContentPackInput) =>
  Effect.gen(function* () {
    const config = yield* RuntimeConfig;
    const client = new Inngest({
      id: "founder-voice",
      eventKey: Redacted.value(config.inngestEventKey),
    });
    return yield* Effect.tryPromise({
      try: () => client.send({ name: "content-pack/generate.requested", data }),
      catch: (cause) =>
        cause instanceof Error
          ? cause
          : new Error("Could not enqueue content-pack generation."),
    });
  });
