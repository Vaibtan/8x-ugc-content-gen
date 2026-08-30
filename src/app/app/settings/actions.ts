"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { createAuthServerClient } from "@/lib/auth/server-client";
import {
  BRAND_ASSET_MAX_BYTES,
  BrandAssetKind as BrandAssetKindSchema,
  BrandKitInput as BrandKitInputSchema,
  isBrandAssetContentType,
  type BrandAssetContentType,
  type BrandAssetKind,
  type BrandKit,
  type BrandKitInput,
} from "@/lib/brand-kit/schema";
import {
  createBrandAssetReadUrl,
  createBrandAssetUpload,
  getUsageCents,
  loadBrandKit,
  saveBrandKit,
  type BrandAssetUpload,
} from "@/lib/db/service";
import { runForUser } from "@/lib/runtime";

type AuthenticatedIdentity = Readonly<{
  userId: string;
  accessToken: string;
}>;

export type BrandKitSettingsData = Readonly<{
  authenticated: boolean;
  brandKit: BrandKit | null;
  headshotUrl: string | null;
  logoUrl: string | null;
  usageCents: number;
}>;

export type ActionResult<A> =
  | Readonly<{ ok: true; value: A }>
  | Readonly<{ ok: false; message: string }>;

const actionFailure = (message: string): ActionResult<never> => ({
  ok: false,
  message,
});

/**
 * `getUser` validates the cookie-backed identity with Supabase before a
 * server action constructs the per-user Effect layer. A browser-supplied
 * user id is never trusted.
 */
const getAuthenticatedIdentity =
  async (): Promise<AuthenticatedIdentity | null> => {
    try {
      const client = await createAuthServerClient();
      const [
        { data: userData, error: userError },
        { data: sessionData, error: sessionError },
      ] = await Promise.all([client.auth.getUser(), client.auth.getSession()]);

      if (
        userError !== null ||
        sessionError !== null ||
        userData.user === null ||
        sessionData.session?.access_token === undefined
      ) {
        return null;
      }

      return {
        userId: userData.user.id,
        accessToken: sessionData.session.access_token,
      };
    } catch {
      // A local preview with no Supabase environment is a signed-out state, not
      // a reason for the mobile shell to crash.
      return null;
    }
  };

export async function loadBrandKitSettings(): Promise<BrandKitSettingsData> {
  const identity = await getAuthenticatedIdentity();
  if (identity === null) {
    return {
      authenticated: false,
      brandKit: null,
      headshotUrl: null,
      logoUrl: null,
      usageCents: 0,
    };
  }

  const settings = await runForUser(
    identity.accessToken,
    Effect.gen(function* () {
      const brandKit = yield* loadBrandKit(identity.userId);
      const usageCents = yield* getUsageCents(identity.userId);
      const headshotUrl = brandKit?.headshot_path
        ? yield* createBrandAssetReadUrl(brandKit.headshot_path)
        : null;
      const logoUrl = brandKit?.logo_path
        ? yield* createBrandAssetReadUrl(brandKit.logo_path)
        : null;

      return { brandKit, headshotUrl, logoUrl, usageCents };
    }),
  );

  return { authenticated: true, ...settings };
}

export async function saveBrandKitAction(
  input: unknown,
): Promise<ActionResult<BrandKit>> {
  const identity = await getAuthenticatedIdentity();
  if (identity === null) {
    return actionFailure("Sign in before saving your brand kit.");
  }

  let decodedInput: BrandKitInput;
  try {
    decodedInput = Schema.decodeUnknownSync(BrandKitInputSchema)(input);
  } catch {
    return actionFailure("Check your name, colours, and selected font.");
  }

  try {
    const brandKit = await runForUser(
      identity.accessToken,
      saveBrandKit(identity.userId, decodedInput),
    );
    revalidatePath("/app/settings");
    return { ok: true, value: brandKit };
  } catch {
    return actionFailure(
      "Your brand kit could not be saved. Please try again.",
    );
  }
}

type BrandAssetRequest = Readonly<{
  kind: unknown;
  contentType: unknown;
  size: unknown;
}>;

const decodeBrandAssetRequest = (
  input: unknown,
): { kind: BrandAssetKind; contentType: BrandAssetContentType } | null => {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const request = input as BrandAssetRequest;
  if (
    typeof request.kind !== "string" ||
    typeof request.contentType !== "string" ||
    typeof request.size !== "number" ||
    request.size <= 0 ||
    request.size > BRAND_ASSET_MAX_BYTES ||
    !isBrandAssetContentType(request.contentType)
  ) {
    return null;
  }

  try {
    return {
      kind: Schema.decodeUnknownSync(BrandAssetKindSchema)(request.kind),
      contentType: request.contentType,
    };
  } catch {
    return null;
  }
};

/**
 * The browser receives only a short-lived, one-file upload capability. The
 * service-role key never reaches the client, and the per-user RLS client is
 * still required to create this URL.
 */
export async function requestBrandAssetUploadAction(
  input: unknown,
): Promise<ActionResult<BrandAssetUpload>> {
  const identity = await getAuthenticatedIdentity();
  if (identity === null) {
    return actionFailure("Sign in before uploading an image.");
  }

  const request = decodeBrandAssetRequest(input);
  if (request === null) {
    return actionFailure("Use a JPG, PNG, or WebP image smaller than 5 MB.");
  }

  try {
    const upload = await runForUser(
      identity.accessToken,
      createBrandAssetUpload(
        identity.userId,
        request.kind,
        request.contentType,
      ),
    );
    return { ok: true, value: upload };
  } catch {
    return actionFailure(
      "An upload URL could not be created. Please try again.",
    );
  }
}
