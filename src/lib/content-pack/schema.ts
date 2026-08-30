import { Schema } from "effect";

/**
 * The only persisted and model-facing shape for generated pack copy. All
 * fields are deliberately required so the same Effect schema is valid as a
 * strict OpenAI JSON schema and as the database content validator.
 */
export const CarouselSlideSchema = Schema.Struct({
  title: Schema.String,
  body: Schema.String,
});

export const NewsletterSchema = Schema.Struct({
  subject: Schema.String,
  body: Schema.String,
});

export const MagnetOutlineSchema = Schema.Struct({
  type: Schema.Literal("checklist", "template", "guide", "scorecard"),
  title: Schema.String,
  bullets: Schema.Array(Schema.String),
});

export const PackTextSchema = Schema.Struct({
  postVariants: Schema.Array(Schema.String).pipe(Schema.itemsCount(3)),
  carouselSlides: Schema.Array(CarouselSlideSchema).pipe(
    Schema.minItems(8),
    Schema.maxItems(10),
  ),
  videoScript: Schema.String,
  newsletter: NewsletterSchema,
  magnet: MagnetOutlineSchema,
  commentKeyword: Schema.String,
});

export type CarouselSlide = Schema.Schema.Type<typeof CarouselSlideSchema>;
export type Newsletter = Schema.Schema.Type<typeof NewsletterSchema>;
export type MagnetOutline = Schema.Schema.Type<typeof MagnetOutlineSchema>;
export type PackText = Schema.Schema.Type<typeof PackTextSchema>;

export const PackStatusSchema = Schema.Literal(
  "draft",
  "ready",
  "posted",
  "winner",
);
export type PackStatus = Schema.Schema.Type<typeof PackStatusSchema>;

export const AssetTypeSchema = Schema.Literal(
  "post",
  "carousel",
  "video",
  "newsletter",
  "magnet",
);
export type AssetType = Schema.Schema.Type<typeof AssetTypeSchema>;

export const AssetStatusSchema = Schema.Literal(
  "queued",
  "running",
  "done",
  "failed",
);
export type AssetStatus = Schema.Schema.Type<typeof AssetStatusSchema>;

export const JobStatusSchema = Schema.Literal(
  "queued",
  "running",
  "done",
  "failed",
);
export type JobStatus = Schema.Schema.Type<typeof JobStatusSchema>;

/** A valid deterministic response for the fake LLM and schema round-trips. */
export const makePackTextFixture = (
  overrides: Partial<PackText> = {},
): PackText =>
  Schema.decodeUnknownSync(PackTextSchema)({
    postVariants: [
      "Most B2B content fails before the first sentence.\n\nThe fix is not more volume. It is a clear point of view, a useful example, and a reason to save the post.\n\nComment PLAYBOOK and I will send the checklist.",
      "Your content calendar is not the problem.\n\nA weak insight dressed up as a schedule still gets ignored. Start with the buyer question you can answer better than anyone.\n\nComment PLAYBOOK and I will send the checklist.",
      "I stopped asking founders to post more often.\n\nFirst we find the lesson their buyers need this week, then we turn it into one sharp post people can save.\n\nComment PLAYBOOK and I will send the checklist.",
    ],
    carouselSlides: [
      {
        title: "Start with the buyer question",
        body: "Find the live problem.",
      },
      { title: "Name the costly mistake", body: "Make the lesson concrete." },
      { title: "Give one useful next step", body: "Earn the save." },
      { title: "Make the lesson specific", body: "Use a real buyer moment." },
      { title: "Cut the generic opener", body: "Lead with the live problem." },
      { title: "Name the trade-off", body: "Give the reader a useful choice." },
      { title: "Turn insight into action", body: "Offer one practical move." },
      { title: "Earn the next step", body: "End with a reason to save." },
  ],
    videoScript:
      "Most B2B content fails before the first sentence. Start with the buyer question, name the costly mistake, then give one useful next step. That is how a post earns a save instead of a polite like.",
    newsletter: {
      subject: "The B2B content mistake hiding in plain sight",
      body: "Most B2B content fails before the first sentence because it begins with a company update instead of a buyer problem. Start with the question a prospect is already asking, name the costly mistake, and give one useful next step they can use today. That sequence gives readers a reason to pause because it proves you understand the work behind their decision. This is not about posting more often or adding louder formatting. It is about publishing a point of view that earns a save and starts a useful conversation. Before your next post, write the buyer question at the top of the draft, remove the generic opening, and end with a practical move they can try. Then keep the strongest lesson in your calendar so it can become a carousel, a short video, and a useful lead magnet.",
    },
    magnet: {
      type: "checklist",
      title: "The practical B2B content checklist",
      bullets: [
        "Choose one buyer question.",
        "Lead with the costly mistake.",
        "Give a concrete next step.",
      ],
    },
    commentKeyword: "PLAYBOOK",
    ...overrides,
  });
