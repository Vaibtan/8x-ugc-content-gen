import { JSONSchema, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  VoicePassResultSchema,
  makeVoicePassResultFixture,
} from "@/lib/voice-pass/schema";

describe("VoicePassResult schema", () => {
  it("round-trips and emits an OpenAI strict object schema", () => {
    const result = makeVoicePassResultFixture();
    const encoded = Schema.encodeSync(VoicePassResultSchema)(result);
    const decoded = Schema.decodeUnknownSync(VoicePassResultSchema)(encoded);
    const openAiSchema = JSONSchema.make(VoicePassResultSchema);

    expect(decoded).toEqual(result);
    expect(openAiSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["rewrittenDraft", "fidelityScore", "diffNotes"],
    });
  });

  it("rejects incomplete results and scores outside the 0-to-100 range", () => {
    const result = makeVoicePassResultFixture();

    expect(() =>
      Schema.decodeUnknownSync(VoicePassResultSchema)({
        rewrittenDraft: result.rewrittenDraft,
        fidelityScore: result.fidelityScore,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(VoicePassResultSchema)({
        ...result,
        fidelityScore: 101,
      }),
    ).toThrow();
  });
});
