import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GenerationFailed } from "@/lib/errors";
import { withProviderPolicy } from "@/lib/ports";

describe("withProviderPolicy", () => {
  it("retries the tagged timeout failure before succeeding", async () => {
    let attempts = 0;
    const providerCall = Effect.suspend(() => {
      attempts += 1;
      return attempts === 3
        ? Effect.succeed("profile")
        : Effect.fail(
            new GenerationFailed({
              message: "Voice-profile generation timed out after 30 seconds.",
              cause: "timeout",
            }),
          );
    });

    await expect(
      Effect.runPromise(
        withProviderPolicy(
          providerCall,
          () =>
            new GenerationFailed({
              message: "Voice-profile generation timed out after 30 seconds.",
              cause: "timeout",
            }),
        ),
      ),
    ).resolves.toBe("profile");
    expect(attempts).toBe(3);
  });
});
