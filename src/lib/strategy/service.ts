import { Effect } from "effect";

import { Db } from "@/lib/db/service";
import {
  InvalidStrategy,
  StrategyNotFound,
  VoiceProfileNotFound,
} from "@/lib/errors";
import { LLMPort } from "@/lib/ports";
import {
  type Strategy,
  type StrategySection,
  strategyValidationIssue,
} from "@/lib/strategy/schema";

export type GenerateStrategyInput = Readonly<{
  userId: string;
  useWebSearch?: boolean;
}>;

export type RegenerateStrategySectionInput = GenerateStrategyInput &
  Readonly<{
    section: StrategySection;
  }>;

const businessAnswersFor = (
  answers: ReadonlyArray<{ question: string; answer: string }>,
) =>
  answers
    .map(({ question, answer }) => `Question: ${question}\nAnswer: ${answer}`)
    .join("\n\n");

const validStrategy = (strategy: Strategy) => {
  const issue = strategyValidationIssue(strategy);
  return issue === null
    ? Effect.succeed(strategy)
    : Effect.fail(new InvalidStrategy({ message: issue }));
};

/**
 * Exactly two web-search calls are permitted for a generation. The cap lives
 * here, above the provider adapter, so fake-layer tests can prove it without a
 * network request and a later prompt change cannot accidentally add a third.
 */
const researchFor = (enabled: boolean, businessAnswers: string) =>
  Effect.gen(function* () {
    if (!enabled) return [] as ReadonlyArray<string>;
    const llm = yield* LLMPort;
    const summary = businessAnswers.slice(0, 1_500);
    return yield* Effect.all([
      llm.searchNiche({
        query: `Identify the current language, pains, and desired outcomes used by buyers for this B2B founder. Return only useful market language.\n\n${summary}`,
      }),
      llm.searchNiche({
        query: `Identify current buying triggers and objections relevant to this B2B founder's niche. Return only useful market language.\n\n${summary}`,
      }),
    ]);
  });

const loadVoiceEvidence = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const voice = yield* db.findOwnVoiceProfile(userId);
    if (voice === null) {
      return yield* Effect.fail(new VoiceProfileNotFound({ userId }));
    }
    return {
      profile: voice.profile,
      businessAnswers: businessAnswersFor(voice.interview.answers),
    };
  });

/** Generates and persists the founder's first complete strategy. */
export const generateStrategy = ({
  userId,
  useWebSearch = false,
}: GenerateStrategyInput) =>
  Effect.gen(function* () {
    const llm = yield* LLMPort;
    const db = yield* Db;
    const evidence = yield* loadVoiceEvidence(userId);
    const research = yield* researchFor(useWebSearch, evidence.businessAnswers);
    const strategy = yield* llm.generateStrategy({
      businessAnswers: evidence.businessAnswers,
      voiceProfile: evidence.profile,
      research,
    });
    const validated = yield* validStrategy(strategy);
    yield* db.saveStrategy(userId, validated);
    return validated;
  });

const replacementFor = (
  current: Strategy,
  generated: Strategy,
  section: StrategySection,
): Strategy => {
  switch (section) {
    case "icp":
      return { ...current, icp: generated.icp };
    case "pillars":
      return { ...current, pillars: generated.pillars };
    case "positioning":
      return { ...current, positioning: generated.positioning };
    case "calendar":
      return { ...current, calendar: generated.calendar };
  }
};

/**
 * Replaces one strategy section only. The model receives the full contract for
 * strict decoding, while this use-case protects the founder's other edits.
 */
export const regenerateStrategySection = ({
  userId,
  section,
  useWebSearch = false,
}: RegenerateStrategySectionInput) =>
  Effect.gen(function* () {
    const llm = yield* LLMPort;
    const db = yield* Db;
    const evidence = yield* loadVoiceEvidence(userId);
    const existing = yield* db.findOwnStrategy(userId);
    if (existing === null) {
      return yield* Effect.fail(new StrategyNotFound({ userId }));
    }
    const research = yield* researchFor(useWebSearch, evidence.businessAnswers);
    const generated = yield* llm.generateStrategySection({
      businessAnswers: evidence.businessAnswers,
      voiceProfile: evidence.profile,
      research,
      current: existing.strategy,
      section,
    });
    const updated = replacementFor(existing.strategy, generated, section);
    const validated = yield* validStrategy(updated);
    yield* db.saveStrategy(userId, validated);
    return validated;
  });

/** Persists inline founder edits after rechecking the same hard invariants. */
export const saveEditedStrategy = (input: {
  userId: string;
  strategy: Strategy;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const validated = yield* validStrategy(input.strategy);
    yield* db.saveStrategy(input.userId, validated);
    return validated;
  });
