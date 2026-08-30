import { Schema } from "effect";

const HexColor = Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/));
const AssetPath = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(512),
);

/**
 * The fonts we can render consistently in the first branded-asset slice.
 * Keeping this finite means the renderer never receives an arbitrary font
 * name from a browser form.
 */
export const BrandFont = Schema.Literal(
  "Inter",
  "Manrope",
  "Newsreader",
  "Space Grotesk",
);

/** User-controlled fields stored in a brand-kit row. */
export const BrandKitInput = Schema.Struct({
  display_name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(80)),
  handle: Schema.String.pipe(Schema.maxLength(80)),
  headshot_path: Schema.NullOr(AssetPath),
  logo_path: Schema.NullOr(AssetPath),
  primary_color: HexColor,
  secondary_color: HexColor,
  font: BrandFont,
});

/**
 * The database boundary decodes every persisted brand kit through this
 * schema. All keys are required; image values are explicitly nullable.
 */
export const BrandKit = Schema.Struct({
  user_id: Schema.String.pipe(Schema.minLength(1)),
  display_name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(80)),
  handle: Schema.String.pipe(Schema.maxLength(80)),
  headshot_path: Schema.NullOr(AssetPath),
  logo_path: Schema.NullOr(AssetPath),
  primary_color: HexColor,
  secondary_color: HexColor,
  font: BrandFont,
  created_at: Schema.String,
  updated_at: Schema.String,
});

export type BrandKit = Schema.Schema.Type<typeof BrandKit>;
export type BrandKitInput = Schema.Schema.Type<typeof BrandKitInput>;
export type BrandFont = Schema.Schema.Type<typeof BrandFont>;

export const BrandAssetKind = Schema.Literal("headshot", "logo");
export type BrandAssetKind = Schema.Schema.Type<typeof BrandAssetKind>;

export const BRAND_ASSET_BUCKET = "brand-assets";
export const BRAND_ASSET_MAX_BYTES = 5 * 1024 * 1024;

/** Only raster image formats are accepted in this MVP. */
export const BRAND_ASSET_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type BrandAssetContentType = keyof typeof BRAND_ASSET_CONTENT_TYPES;

export const isBrandAssetContentType = (
  value: string,
): value is BrandAssetContentType => value in BRAND_ASSET_CONTENT_TYPES;
