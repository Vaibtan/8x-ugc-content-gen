/**
 * A serializable bridge from tagged domain failures to one actionable mobile
 * state. Server actions return this code, and the client renders its retry
 * affordance without inspecting provider errors.
 */
export type VoiceUiError = Readonly<{
  code:
    | "content_blocked"
    | "quota_exceeded"
    | "rate_limited"
    | "transcription_failed"
    | "voice_profile_missing"
    | "voice_profile_failed";
  message: string;
  retryAfterSeconds: number | null;
}>;

export const voiceErrorState = (cause: unknown): VoiceUiError => {
  if (typeof cause !== "object" || cause === null || !("_tag" in cause)) {
    return {
      code: "voice_profile_failed",
      message: "We could not save your voice profile. Please try again.",
      retryAfterSeconds: null,
    };
  }

  const error = cause as {
    _tag: string;
    message?: string;
    retryAfterSeconds?: number | null;
  };
  switch (error._tag) {
    case "RateLimited":
      return {
        code: "rate_limited",
        message:
          "OpenAI is temporarily busy. Your answers are still here, so try again shortly.",
        retryAfterSeconds: error.retryAfterSeconds ?? null,
      };
    case "ModerationBlocked":
      return {
        code: "content_blocked",
        message:
          "That response could not be processed. Please remove sensitive wording and try again.",
        retryAfterSeconds: null,
      };
    case "QuotaExceeded":
      return {
        code: "quota_exceeded",
        message:
          "Your AI quota is unavailable. Add credits or an active OpenAI key, then try again.",
        retryAfterSeconds: null,
      };
    case "TranscriptionFailed":
      return {
        code: "transcription_failed",
        message:
          "We could not transcribe that recording. You can retry the mic or type your answer instead.",
        retryAfterSeconds: null,
      };
    case "VoiceProfileNotFound":
      return {
        code: "voice_profile_missing",
        message: "Generate a profile before saving edits.",
        retryAfterSeconds: null,
      };
    default:
      return {
        code: "voice_profile_failed",
        message:
          error.message ??
          "We could not generate your voice profile. Please try again.",
        retryAfterSeconds: null,
      };
  }
};
