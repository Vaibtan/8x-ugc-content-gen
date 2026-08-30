import { Layer, ManagedRuntime } from "effect";
import { describe, expect, it } from "vitest";

import { findOwnUser, makeInMemoryDb } from "@/lib/db/service";
import {
  MailPortFake,
  PublisherPortFake,
  RendererPortFake,
  TTSPortFake,
  makeLLMPortFake,
} from "@/lib/ports";

describe("the application test seam", () => {
  it("runs a use case through a ManagedRuntime backed by fake layers", async () => {
    const db = makeInMemoryDb([
      {
        id: "founder-1",
        email: "founder@example.com",
        display_name: "Avery Founder",
        avatar_url: null,
        created_at: "2026-08-30T00:00:00.000Z",
        updated_at: "2026-08-30T00:00:00.000Z",
      },
    ]);
    const testLayer = Layer.mergeAll(
      db.layer,
      makeLLMPortFake(),
      TTSPortFake,
      RendererPortFake,
      MailPortFake,
      PublisherPortFake,
    );
    const testRuntime = ManagedRuntime.make(testLayer);

    await expect(
      testRuntime.runPromise(findOwnUser("founder-1")),
    ).resolves.toMatchObject({
      email: "founder@example.com",
      display_name: "Avery Founder",
    });
    expect(db.rows()).toHaveLength(1);
  });
});
