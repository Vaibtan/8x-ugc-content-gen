import { Schema } from "effect";
import { NextResponse } from "next/server";

import { getAuthenticatedIdentity } from "@/lib/auth/server-client";
import {
  BRAND_ASSET_MAX_BYTES,
  BrandAssetKind,
  isBrandAssetContentType,
} from "@/lib/brand-kit/schema";
import { uploadBrandAsset } from "@/lib/db/service";
import { runForUser } from "@/lib/runtime";

const invalidUpload = () =>
  NextResponse.json(
    { message: "Use a JPG, PNG, or WebP image smaller than 5 MB." },
    { status: 400 },
  );

/** Uploads one RLS-scoped brand image without exposing Storage to the browser. */
export async function POST(request: Request) {
  const identity = await getAuthenticatedIdentity();
  if (identity === null) {
    return NextResponse.json(
      { message: "Sign in before uploading an image." },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const kind = formData.get("kind");
  const file = formData.get("file");
  if (
    typeof kind !== "string" ||
    file === null ||
    typeof file === "string" ||
    file.size <= 0 ||
    file.size > BRAND_ASSET_MAX_BYTES ||
    !isBrandAssetContentType(file.type)
  ) {
    return invalidUpload();
  }

  let decodedKind: Schema.Schema.Type<typeof BrandAssetKind>;
  try {
    decodedKind = Schema.decodeUnknownSync(BrandAssetKind)(kind);
  } catch {
    return invalidUpload();
  }

  try {
    const path = await runForUser(
      identity.accessToken,
      uploadBrandAsset(identity.userId, decodedKind, file.type, file),
    );
    return NextResponse.json({ path });
  } catch {
    return NextResponse.json(
      { message: "The image upload could not start. Please try again." },
      { status: 500 },
    );
  }
}
