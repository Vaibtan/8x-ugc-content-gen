import { Schema } from "effect";

/**
 * The one canonical representation of a founder's writing voice. It is used
 * for OpenAI structured output, persisted JSON, and deterministic test data.
 * Every field is required so the OpenAI schema remains strict.
 */
export const VoiceProfileSchema = Schema.Struct({
  toneAdjectives: Schema.Array(Schema.String),
  averageSentenceLength: Schema.Int.pipe(Schema.positive()),
  signaturePhrases: Schema.Array(Schema.String),
  bannedWords: Schema.Array(Schema.String),
  emojiPolicy: Schema.Literal("none", "sparing", "frequent"),
  formattingHabits: Schema.Array(Schema.String),
  pointOfView: Schema.Literal(
    "first-person",
    "second-person",
    "third-person",
    "mixed",
  ),
  exampleSentences: Schema.Array(Schema.String),
});

export type VoiceProfile = Schema.Schema.Type<typeof VoiceProfileSchema>;

export const InterviewAnswerSchema = Schema.Struct({
  questionId: Schema.String,
  question: Schema.String,
  answer: Schema.String,
});

/** The persisted source material for a profile, not another prompt output. */
export const VoiceInterviewSchema = Schema.Struct({
  answers: Schema.Array(InterviewAnswerSchema),
  pastPosts: Schema.Array(Schema.String),
});

export type VoiceInterview = Schema.Schema.Type<typeof VoiceInterviewSchema>;

/**
 * Schema-validated rather than hand-waved fixture data: future port fakes use
 * this as their success default and will fail at construction if the contract
 * changes.
 */
export const makeVoiceProfileFixture = (
  overrides: Partial<VoiceProfile> = {},
): VoiceProfile =>
  Schema.decodeUnknownSync(VoiceProfileSchema)({
    toneAdjectives: ["clear", "practical", "direct"],
    averageSentenceLength: 14,
    signaturePhrases: ["Here is the useful part"],
    bannedWords: ["revolutionary"],
    emojiPolicy: "sparing",
    formattingHabits: ["short paragraphs", "one concrete example"],
    pointOfView: "first-person",
    exampleSentences: ["I learned this after shipping it the hard way."],
    ...overrides,
  });
