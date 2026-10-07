import { beforeEach, expect, it, vi } from 'vitest';
import { createQueryHarness, evaluatePredicate } from '../../__tests__/test-utils/zeroHarness';
vi.mock('@rocicorp/zero', () => ({ defineQuery: (_schema: unknown, fn: unknown) => ({ fn }) }));
const io = vi.hoisted(() => ({ zql: {} as any }));
vi.mock('../../schema', () => ({ zql: new Proxy({}, { get: (_target, key) => io.zql[key] }) }));
import { projectChatQueries } from '../queries';
let harness: ReturnType<typeof createQueryHarness>;
beforeEach(() => {
  harness = createQueryHarness();
  io.zql = harness.zql;
});

it.each(['studio', 'amendment'] as const)(
  'lists only the requested %s project conversations under current access',
  kind => {
    const id = crypto.randomUUID();
    projectChatQueries.conversations.fn({
      args: kind === 'studio' ? { kind, projectId: id } : { kind, amendmentId: id },
      ctx: { userID: 'alice', email: '' },
    });
    const query = harness.lastQuery('conversation');
    expect(query.calls).toEqual(
      expect.arrayContaining([
        ['where', 'type', 'project_ai'],
        ['where', kind === 'studio' ? 'studio_project_id' : 'amendment_id', id],
        ['orderBy', 'created_at', 'desc'],
      ])
    );
    const access = evaluatePredicate(
      query.calls.find(call => call[0] === 'where' && typeof call[1] === 'function')?.[1]
    );
    expect(access).toContainEqual(['exists', 'studio_project']);
    expect(access).toContainEqual(['exists', 'amendment']);
    expect(access).toContainEqual(['where', 'collaborators', 'user_id', 'alice']);
    expect(access).toContainEqual(['where', 'collaborators', 'status', 'active']);
    expect(access).toContainEqual([
      'where',
      'collaborators',
      'status',
      'IN',
      ['active', 'collaborator', 'member', 'admin'],
    ]);
  }
);

it.each([
  ['runs', 'ai_run', 20],
  ['changes', 'ai_change_set', 100],
] as const)(
  'protects %s through the conversation relation and applies its bounded history limit',
  (name, table, limit) => {
    projectChatQueries[name].fn({
      args: { conversationId: 'conversation' },
      ctx: { userID: 'alice', email: '' },
    });
    expect(harness.lastQuery(table).calls).toEqual(
      expect.arrayContaining([
        ['where', 'conversation_id', 'conversation'],
        ['whereExists', 'conversation', expect.any(Array)],
        ['orderBy', 'created_at', 'desc'],
        ['limit', limit],
      ])
    );
    const related = harness.lastQuery(`${table}.conversation`);
    expect(related.calls).toContainEqual(['where', 'type', 'project_ai']);
    expect(
      JSON.stringify(
        evaluatePredicate(
          related.calls.find(call => call[0] === 'where' && typeof call[1] === 'function')?.[1]
        )
      )
    ).toContain('alice');
  }
);

it.each(['', 'anon'])('denies project conversation replication for identity %s', userID => {
  projectChatQueries.conversations.fn({
    args: { kind: 'studio', projectId: crypto.randomUUID() },
    ctx: { userID, email: '' },
  });
  expect(harness.lastQuery('conversation').calls).toContainEqual([
    'where',
    'id',
    '__unauthorized__',
  ]);
});
