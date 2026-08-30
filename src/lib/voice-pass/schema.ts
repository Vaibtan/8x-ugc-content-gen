import { Schema } from "effect";

/**
 * The model-facing result for the final founder-voice rewrite. Every field is
 * required so Effect emits the same strict object contract for OpenAI, the
 * database boundary, and deterministic fake-layer fixtures.
 */
export const VoicePassResultSchema = Schema.Struct({
  rewrittenDraft: Schema.String.pipe(Schema.minLength(1)),
  fidelityScore: Schema.Int.pipe(Schema.between(0, 100)),
  diffNotes: Schema.Array(Schema.String),
});

export type VoicePassResult = Schema.Schema.Type<typeof VoicePassResultSchema>;

export const VoicePassActionSchema = Schema.Literal(
  "voice-pass",
  "more-like-my-voice",
  "punchier-hook",
  "shorter",
);

export type VoicePassAction = Schema.Schema.Type<typeof VoicePassActionSchema>;

/** A schema-validated default for the fake LLM layer. */
export const makeVoicePassResultFixture = (
  overrides: Partial<VoicePassResult> = {},
): VoicePassResult =>
  Schema.decodeUnknownSync(VoicePassResultSchema)({
    rewrittenDraft:
      "Here is the useful part: a small B2B team does not need more content. It needs one lesson its buyers can use this week.",
    fidelityScore: 87,
    diffNotes: [
      "Used the founder's direct, practical tone.",
      "Removed generic claims and tightened the opening.",
    ],
    ...overrides,
  });
