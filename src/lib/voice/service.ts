import { Effect } from "effect";

import { Db } from "@/lib/db/service";
import { VoiceProfileNotFound } from "@/lib/errors";
import { LLMPort, type AudioInput, type LLMPortFailure } from "@/lib/ports";
import { type VoiceInterview, type VoiceProfile } from "@/lib/voice/schema";

export type VoiceProfileInput = Readonly<{
  userId: string;
  interview: VoiceInterview;
}>;

const transcriptFor = (interview: VoiceInterview) =>
  interview.answers
    .map(({ question, answer }) => `Question: ${question}\nAnswer: ${answer}`)
    .join("\n\n");

/**
 * The onboarding use case. It knows nothing about OpenAI or Supabase and is
 * therefore exercised only through the application fake-layer seam.
 */
export const generateVoiceProfile = ({
  userId,
  interview,
}: VoiceProfileInput) =>
  Effect.gen(function* () {
    const llm = yield* LLMPort;
    const db = yield* Db;
    const profile = yield* llm.generateVoiceProfile({
      transcript: transcriptFor(interview),
      pastPosts: interview.pastPosts,
    });
    yield* db.saveVoiceProfile({ userId, profile, interview });
    return profile;
  });

/** Audio is transcribed through the port before it becomes an interview answer. */
export const transcribeVoiceAnswer = (
  audio: AudioInput,
): Effect.Effect<string, LLMPortFailure, LLMPort> =>
  Effect.gen(function* () {
    const llm = yield* LLMPort;
    return yield* llm.transcribe(audio);
  });

/** Persist founder edits while retaining the original interview evidence. */
export const saveEditedVoiceProfile = (input: {
  userId: string;
  profile: VoiceProfile;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const existing = yield* db.findOwnVoiceProfile(input.userId);
    if (existing === null) {
      return yield* Effect.fail(
        new VoiceProfileNotFound({ userId: input.userId }),
      );
    }
    yield* db.saveVoiceProfile({
      userId: input.userId,
      profile: input.profile,
      interview: existing.interview,
    });
    return input.profile;
  });
