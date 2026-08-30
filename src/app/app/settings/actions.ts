"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import {
  BrandKitInput as BrandKitInputSchema,
  type BrandKit,
  type BrandKitInput,
} from "@/lib/brand-kit/schema";
import {
  createBrandAssetReadUrl,
  getUsageCents,
  loadBrandKit,
  saveBrandKit,
} from "@/lib/db/service";
import { getAuthenticatedIdentity } from "@/lib/auth/server-client";
import { runForUser } from "@/lib/runtime";

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
