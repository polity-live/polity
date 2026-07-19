import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createQueryHarness,
  evaluatePredicate,
  type QueryCall,
} from '../../__tests__/test-utils/zeroHarness';

const ctx = { userID: 'user-1', email: 'user-1@example.com' };

beforeEach(() => {
  vi.resetModules();
});

async function loadNotificationQueries() {
  const harness = createQueryHarness();

  vi.doMock('@rocicorp/zero', () => ({
    defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
  }));
  vi.doMock('../../schema', () => ({
    zql: harness.zql,
  }));

  const mod = await import('../queries');
  return { harness, notificationQueries: mod.notificationQueries };
}

function executeQuery(
  notificationQueries: unknown,
  queryName: string,
  args: unknown,
  queryCtx = ctx
) {
  const registry = notificationQueries as Record<
    string,
    { fn: (input: { args: unknown; ctx: typeof ctx }) => unknown }
  >;
  registry[queryName].fn({ args, ctx: queryCtx });
}

function accessCalls(calls: readonly QueryCall[]) {
  const accessCall = calls.find(call => call[0] === 'where' && typeof call[1] === 'function');
  expect(accessCall).toBeDefined();
  return evaluatePredicate(accessCall?.[1]);
}

function relatedNames(calls: readonly QueryCall[]) {
  return calls.filter(call => call[0] === 'related').map(call => call[1]);
}

const typedCases = [
  {
    queryName: 'byRecipientGroups',
    args: { groupIds: ['group-1'] },
    entityType: 'group',
    recipientRelation: 'recipient_group',
  },
  {
    queryName: 'byRecipientEvents',
    args: { eventIds: ['event-1'] },
    entityType: 'event',
    recipientRelation: 'recipient_event',
  },
  {
    queryName: 'byRecipientAmendments',
    args: { amendmentIds: ['amendment-1'] },
    entityType: 'amendment',
    recipientRelation: 'recipient_amendment',
  },
  {
    queryName: 'byRecipientBlogs',
    args: { blogIds: ['blog-1'] },
    entityType: 'blog',
    recipientRelation: 'recipient_blog',
  },
] as const;

const allRecipientRelations = [
  'recipient_group',
  'recipient_event',
  'recipient_amendment',
  'recipient_blog',
];

