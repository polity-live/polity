import assert from 'node:assert/strict';
import type { Sql } from 'postgres';

const postgresEpochMilliseconds = 946_684_800_000;
const postgresEpochMicroseconds = 946_684_800_000_000n;

/** Exact arithmetic of Zero 1.9's pg-copy-binary and streamed pg timestamp decoders. */
export function postgresTimestampRepresentations(microseconds: unknown): readonly [number, number] {
  assert.ok(
    typeof microseconds === 'string' && /^-?\d+$/.test(microseconds),
    'Invalid SQL timestamp microseconds'
  );
  const postgresMicros = BigInt(microseconds);
  // The SDK's binary decoder uses Number arithmetic, valid for practical application dates.
  assert.ok(Number.isSafeInteger(Number(postgresMicros)), 'Unsupported SQL timestamp range');
  const binary = Number(postgresMicros) / 1e3 + postgresEpochMilliseconds;
  const unixNanos = (postgresMicros + postgresEpochMicroseconds) * 1000n;
  const text = Number(unixNanos / 1_000_000n) + Number(unixNanos % 1_000_000n) * 1e-6;
  return [binary, text];
}

/** SQL supplies the full integer precision; no JS Date or floating SQL conversion participates. */
export async function replicatedTimestampValues(
  sql: Sql,
  table: string,
  column: string,
  id: string
): Promise<readonly [number, number]> {
  // extract(epoch) on timestamptz is UTC; on timestamp/date it matches Zero's UTC decoder.
  const rows =
    await sql`select (extract(epoch from ${sql(column)}) * 1000000 - 946684800000000)::bigint::text as microseconds from ${sql(table)} where id = ${id}`;
  assert.equal(rows.length, 1, `Rollback row proof: ${table}`);
  return postgresTimestampRepresentations(rows[0].microseconds);
}
