import { JSONSchema, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  VoiceProfileSchema,
  makeVoiceProfileFixture,
} from "@/lib/voice/schema";

describe("VoiceProfile schema", () => {
  it("round-trips a profile and emits an OpenAI strict object schema", () => {
    const profile = makeVoiceProfileFixture();
    const encoded = Schema.encodeSync(VoiceProfileSchema)(profile);
    const decoded = Schema.decodeUnknownSync(VoiceProfileSchema)(encoded);
    const openAiSchema = JSONSchema.make(VoiceProfileSchema);

    expect(decoded).toEqual(profile);
    expect(openAiSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: [
        "toneAdjectives",
        "averageSentenceLength",
        "signaturePhrases",
        "bannedWords",
        "emojiPolicy",
        "formattingHabits",
        "pointOfView",
        "exampleSentences",
      ],
    });
  });
});
