import { describe, expect, it } from 'vitest';
import { whereAnyOf } from '../query-conditions';

describe('small query value sets', () => {
  it('preserves set membership for one/multiple values, duplicates and unrelated values', () => {
    for (const values of [['active'], ['active', 'member', 'admin'], ['active', 'active']]) {
      for (const actual of ['active', 'member', 'admin', 'invited', null]) {
        let matches: boolean | undefined;
        const query = {
          where: (predicate: (helpers: unknown) => boolean) => {
            matches = predicate({
              cmp: (_field: string, _op: string, value: unknown) => actual === value,
              or: (...terms: boolean[]) => terms.some(Boolean),
            });
            return query;
          },
        };
        expect(whereAnyOf(query, 'status', values)).toBe(query);
        expect(matches).toBe(values.includes(actual as string));
      }
    }
  });
  it('keeps empty, nullable and large sets on the original IN path', () => {
    for (const values of [[], [null], Array.from({ length: 33 }, (_, n) => n)]) {
      const calls: unknown[][] = [];
      const query = {
        where: (...args: unknown[]) => {
          calls.push(args);
          return query;
        },
      };
      whereAnyOf(query, 'id', values);
      expect(calls).toEqual([['id', 'IN', values]]);
    }
  });
});
