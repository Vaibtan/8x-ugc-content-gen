"use server";

import { Either, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth/server-client";
import { runForUser } from "@/lib/runtime";
import {
  saveEditedVoiceProfile,
  generateVoiceProfile,
  transcribeVoiceAnswer,
} from "@/lib/voice/service";
import {
  type VoiceProfile,
  VoiceInterviewSchema,
  VoiceProfileSchema,
} from "@/lib/voice/schema";
import { voiceErrorState } from "@/lib/voice/ui-error";

export type VoiceActionFailureCode =
  | "authentication_required"
  | "content_blocked"
  | "invalid_interview"
  | "invalid_profile"
  | "quota_exceeded"
  | "rate_limited"
  | "transcription_failed"
  | "voice_profile_missing"
  | "voice_profile_failed";

export type VoiceActionResult<A> =
  | Readonly<{ ok: true; value: A }>
  | Readonly<{
      ok: false;
      code: VoiceActionFailureCode;
      message: string;
      retryAfterSeconds: number | null;
    }>;

const failure = (
  code: VoiceActionFailureCode,
  message: string,
  retryAfterSeconds: number | null = null,
): VoiceActionResult<never> => ({
  ok: false,
  code,
  message,
  retryAfterSeconds,
});

const actionFailure = (cause: unknown): VoiceActionResult<never> => {
  const state = voiceErrorState(cause);
  return failure(state.code, state.message, state.retryAfterSeconds);
};

const decodeInterview = (input: unknown) => {
  const decoded = Schema.decodeUnknownEither(VoiceInterviewSchema)(input);
  if (Either.isLeft(decoded)) return null;
  const interview = decoded.right;
  return interview.answers.length >= 5 &&
    interview.answers.every((answer) => answer.answer.trim().length > 0)
    ? interview
    : null;
};

export async function generateVoiceProfileAction(
  input: unknown,
): Promise<VoiceActionResult<VoiceProfile>> {
  const session = await getCurrentSession();
  if (!session)
    return failure("authentication_required", "Please sign in again.");

  const interview = decodeInterview(input);
  if (!interview) {
    return failure(
      "invalid_interview",
      "Answer all five interview questions before generating your voice profile.",
    );
  }

  try {
    const profile = await runForUser(
      session.access_token,
      generateVoiceProfile({ userId: session.user.id, interview }),
    );
    revalidatePath("/app");
    return { ok: true, value: profile };
  } catch (cause) {
    return actionFailure(cause);
  }
}

export async function transcribeVoiceAnswerAction(
  formData: FormData,
): Promise<VoiceActionResult<string>> {
  const session = await getCurrentSession();
  if (!session)
    return failure("authentication_required", "Please sign in again.");

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return failure(
      "transcription_failed",
      "Record a short answer, or type it instead.",
    );
  }
  if (audio.size > 8 * 1024 * 1024) {
    return failure(
      "transcription_failed",
      "That recording is too large to upload. Record a shorter answer or type it instead.",
    );
  }

  try {
    const value = await runForUser(
      session.access_token,
      transcribeVoiceAnswer({
        bytes: new Uint8Array(await audio.arrayBuffer()),
        fileName: audio.name || "founder-answer.webm",
        mimeType: audio.type || "audio/webm",
      }),
    );
    return { ok: true, value };
  } catch (cause) {
    return actionFailure(cause);
  }
}

export async function saveVoiceProfileAction(
  input: unknown,
): Promise<VoiceActionResult<VoiceProfile>> {
  const session = await getCurrentSession();
  if (!session)
    return failure("authentication_required", "Please sign in again.");

  const decoded = Schema.decodeUnknownEither(VoiceProfileSchema)(input);
  if (Either.isLeft(decoded)) {
    return failure(
      "invalid_profile",
      "Check the profile fields and try saving again.",
    );
  }

  try {
    const profile = await runForUser(
      session.access_token,
      saveEditedVoiceProfile({
        userId: session.user.id,
        profile: decoded.right,
      }),
    );
    revalidatePath("/app");
    return { ok: true, value: profile };
  } catch (cause) {
    return actionFailure(cause);
  }
}
