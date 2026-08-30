"use server";

import { Either, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { getAuthenticatedIdentity } from "@/lib/auth/server-client";
import { runForUser } from "@/lib/runtime";
import {
  generateStrategy,
  regenerateStrategySection,
  saveEditedStrategy,
} from "@/lib/strategy/service";
import {
  type Strategy,
  StrategySchema,
  STRATEGY_SECTIONS,
  type StrategySection,
} from "@/lib/strategy/schema";

export type StrategyActionResult =
  | Readonly<{ ok: true; value: Strategy }>
  | Readonly<{ ok: false; message: string }>;

const failure = (message: string): StrategyActionResult => ({
  ok: false,
  message,
});

const actionFailure = (cause: unknown): StrategyActionResult => {
  if (typeof cause === "object" && cause !== null && "_tag" in cause) {
    switch ((cause as { _tag?: string })._tag) {
      case "VoiceProfileNotFound":
        return failure(
          "Complete the interview before generating your strategy.",
        );
      case "RateLimited":
        return failure(
          "The strategy service is busy. Please retry in a moment.",
        );
      case "QuotaExceeded":
        return failure(
          "Your AI quota is unavailable right now. Please retry later.",
        );
      case "ModerationBlocked":
        return failure(
          "Try rephrasing the business details and generate again.",
        );
      case "InvalidStrategy":
        return failure(
          "The generated plan was incomplete. Please regenerate that section.",
        );
    }
  }
  return failure("Your strategy could not be saved. Please try again.");
};

const resolveIdentity = async () => {
  const identity = await getAuthenticatedIdentity();
  return identity ?? null;
};

export async function generateStrategyAction(
  useWebSearch: boolean,
): Promise<StrategyActionResult> {
  const identity = await resolveIdentity();
  if (identity === null)
    return failure("Sign in before generating a strategy.");

  try {
    const value = await runForUser(
      identity.accessToken,
      generateStrategy({ userId: identity.userId, useWebSearch }),
    );
    revalidatePath("/app/calendar");
    return { ok: true, value };
  } catch (cause) {
    return actionFailure(cause);
  }
}

export async function regenerateStrategySectionAction(
  section: unknown,
  useWebSearch: boolean,
): Promise<StrategyActionResult> {
  if (
    typeof section !== "string" ||
    !STRATEGY_SECTIONS.includes(section as StrategySection)
  ) {
    return failure("Choose a valid strategy section to regenerate.");
  }
  const identity = await resolveIdentity();
  if (identity === null)
    return failure("Sign in before regenerating a strategy.");

  try {
    const value = await runForUser(
      identity.accessToken,
      regenerateStrategySection({
        userId: identity.userId,
        section: section as StrategySection,
        useWebSearch,
      }),
    );
    revalidatePath("/app/calendar");
    return { ok: true, value };
  } catch (cause) {
    return actionFailure(cause);
  }
}

export async function saveStrategyAction(
  input: unknown,
): Promise<StrategyActionResult> {
  const identity = await resolveIdentity();
  if (identity === null) return failure("Sign in before saving your strategy.");

  const decoded = Schema.decodeUnknownEither(StrategySchema)(input);
  if (Either.isLeft(decoded)) {
    return failure("Check the required strategy fields and calendar entries.");
  }

  try {
    const value = await runForUser(
      identity.accessToken,
      saveEditedStrategy({ userId: identity.userId, strategy: decoded.right }),
    );
    revalidatePath("/app/calendar");
    return { ok: true, value };
  } catch (cause) {
    return actionFailure(cause);
  }
}
