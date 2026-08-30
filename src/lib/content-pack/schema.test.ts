import { JSONSchema, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { PackTextSchema, makePackTextFixture } from "@/lib/content-pack/schema";

describe("PackText schema", () => {
  it("round-trips the generated copy and emits an OpenAI strict object schema", () => {
    const pack = makePackTextFixture();
    const encoded = Schema.encodeSync(PackTextSchema)(pack);
    const decoded = Schema.decodeUnknownSync(PackTextSchema)(encoded);
    const openAiSchema = JSONSchema.make(PackTextSchema);

    expect(decoded).toEqual(pack);
    expect(openAiSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: [
        "postVariants",
        "carouselSlides",
        "videoScript",
        "newsletter",
        "magnet",
        "commentKeyword",
      ],
    });
  });

  it("requires three hook variants and an 8-to-10-slide carousel", () => {
    const pack = makePackTextFixture();

    expect(() =>
      Schema.decodeUnknownSync(PackTextSchema)({
        ...pack,
        postVariants: pack.postVariants.slice(0, 2),
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(PackTextSchema)({
        ...pack,
        carouselSlides: pack.carouselSlides.slice(0, 7),
      }),
    ).toThrow();
  });
});
