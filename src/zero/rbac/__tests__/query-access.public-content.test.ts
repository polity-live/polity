import { describe, expect, it } from 'vitest';

import {
  applyChangeRequestVisibilityAccess,
  applyDocumentQueryAccess,
  applyGroupQueryAccess,
  applySearchDocumentQueryAccess,
  applyTodoQueryAccess,
} from '../query-access';

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

  it('limits anonymous search documents to public visibility', () => {
    const query = createQuery();

    applySearchDocumentQueryAccess(query, undefined);

    expect(query.calls).toEqual([['where', 'visibility', 'public']]);
  });

  it('uses the materialized ACL for private authenticated search results', () => {
    const query = createQuery();

    applySearchDocumentQueryAccess(query, 'user-1');

    expect(query.calls).toEqual([
      ['where', expect.any(Function)],
      ['exists', 'acl', [['where', 'user_id', 'user-1']]],
    ]);
  });

  it('only treats active memberships and guest access as private group relationships', () => {
    const query = createQuery();

    applyGroupQueryAccess(query, 'user-1');

    expect(query.calls).toContainEqual([
      'exists',
      'memberships',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active', 'member', 'admin']],
      ],
    ]);
    expect(query.calls).toContainEqual([
      'exists',
      'guest_accesses',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active']],
      ],
    ]);
  });

  it('carries active event and amendment relationships into private task access', () => {
    const query = createQuery();

    applyTodoQueryAccess(query, 'user-1');

    const eventCall = query.calls.find(call => call[0] === 'exists' && call[1] === 'event');
    const amendmentCall = query.calls.find(call => call[0] === 'exists' && call[1] === 'amendment');
    const eventCalls = eventCall?.[2] as Call[];
    const amendmentCalls = amendmentCall?.[2] as Call[];

    expect(eventCalls).toContainEqual([
      'exists',
      'participants',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active', 'confirmed', 'member', 'admin']],
      ],
    ]);
    expect(eventCalls.some(call => call[0] === 'exists' && call[1] === 'group')).toBe(true);
    expect(amendmentCalls).toContainEqual([
      'exists',
      'collaborators',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active', 'collaborator', 'member', 'admin']],
      ],
    ]);
    expect(amendmentCalls.some(call => call[0] === 'exists' && call[1] === 'group')).toBe(true);
    expect(amendmentCalls.some(call => call[0] === 'exists' && call[1] === 'event')).toBe(true);
  });
});
