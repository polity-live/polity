import { describe, expect, it } from 'vitest';

import { applyChangeRequestVisibilityAccess, applyDocumentQueryAccess } from '../query-access';

type Call = readonly [string, ...unknown[]];

interface FakeQuery {
  calls: Call[];
  where: (...args: unknown[]) => FakeQuery;
  whereExists: (relation: string, fn: (query: FakeQuery) => unknown) => FakeQuery;
}

function createQuery(calls: Call[] = []): FakeQuery {
  const query: FakeQuery = {
    calls,
    where: (...args: unknown[]) => {
      calls.push(['where', ...args]);
      if (typeof args[0] === 'function') {
        args[0]({
          cmp: (...values: unknown[]) => ['cmp', ...values],
          exists: (relation: string, fn: (child: FakeQuery) => unknown) => {
            const childCalls: Call[] = [];
            calls.push(['exists', relation, childCalls]);
            fn(createQuery(childCalls));
            return ['exists', relation];
          },
          or: (...values: unknown[]) => ['or', ...values],
        });
      }
      return query;
    },
    whereExists: (relation, fn) => {
      const childCalls: Call[] = [];
      calls.push(['whereExists', relation, childCalls]);
      fn(createQuery(childCalls));
      return query;
    },
  };

  return query;
}

describe('public content query access', () => {
  it('allows anonymous document reads only through a public amendment', () => {
    const query = createQuery();

    applyDocumentQueryAccess(query, undefined);

    expect(query.calls).toEqual([
      ['whereExists', 'amendment', [['where', 'visibility', 'public']]],
    ]);
  });

  it('keeps anonymous change requests limited to public visibility scopes', () => {
    const query = createQuery();

    applyChangeRequestVisibilityAccess(query, undefined);

    const predicate = query.calls[0]?.[1];
    expect(typeof predicate).toBe('function');

    const comparisons: unknown[][] = [];
    (predicate as (helpers: Record<string, (...args: unknown[]) => unknown>) => unknown)({
      cmp: (...args: unknown[]) => {
        comparisons.push(args);
        return args;
      },
      exists: () => null,
      or: (...args: unknown[]) => args,
    });

    expect(comparisons).toEqual([
      ['visibility_scope', 'IS', null],
      ['visibility_scope', 'public'],
      ['visibility_scope', '__public_only__'],
    ]);
  });
});
