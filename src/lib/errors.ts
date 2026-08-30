import { Data } from "effect";

/** A provider returned an error while a repository operation was in progress. */
export class SupabaseError extends Data.TaggedError("SupabaseError")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

export class AuthenticationError extends Data.TaggedError(
  "AuthenticationError",
)<{
  readonly operation: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
  readonly userId: string;
}> {}

/** The provider asked the user to wait before attempting the call again. */
export class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly operation: string;
  readonly retryAfterSeconds: number | null;
}> {}

/** OpenAI declined input under its content policy. */
export class ModerationBlocked extends Data.TaggedError("ModerationBlocked")<{
  readonly operation: string;
  readonly message: string;
}> {}

/** The provider has no remaining funded capacity for this request. */
export class QuotaExceeded extends Data.TaggedError("QuotaExceeded")<{
  readonly operation: string;
  readonly message: string;
}> {}

/** An audio upload could not be transcribed into a usable founder answer. */
export class TranscriptionFailed extends Data.TaggedError(
  "TranscriptionFailed",
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/** A structured voice-profile request failed for a reason other than policy/rate/quota. */
export class GenerationFailed extends Data.TaggedError("GenerationFailed")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class VoiceProfileNotFound extends Data.TaggedError(
  "VoiceProfileNotFound",
)<{
  readonly userId: string;
}> {}

export class NotImplemented extends Data.TaggedError("NotImplemented")<{
  readonly capability: string;
}> {}
