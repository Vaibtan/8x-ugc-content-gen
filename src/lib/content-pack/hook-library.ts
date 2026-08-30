/**
 * A seed library rather than generated copy. Keeping the two arrays explicit
 * makes the editorial choices reviewable, while their cross-product gives the
 * prompt more than the required 300 distinct hook patterns.
 */
const OPENERS = [
  "Most founders miss this",
  "The uncomfortable truth about",
  "I learned this after shipping",
  "Before you try another",
  "Nobody tells you this about",
  "The fastest way to waste a quarter is",
  "A better question than how do I",
  "What changed when we stopped",
  "The mistake behind every weak",
  "If your buyer says maybe,",
  "This is why your best",
  "The playbook I wish I had",
  "Here is the useful part of",
  "A contrarian take on",
  "Three words that change",
  "The signal hidden inside",
  "Stop measuring",
  "What our customer taught us about",
  "The honest version of",
  "Your calendar cannot fix",
  "The small decision that saved",
  "I would not start with",
  "The real job of",
  "A practical fix for",
  "The myth holding back",
  "Why I no longer recommend",
  "A framework for",
  "The before-and-after of",
  "What to do when",
  "The habit that makes",
  "A note for founders who",
  "The lesson from our last",
] as const;

const FRAMES = [
  "your content strategy",
  "getting buyer attention",
  "writing a useful LinkedIn post",
  "turning ideas into pipeline",
  "choosing a content pillar",
  "earning a save instead of a like",
  "a founder-led content calendar",
  "making AI copy sound human",
  "finding a sharp point of view",
  "converting a post into a conversation",
] as const;

export const HOOK_PATTERNS: ReadonlyArray<string> = OPENERS.flatMap((opener) =>
  FRAMES.map((frame) => `${opener}: ${frame}.`),
);

/** Stable, bounded sampling makes generations reproducible in test fixtures. */
export const sampleHookPatterns = (
  seed: string,
  count = 12,
): ReadonlyArray<string> => {
  let value = [...seed].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const selected: string[] = [];
  const limit = Math.min(Math.max(1, count), HOOK_PATTERNS.length);
  while (selected.length < limit) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const candidate = HOOK_PATTERNS[value % HOOK_PATTERNS.length];
    if (!selected.includes(candidate)) selected.push(candidate);
  }
  return selected;
};
