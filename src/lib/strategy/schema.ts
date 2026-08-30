import { Schema } from "effect";

const NonEmptyText = Schema.String.pipe(Schema.minLength(1));

export const FunnelStageSchema = Schema.Literal("TOFU", "MOFU", "BOFU");
export type FunnelStage = Schema.Schema.Type<typeof FunnelStageSchema>;

export const ContentFormatSchema = Schema.Literal(
  "text_post",
  "carousel",
  "video",
  "newsletter",
);
export type ContentFormat = Schema.Schema.Type<typeof ContentFormatSchema>;

export const IcpSchema = Schema.Struct({
  who: NonEmptyText,
  pains: Schema.Array(NonEmptyText),
  buyingTriggers: Schema.Array(NonEmptyText),
  objections: Schema.Array(NonEmptyText),
});
export type Icp = Schema.Schema.Type<typeof IcpSchema>;

export const ContentPillarSchema = Schema.Struct({
  /** Stable across a pillar-only regeneration so existing calendar rows stay bound. */
  id: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
  name: NonEmptyText,
  description: NonEmptyText,
  angles: Schema.Array(NonEmptyText),
});
export type ContentPillar = Schema.Schema.Type<typeof ContentPillarSchema>;

export const CalendarItemSchema = Schema.Struct({
  date: Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/)),
  pillarId: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
  format: ContentFormatSchema,
  hook: NonEmptyText,
  funnelStage: FunnelStageSchema,
});
export type CalendarItem = Schema.Schema.Type<typeof CalendarItemSchema>;

/**
 * The one strategy prompt contract. It deliberately includes the calendar so
 * the same strict schema validates model output and the persisted JSON.
 */
export const StrategySchema = Schema.Struct({
  icp: IcpSchema,
  pillars: Schema.Array(ContentPillarSchema),
  positioning: NonEmptyText,
  calendar: Schema.Array(CalendarItemSchema),
});
export type Strategy = Schema.Schema.Type<typeof StrategySchema>;

export type StrategySection = "icp" | "pillars" | "positioning" | "calendar";

export const STRATEGY_SECTIONS: ReadonlyArray<StrategySection> = [
  "icp",
  "pillars",
  "positioning",
  "calendar",
];

const isCalendarDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

/** Product invariants that JSON Schema cannot express across array members. */
export const strategyValidationIssue = (strategy: Strategy): string | null => {
  if (strategy.pillars.length < 3 || strategy.pillars.length > 5) {
    return "A strategy needs between three and five content pillars.";
  }
  const pillarIds = new Set(strategy.pillars.map((pillar) => pillar.id));
  if (pillarIds.size !== strategy.pillars.length) {
    return "Each content pillar needs a unique id.";
  }
  if (strategy.pillars.some((pillar) => pillar.angles.length === 0)) {
    return "Every content pillar needs at least one angle.";
  }
  if (strategy.calendar.length !== 30) {
    return "A strategy calendar must contain exactly 30 items.";
  }
  const dates = new Set(strategy.calendar.map((item) => item.date));
  if (
    dates.size !== strategy.calendar.length ||
    [...dates].some((date) => !isCalendarDate(date))
  ) {
    return "Every calendar item needs a unique valid ISO date.";
  }
  if (strategy.calendar.some((item) => !pillarIds.has(item.pillarId))) {
    return "Every calendar item must be bound to an existing content pillar.";
  }
  const stageCount = (stage: FunnelStage) =>
    strategy.calendar.filter((item) => item.funnelStage === stage).length;
  if (
    stageCount("TOFU") !== 15 ||
    stageCount("MOFU") !== 9 ||
    stageCount("BOFU") !== 6
  ) {
    return "The 30-day calendar must use exactly 15 TOFU, 9 MOFU, and 6 BOFU items.";
  }
  return null;
};

export const makeStrategyFixture = (
  overrides: Partial<Strategy> = {},
): Strategy => {
  const pillars: ReadonlyArray<ContentPillar> = [
    {
      id: "operator-lessons",
      name: "Operator lessons",
      description: "Concrete lessons from building the work.",
      angles: ["A mistake I would not repeat", "The checklist I use"],
    },
    {
      id: "buyer-problems",
      name: "Buyer problems",
      description: "Name expensive problems before offering a solution.",
      angles: ["The hidden cost", "A better operating model"],
    },
    {
      id: "proof",
      name: "Proof",
      description: "Teach with a specific customer or product outcome.",
      angles: ["Before and after", "What changed"],
    },
  ];
  const funnelStages: ReadonlyArray<FunnelStage> = [
    ...Array<FunnelStage>(15).fill("TOFU"),
    ...Array<FunnelStage>(9).fill("MOFU"),
    ...Array<FunnelStage>(6).fill("BOFU"),
  ];
  const formats: ReadonlyArray<ContentFormat> = [
    "text_post",
    "carousel",
    "video",
    "newsletter",
  ];
  const calendar = funnelStages.map((funnelStage, index) => {
    const date = new Date(Date.UTC(2026, 7, 30 + index));
    return {
      date: date.toISOString().slice(0, 10),
      pillarId: pillars[index % pillars.length].id,
      format: formats[index % formats.length],
      hook: `A practical lesson for day ${index + 1}`,
      funnelStage,
    };
  });

  return Schema.decodeUnknownSync(StrategySchema)({
    icp: {
      who: "B2B founders building an expert-led pipeline",
      pains: ["Inconsistent posting", "Generic AI content"],
      buyingTriggers: ["A stalled pipeline", "An upcoming launch"],
      objections: ["I do not have time", "AI will not sound like me"],
    },
    pillars,
    positioning:
      "Turn founder expertise into a consistent, voice-true demand engine.",
    calendar,
    ...overrides,
  });
};
