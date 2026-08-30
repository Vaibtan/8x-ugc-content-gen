import { Layer, ManagedRuntime } from "effect";
import { describe, expect, it } from "vitest";

import { makeInMemoryDb, type VoiceProfileRow } from "@/lib/db/service";
import { makeLLMPortFake } from "@/lib/ports";
import {
  generateStrategy,
  regenerateStrategySection,
  saveEditedStrategy,
} from "@/lib/strategy/service";
import { makeStrategyFixture } from "@/lib/strategy/schema";
import { makeVoiceProfileFixture } from "@/lib/voice/schema";

const userId = "founder-1";

const voiceSeed: VoiceProfileRow = {
  user_id: userId,
  profile: makeVoiceProfileFixture(),
  interview: {
    answers: [
      {
        questionId: "offer",
        question: "What do you sell?",
        answer: "We help B2B founders turn expertise into demand.",
      },
      {
        questionId: "buyer",
        question: "Who buys?",
        answer: "Founder-led B2B software teams.",
      },
      {
        questionId: "why",
        question: "Why now?",
        answer: "Their pipeline is too dependent on outbound.",
      },
      {
        questionId: "belief",
        question: "What do you believe?",
        answer: "Useful operator lessons earn attention.",
      },
      {
        questionId: "story",
        question: "Tell a story",
        answer:
          "A client found qualified conversations from one practical post.",
      },
    ],
    pastPosts: [],
  },
  created_at: "2026-08-30T00:00:00.000Z",
  updated_at: "2026-08-30T00:00:00.000Z",
};

describe("StrategyService", () => {
  it("generates and persists a validated strategy through the fake-layer seam", async () => {
    const db = makeInMemoryDb([], [], [voiceSeed]);
    const searches: string[] = [];
    const strategy = makeStrategyFixture();
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        makeLLMPortFake({
          strategies: [strategy],
          webSearchResults: ["Buyer language", "Buying objections"],
          onWebSearch: ({ query }) => searches.push(query),
        }),
      ),
    );

    await expect(
      runtime.runPromise(generateStrategy({ userId, useWebSearch: true })),
    ).resolves.toEqual(strategy);
    expect(searches).toHaveLength(2);
    expect(db.strategyRows()).toEqual([
      expect.objectContaining({ user_id: userId, strategy }),
    ]);
  });

  it("preserves an edited ICP when only the pillars are regenerated", async () => {
    const db = makeInMemoryDb([], [], [voiceSeed]);
    const initial = makeStrategyFixture();
    const edited = {
      ...initial,
      icp: { ...initial.icp, who: "An ICP the founder edited by hand" },
    };
    const regenerated = makeStrategyFixture({
      icp: { ...initial.icp, who: "The model must not overwrite this ICP" },
      pillars: initial.pillars.map((pillar) => ({
        ...pillar,
        name: `${pillar.name} refreshed`,
      })),
    });
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        db.layer,
        makeLLMPortFake({ strategySections: [regenerated] }),
      ),
    );

    await runtime.runPromise(saveEditedStrategy({ userId, strategy: edited }));
    const result = await runtime.runPromise(
      regenerateStrategySection({ userId, section: "pillars" }),
    );

    expect(result.icp.who).toBe("An ICP the founder edited by hand");
    expect(result.pillars[0]?.name).toBe("Operator lessons refreshed");
    expect(db.strategyRows()[0]?.strategy.icp.who).toBe(
      "An ICP the founder edited by hand",
    );
  });
});
