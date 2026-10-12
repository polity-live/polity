import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const sdk = createRequire(import.meta.url).resolve('@rocicorp/zero');
const moduleURL = (file: string) =>
  pathToFileURL(
    sdk
      .replace(/zero\/src\/zero\.js$/, file)
      .replace(/zero\\src\\zero\.js$/, file.replaceAll('/', '\\'))
  ).href;
const { makeBinaryDecoder } = (await import(moduleURL('zero-cache/src/db/pg-copy-binary.js'))) as {
  makeBinaryDecoder: (spec: {
    typeOID: number;
    pgTypeClass: string;
    elemPgTypeClass: null;
  }) => (buffer: Buffer) => number;
};
const { makeComparator } = (await import(moduleURL('zql/src/ivm/data.js'))) as {
  makeComparator: (
    order: [string, string][],
    reverse: boolean
  ) => (a: Record<string, unknown>, b: Record<string, unknown>) => number;
};
const { pgClient } = (await import(moduleURL('zero-cache/src/types/pg.js'))) as {
  pgClient: (
    logger: unknown,
    uri: string,
    name: string
  ) => { options: { parsers: Record<number, (value: string) => number> }; end(): Promise<void> };
};
const decoder = (typeOID: number) =>
  makeBinaryDecoder({ typeOID, pgTypeClass: 'b', elemPgTypeClass: null });
const unixMicrosBuffer = (unixMicros: bigint) => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(unixMicros - 946684800000000n);
  return buffer;
};

describe('installed Zero binary timestamp precision', () => {
  it('VERIFY:ZERO:BINARY-COPY-TIMESTAMP-PRECISION preserves independently encoded current-date microseconds for both timestamp OIDs', () => {
    // PostgreSQL extract(epoch)*1e6 confirms this whole-second wire anchor.
    // Expected doubles use decimal parsing, independently of the decoder math.
    for (const oid of [1114, 1184]) {
      const decode = decoder(oid);
      for (let micro = 0; micro < 1000; micro++) {
        expect(decode(unixMicrosBuffer(1791777954000000n + BigInt(micro)))).toBe(
          Number(`1791777954000.${String(micro).padStart(3, '0')}`)
        );
      }
    }
  });
  it('preserves independent Unix and PostgreSQL epoch wire boundaries without relying on the negative-date text parser', () => {
    const fixtures: [bigint, number][] = [
      [0n, 0],
      [1n, 0.001],
      [-1n, -0.001],
      [-86399999999n, -86399999.999],
      [946684799999999n, 946684799999.999],
      [946684800000000n, 946684800000],
      [946684800000001n, 946684800000.001],
      [-62135596799999999n, Number('-62135596799999.999')],
    ];
    for (const oid of [1114, 1184])
      for (const [micros, expected] of fixtures)
        expect(decoder(oid)(unixMicrosBuffer(micros))).toBe(expected);
  });
  it('retains both infinity sentinels and the independently captured PostgreSQL maximum finite wire bytes', () => {
    for (const oid of [1114, 1184]) {
      const decode = decoder(oid);
      const positive = Buffer.alloc(8);
      const negative = Buffer.alloc(8);
      positive.writeBigInt64BE(9223372036854775807n);
      negative.writeBigInt64BE(-9223372036854775808n);
      expect(decode(positive)).toBe(Infinity);
      expect(decode(negative)).toBe(-Infinity);
      // timestamptz_send('294276-12-31 23:59:59.999999+00') from PostgreSQL17.
      expect(decode(Buffer.from('7fffff5bb3b29fff', 'hex'))).toBe(9224318016000000);
    }
  });
  it('keeps a real numeric/id comparator tie when one row is initial binary COPY and the other is text replication', async () => {
    const logger = {
      withContext() {
        return this;
      },
    };
    const db = pgClient(logger, 'postgres://unused:unused@127.0.0.1/unused', 'timestamp-test');
    try {
      const copied = {
        id: 'user:a12a0000-0000-4000-a000-000000000001',
        created_at: decoder(1184)(unixMicrosBuffer(1791777954000006n)),
      };
      const replicated = {
        id: 'user:20000000-0000-4000-8000-000000000002',
        created_at: db.options.parsers[1184]('2026-10-12 04:05:54.000006+00'),
      };
      expect(copied.created_at).toBe(replicated.created_at);
      expect(
        [replicated, copied]
          .sort(
            makeComparator(
              [
                ['created_at', 'desc'],
                ['id', 'desc'],
              ],
              false
            )
          )
          .map(row => row.id)
      ).toEqual([copied.id, replicated.id]);
    } finally {
      await db.end();
    }
  });
});