describe('notification recipient query authorization', () => {
  it('does not emit client-unsupported anti-existence predicates', async () => {
    const { harness, notificationQueries } = await loadNotificationQueries();

    notificationQueries.page.fn({
      args: {
        tab: 'unread',
        query: '',
        entityId: null,
        entityType: null,
        limit: 20,
        start: null,
        dir: 'forward',
      },
      ctx,
    });

    const predicateCalls = harness
      .lastQuery('notification')
      .calls.filter(call => call[0] === 'where' && typeof call[1] === 'function')
      .flatMap(call => evaluatePredicate(call[1]));
    expect(predicateCalls.some(call => call[0] === 'not')).toBe(false);
  });

  it('includes the recipient group relation in global page and item queries', async () => {
    const { harness, notificationQueries } = await loadNotificationQueries();

    notificationQueries.page.fn({
      args: {
        tab: 'all',
        query: '',
        entityId: null,
        entityType: null,
        limit: 20,
        start: null,
        dir: 'forward',
      },
      ctx,
    });

    expect(relatedNames(harness.lastQuery('notification').calls)).toContain('recipient_group');

    harness.reset();
    notificationQueries.byId.fn({ args: { id: 'notification-1' }, ctx });

    expect(relatedNames(harness.lastQuery('notification').calls)).toContain('recipient_group');
  });

  it.each(typedCases)(
    '$queryName keeps personal access and only the $entityType recipient path',
    async ({ queryName, args, recipientRelation }) => {
      const { harness, notificationQueries } = await loadNotificationQueries();

      executeQuery(notificationQueries, queryName, args);

      const rootCalls = harness.lastQuery('notification').calls;
      const predicateCalls = accessCalls(rootCalls);
      const relations = relatedNames(rootCalls);

      expect(predicateCalls).toContainEqual(['cmp', 'recipient_id', ctx.userID]);
      expect(predicateCalls).toContainEqual(['exists', recipientRelation]);
      expect(predicateCalls).not.toEqual(
        expect.arrayContaining(
          allRecipientRelations
            .filter(relation => relation !== recipientRelation)
            .map(relation => ['exists', relation])
        )
      );

      expect(relations).toEqual(
        expect.arrayContaining([
          'sender',
          'recipient',
          'related_user',
          'related_group',
          'related_event',
          'related_amendment',
          'related_blog',
          'on_behalf_of_group',
          'on_behalf_of_event',
          'on_behalf_of_amendment',
          'on_behalf_of_blog',
          'reads',
          recipientRelation,
        ])
      );
      expect(
        relations.filter(relation => allRecipientRelations.includes(String(relation)))
      ).toEqual([recipientRelation]);
      expect(rootCalls).toEqual(
        expect.arrayContaining([
          ['orderBy', 'created_at', 'desc'],
          ['limit', 50],
        ])
      );
    }
  );

  it.each(typedCases)('$queryName denies anonymous callers', async ({ queryName, args }) => {
    const { harness, notificationQueries } = await loadNotificationQueries();

    executeQuery(notificationQueries, queryName, args, {
      userID: 'anon',
      email: 'anon@example.com',
    });

    expect(harness.lastQuery('notification').calls).toContainEqual([
      'where',
      'id',
      '__unauthorized__',
    ]);
  });

  it('preserves active amendment collaborator authorization and relation filtering', async () => {
    const { harness, notificationQueries } = await loadNotificationQueries();

    notificationQueries.byRecipientAmendments.fn({
      args: { amendmentIds: ['amendment-1'] },
      ctx,
    });

    const predicateCalls = accessCalls(harness.lastQuery('notification').calls);
    expect(predicateCalls).toEqual(
      expect.arrayContaining([
        ['cmp', 'created_by_id', ctx.userID],
        ['exists', 'collaborators'],
        ['where', 'collaborators', 'user_id', ctx.userID],
        ['where', 'collaborators', 'status', 'IN', ['active', 'collaborator', 'member', 'admin']],
      ])
    );

    const collaboratorCalls = harness.lastQuery(
      'notification.recipient_amendment.collaborators'
    ).calls;
    expect(collaboratorCalls).toContainEqual([
      'where',
      'status',
      'IN',
      ['active', 'collaborator', 'member', 'admin'],
    ]);
  });

  it.each(typedCases)(
    'byEntity selects the $entityType-specific access and recipient relation',
    async ({ entityType, recipientRelation }) => {
      const { harness, notificationQueries } = await loadNotificationQueries();

      notificationQueries.byEntity.fn({
        args: { entityId: `${entityType}-1`, entityType },
        ctx,
      });

      const rootCalls = harness.lastQuery('notification').calls;
      expect(accessCalls(rootCalls)).toContainEqual(['exists', recipientRelation]);
      expect(
        relatedNames(rootCalls).filter(relation => allRecipientRelations.includes(String(relation)))
      ).toEqual([recipientRelation]);
      expect(rootCalls).toEqual(
        expect.arrayContaining([
          ['orderBy', 'created_at', 'desc'],
          ['limit', 200],
        ])
      );
    }
  );

  it('byEntity keeps the generic access and relation fallback for unknown entity types', async () => {
    const { harness, notificationQueries } = await loadNotificationQueries();

    notificationQueries.byEntity.fn({
      args: { entityId: 'todo-1', entityType: 'todo' },
      ctx,
    });

    const rootCalls = harness.lastQuery('notification').calls;
    const predicateCalls = accessCalls(rootCalls);
    const relations = relatedNames(rootCalls);

    for (const relation of allRecipientRelations) {
      expect(predicateCalls).toContainEqual(['exists', relation]);
      expect(relations).toContain(relation);
    }
  });
});
