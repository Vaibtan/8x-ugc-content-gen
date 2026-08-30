import { Effect } from "effect";

import { type BrandKitInput } from "@/lib/brand-kit/schema";
import { loadBrandKit, saveBrandKit } from "@/lib/db/service";

/**
 * The brand-kit use case deliberately knows only the `Db` repository. It is
 * the boundary exercised by the application test runtime and has no direct
 * dependency on Supabase or Storage.
 */
export const saveAndLoadBrandKit = (userId: string, input: BrandKitInput) =>
  Effect.gen(function* () {
    yield* saveBrandKit(userId, input);
    return yield* loadBrandKit(userId);
  });
