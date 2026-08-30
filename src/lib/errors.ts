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

export class NotImplemented extends Data.TaggedError("NotImplemented")<{
  readonly capability: string;
}> {}
