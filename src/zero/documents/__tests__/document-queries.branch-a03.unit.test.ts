import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: [] as unknown[][] }));

function query(label: string): any {
  const value: Record<string, any> = {};
  const child = (relation: string) => query(`${label}.${relation}`);
  for (const method of ['where', 'whereExists', 'related', 'orderBy', 'start', 'limit']) {
    value[method] = (...args: unknown[]) => {
      state.calls.push([label, method, ...args]);
      for (const arg of args) {
        if (typeof arg === 'function') arg(child(String(args[0])));
      }
      return value;
    };
  }
  value.one = () => {
    state.calls.push([label, 'one']);
    return value;
  };
  return value;
}

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
}));
vi.mock('../../schema', () => ({
  zql: new Proxy({}, { get: (_target, property) => query(String(property)) }),
}));
vi.mock('../../rbac/query-access', () => ({
  applyDocumentQueryAccess: (value: unknown) => value,
}));

import { documentQueries } from '../queries';

const ctx = { userID: 'user', email: 'user@example.com' };

beforeEach(() => {
  state.calls = [];
});

describe('document queries exhaustive branch campaign A03', () => {
  it('covers forward empty filters and backward populated filters with a cursor', () => {
    documentQueries.pageByGroup.fn({
      args: {
        groupId: 'group',
        query: '',
        collaboratorId: undefined,
        status: undefined,
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx,
    });
    documentQueries.pageByGroup.fn({
      args: {
        groupId: 'group',
        query: ' budget ',
        collaboratorId: 'collaborator',
        status: 'active',
        limit: 10,
        start: { id: 'cursor', updated_at: 100 },
        dir: 'backward',
      },
      ctx,
    });
    expect(state.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['document', 'orderBy', 'updated_at', 'desc']),
        expect.arrayContaining(['document', 'orderBy', 'updated_at', 'asc']),
        expect.arrayContaining(['document', 'start']),
      ])
    );
  });

  it('executes every child-access and relation callback', () => {
    documentQueries.byId.fn({ args: { id: 'document' }, ctx });
    documentQueries.versions.fn({ args: { document_id: 'document' }, ctx });
    documentQueries.collaborators.fn({ args: { document_id: 'document' }, ctx });
    documentQueries.threads.fn({ args: { document_id: 'document' }, ctx });
    documentQueries.comments.fn({ args: { thread_id: 'thread' }, ctx });
    expect(state.calls.filter(call => call[1] === 'whereExists').length).toBeGreaterThanOrEqual(5);
  });
});
