import { JSONSchema, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  StrategySchema,
  makeStrategyFixture,
  strategyValidationIssue,
} from "@/lib/strategy/schema";

describe("Strategy schema", () => {
  it("round-trips the strict prompt and persisted JSON contract", () => {
    const strategy = makeStrategyFixture();
    const encoded = Schema.encodeSync(StrategySchema)(strategy);
    const decoded = Schema.decodeUnknownSync(StrategySchema)(encoded);
    const openAiSchema = JSONSchema.make(StrategySchema);

    expect(decoded).toEqual(strategy);
    expect(openAiSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["icp", "pillars", "positioning", "calendar"],
    });
  });

  it("enforces the complete 30-day 15/9/6 calendar and pillar bindings", () => {
    const strategy = makeStrategyFixture();
    expect(strategyValidationIssue(strategy)).toBeNull();

    expect(
      strategyValidationIssue({
        ...strategy,
        calendar: strategy.calendar.slice(0, 29),
      }),
    ).toMatch(/exactly 30/i);
    expect(
      strategyValidationIssue({
        ...strategy,
        calendar: strategy.calendar.map((item, index) =>
          index === 0 ? { ...item, pillarId: "missing-pillar" } : item,
        ),
      }),
    ).toMatch(/existing content pillar/i);
    expect(
      strategyValidationIssue({
        ...strategy,
        calendar: strategy.calendar.map((item, index) =>
          index === 0 ? { ...item, funnelStage: "MOFU" as const } : item,
        ),
      }),
    ).toMatch(/15 TOFU, 9 MOFU, and 6 BOFU/i);
  });
});
