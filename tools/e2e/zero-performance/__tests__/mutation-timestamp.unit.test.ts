import { describe, expect, it } from 'vitest';
import { postgresTimestampRepresentations, replicatedTimestampValues } from '../mutation-timestamp';
import type { Sql } from 'postgres';

describe('SQL-backed Zero timestamp representations', () => {
  it('preserves the documented one-ULP binary versus text decoder difference for modern dates', () => {
    const values = postgresTimestampRepresentations('845000000000006');
    expect(values).toEqual([1_791_684_800_000.0059, 1_791_684_800_000.006]);
    expect(values[0]).not.toBe(Number('1791684800000.006'));
    expect(values.includes(Number('1791684800000.006'))).toBe(true);
    for (const changed of postgresTimestampRepresentations('845000000000007'))
      expect(values.includes(changed)).toBe(false);
  });
  it('handles PostgreSQL and Unix epoch boundaries and negative fractional timestamps', () => {
    expect(postgresTimestampRepresentations('0')).toEqual([946_684_800_000, 946_684_800_000]);
    expect(postgresTimestampRepresentations('-946684800000000')).toEqual([0, 0]);
    expect(postgresTimestampRepresentations('-946684800000001')[1]).toBe(-0.001);
    expect(postgresTimestampRepresentations('-946684799999999')[1]).toBe(0.001);
  });
  it('derives UTC integer microseconds through SQL without a float or JS Date projection', async () => {
    let statement = '';
    const sql = ((input: string | TemplateStringsArray) => {
      if (typeof input === 'string') return input;
      statement = input.join('?');
      return Promise.resolve([{ microseconds: '845000000000006' }]);
    }) as unknown as Sql;
    expect(await replicatedTimestampValues(sql, 'group', 'created_at', 'fixture')).toEqual(
      postgresTimestampRepresentations('845000000000006')
    );
    expect(statement).toContain('extract(epoch');
    expect(statement).toContain('1000000 - 946684800000000)::bigint::text');
    expect(statement).not.toContain('double precision');
  });
  it('fails closed on malformed microseconds and unsupported precision ranges', () => {
    for (const invalid of [null, 123, '1.1', 'NaN', 'private-value'])
      expect(() => postgresTimestampRepresentations(invalid)).toThrow(
        'Invalid SQL timestamp microseconds'
      );
    expect(() => postgresTimestampRepresentations('9007199254740992')).toThrow(
      'Unsupported SQL timestamp range'
    );
  });
});
