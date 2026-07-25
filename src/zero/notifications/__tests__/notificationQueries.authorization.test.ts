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

function childCalls(calls: readonly QueryCall[], method: string, relation: string) {
  const call = calls.find(item => item[0] === method && item[1] === relation);
  expect(call, `${method}(${relation})`).toBeDefined();
  return call?.[2] as QueryCall[];
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

const selectiveCounterCases = [
  {
    queryName: 'countByGroupOwner',
    table: 'group',
    entityType: 'group',
    entityIdField: 'id',
    userField: 'owner_id',
    entityRelation: null,
    status: null,
  },
  {
    queryName: 'countByGroupMembership',
    table: 'group_membership',
    entityType: 'group',
    entityIdField: 'group_id',
    userField: 'user_id',
    entityRelation: 'group',
    status: ['active', 'member', 'admin'],
  },
  {
    queryName: 'countByGroupGuest',
    table: 'group_guest_access',
    entityType: 'group',
    entityIdField: 'group_id',
    userField: 'user_id',
    entityRelation: 'group',
    status: ['active'],
  },
  {
    queryName: 'countByEventParticipant',
    table: 'event_participant',
    entityType: 'event',
    entityIdField: 'event_id',
    userField: 'user_id',
    entityRelation: 'event',
    status: ['active', 'confirmed', 'member', 'admin'],
  },
  {
    queryName: 'countByAmendmentCreator',
    table: 'amendment',
    entityType: 'amendment',
    entityIdField: 'id',
    userField: 'created_by_id',
    entityRelation: null,
    status: null,
  },
  {
    queryName: 'countByAmendmentCollaborator',
    table: 'amendment_collaborator',
    entityType: 'amendment',
    entityIdField: 'amendment_id',
    userField: 'user_id',
    entityRelation: 'amendment',
    status: ['active', 'collaborator', 'member', 'admin'],
  },
  {
    queryName: 'countByBlogBlogger',
    table: 'blog_blogger',
    entityType: 'blog',
    entityIdField: 'blog_id',
    userField: 'user_id',
    entityRelation: 'blog',
    status: null,
  },
] as const;

describe('notification recipient query authorization', () => {
  it('uses direct viewer-scoped access for personal notification queries', async () => {
    const { harness, notificationQueries } = await loadNotificationQueries();

    notificationQueries.byUser.fn({ args: {}, ctx });

    let calls = harness.lastQuery('notification').calls;
    expect(calls.filter(call => call[0] === 'where' && call[1] === 'recipient_id')).toEqual([
      ['where', 'recipient_id', ctx.userID],
    ]);
    expect(
      calls
        .filter(call => call[0] === 'where' && typeof call[1] === 'function')
        .flatMap(call => evaluatePredicate(call[1]))
        .some(call => call[0] === 'exists')
    ).toBe(false);

    harness.reset();
    notificationQueries.byUserWithRelations.fn({ args: {}, ctx });

    calls = harness.lastQuery('notification').calls;
    expect(calls.filter(call => call[0] === 'where' && call[1] === 'recipient_id')).toEqual([
      ['where', 'recipient_id', ctx.userID],
    ]);
    expect(relatedNames(calls)).toEqual(expect.arrayContaining(allRecipientRelations));
  });

  it('uses the direct viewer path for the unscoped personal page tab', async () => {
    const { harness, notificationQueries } = await loadNotificationQueries();

    notificationQueries.page.fn({
      args: {
        tab: 'personal',
        query: '',
        entityId: null,
        entityType: null,
        limit: 20,
        start: null,
        dir: 'forward',
      },
      ctx,
    });

    const calls = harness.lastQuery('notification').calls;
    expect(calls.filter(call => call[0] === 'where' && call[1] === 'recipient_id')).toEqual([
      ['where', 'recipient_id', ctx.userID],
    ]);
    expect(
      calls
        .filter(call => call[0] === 'where' && typeof call[1] === 'function')
        .flatMap(call => evaluatePredicate(call[1]))
        .some(call => call[0] === 'exists')
    ).toBe(false);
  });

  it('uses a lean read-state-only projection for all tab counters', async () => {
    const { harness, notificationQueries } = await loadNotificationQueries();

    notificationQueries.countProjection.fn({
      args: {
        query: '',
        entityId: null,
        entityType: null,
      },
      ctx,
    });

    const calls = harness.lastQuery('notification').calls;
    expect(relatedNames(calls)).toEqual(['reads', 'viewer_state']);
    expect(accessCalls(calls)).toEqual(
      expect.arrayContaining([
        ['cmp', 'recipient_id', ctx.userID],
        ['exists', 'recipient_group'],
        ['exists', 'recipient_event'],
        ['exists', 'recipient_amendment'],
        ['exists', 'recipient_blog'],
      ])
    );
  });

  it('uses the entity-specific ACL path for scoped counter projections', async () => {
    const { harness, notificationQueries } = await loadNotificationQueries();

    notificationQueries.countProjection.fn({
      args: {
        query: '',
        entityId: 'group-1',
        entityType: 'group',
      },
      ctx,
    });

    const calls = harness.lastQuery('notification').calls;
    const predicateCalls = accessCalls(calls);
    expect(predicateCalls).toContainEqual(['exists', 'recipient_group']);
    expect(predicateCalls).not.toContainEqual(['exists', 'recipient_event']);
    expect(relatedNames(calls)).toEqual(['reads', 'viewer_state']);
  });

  it.each(selectiveCounterCases)(
    '$queryName starts at the selective access row and loads only scoped notifications',
    async ({ queryName, table, entityType, entityIdField, userField, entityRelation, status }) => {
      const { harness, notificationQueries } = await loadNotificationQueries();
      const entityId = `${entityType}-1`;

      executeQuery(notificationQueries, queryName, { entityId, query: 'needle' });

      const rootCalls = harness.lastQuery(table).calls;
      expect(rootCalls).toContainEqual(['where', userField, ctx.userID]);
      expect(rootCalls).toContainEqual(['where', entityIdField, entityId]);
      if (status) {
        expect(rootCalls).toContainEqual(['where', 'status', 'IN', [...status]]);
        expect(rootCalls.some(call => call[0] === 'whereExists')).toBe(true);
      }

      const entityCalls = entityRelation
        ? childCalls(rootCalls, 'related', entityRelation)
        : rootCalls;
      const notificationCalls = childCalls(entityCalls, 'related', 'recipient_notifications');

      expect(notificationCalls).toEqual(
        expect.arrayContaining([
          ['where', 'recipient_entity_id', entityId],
          ['where', 'recipient_entity_type', entityType],
          ['related', 'reads', [['where', 'read_by_user_id', ctx.userID]]],
          ['related', 'viewer_state', [['where', 'user_id', ctx.userID]]],
          ['orderBy', 'created_at', 'desc'],
          ['orderBy', 'id', 'desc'],
        ])
      );
      expect(
        notificationCalls.filter(call => call[0] === 'where' && typeof call[1] === 'function')
      ).toHaveLength(2);
      expect(harness.queriesFor('notification')).toHaveLength(0);
    }
  );

  it.each(selectiveCounterCases)(
    '$queryName denies anonymous access before materializing notifications',
    async ({ queryName, table, entityType }) => {
      const { harness, notificationQueries } = await loadNotificationQueries();

      executeQuery(
        notificationQueries,
        queryName,
        { entityId: `${entityType}-1`, query: '' },
        { userID: 'anon', email: 'anon@example.com' }
      );

      expect(harness.lastQuery(table).calls).toContainEqual(['where', 'id', '__unauthorized__']);
    }
  );

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
