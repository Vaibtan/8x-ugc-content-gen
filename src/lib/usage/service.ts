import { Context, Effect, Layer, Ref } from "effect";

import { Db } from "@/lib/db/service";
import { SupabaseError } from "@/lib/errors";

export type UsageRecord = Readonly<{
  userId: string;
  packId: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  characters: number;
  costCents: number;
}>;

export type UsageService = Readonly<{
  record: (record: UsageRecord) => Effect.Effect<void>;
  flush: (input: {
    userId: string;
    packId: string;
  }) => Effect.Effect<number, SupabaseError, Db>;
}>;

export class Usage extends Context.Tag("founder-voice/Usage")<
  Usage,
  UsageService
>() {}

/**
 * Request measurements stay in a Ref until the use case has a durable pack
 * id, then are written as UsageEvent rows in one explicit flush.
 */
export const UsageLive = Layer.effect(
  Usage,
  Effect.gen(function* () {
    const pending = yield* Ref.make<ReadonlyArray<UsageRecord>>([]);
    return {
      record: (record) =>
        Ref.update(pending, (records) => [...records, record]),
      flush: ({ userId, packId }) =>
        Effect.gen(function* () {
          const db = yield* Db;
          const records = yield* Ref.get(pending);
          const matching = records.filter(
            (record) => record.userId === userId && record.packId === packId,
          );
          for (const record of matching) {
            yield* db.createUsageEvent(record);
          }
          yield* Ref.update(pending, (records) =>
            records.filter(
              (record) => record.userId !== userId || record.packId !== packId,
            ),
          );
          return matching.reduce(
            (total, record) => total + record.costCents,
            0,
          );
        }),
    };
  }),
);

export type InMemoryUsage = Readonly<{
  layer: Layer.Layer<Usage>;
  records: () => ReadonlyArray<UsageRecord>;
}>;

export const makeInMemoryUsage = (): InMemoryUsage => {
  const records: UsageRecord[] = [];
  return {
    layer: Layer.succeed(Usage, {
      record: (record) =>
        Effect.sync(() => {
          records.push(record);
        }),
      flush: ({ userId, packId }) =>
        Effect.gen(function* () {
          const db = yield* Db;
          const matching = records.filter(
            (record) => record.userId === userId && record.packId === packId,
          );
          for (const record of matching) {
            yield* db.createUsageEvent(record);
          }
          return matching.reduce(
            (total, record) => total + record.costCents,
            0,
          );
        }),
    }),
    records: () => [...records],
  };
};
