import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createQueryHarness,
  evaluatePredicate,
  relatedCalls,
  type QueryCall,
} from './test-utils/zeroHarness';

const queryModules = [
  ['accreditation', '../accreditation/queries', 'accreditationQueries'],
  ['agendas', '../agendas/queries', 'agendaQueries'],
  ['ai', '../ai/queries', 'aiQueries'],
  ['amendments', '../amendments/queries', 'amendmentQueries'],
  ['blogs', '../blogs/queries', 'blogQueries'],
  ['calendarSubscriptions', '../calendar-subscriptions/queries', 'calendarSubscriptionQueries'],
  ['common', '../common/queries', 'commonQueries'],
  ['documents', '../documents/queries', 'documentQueries'],
  ['elections', '../elections/queries', 'electionQueries'],
  ['eurostat', '../eurostat/queries', 'eurostatQueries'],
  ['events', '../events/queries', 'eventQueries'],
  ['groups', '../groups/queries', 'groupQueries'],
  ['messages', '../messages/queries', 'messageQueries'],
  ['network', '../network/queries', 'networkQueries'],
  ['notifications', '../notifications/queries', 'notificationQueries'],
  ['payments', '../payments/queries', 'paymentQueries'],
  ['preferences', '../preferences/queries', 'preferenceQueries'],
  ['pql', '../pql/queries', 'pqlQueries'],
  ['rbac', '../rbac/queries', 'rbacQueries'],
  ['search', '../shared/queries', 'searchQueries'],
  ['statements', '../statements/queries', 'statementQueries'],
  ['todos', '../todos/queries', 'todoQueries'],
  ['users', '../users/queries', 'userQueries'],
  ['votes', '../votes/queries', 'voteQueries'],
  ['votingPassword', '../voting-password/queries', 'votingPasswordQueries'],
] as const;

type QueryRegistry = Record<string, { fn: (input: { args: unknown; ctx: unknown }) => unknown }>;

const ctx = { userID: 'user-1', email: 'user-1@example.com' };

const broadArgs = {
  id: 'id-1',
  ids: ['id-1', 'id-2'],
  userId: 'user-2',
  user_id: 'user-2',
  subscriber_id: 'user-2',
  recipient_id: 'user-1',
  sender_id: 'user-2',
  groupId: 'group-1',
  groupIds: ['group-1', 'group-2'],
  group_id: 'group-1',
  eventId: 'event-1',
  eventIds: ['event-1', 'event-2'],
  event_id: 'event-1',
  agendaItemId: 'agenda-item-1',
  agendaItemIds: ['agenda-item-1', 'agenda-item-2'],
  agenda_item_id: 'agenda-item-1',
  amendmentId: 'amendment-1',
  amendment_id: 'amendment-1',
  blogId: 'blog-1',
  blog_id: 'blog-1',
  statementId: 'statement-1',
  statement_id: 'statement-1',
  documentId: 'document-1',
  document_id: 'document-1',
  threadId: 'thread-1',
  thread_id: 'thread-1',
  commentId: 'comment-1',
  comment_id: 'comment-1',
  conversationId: 'conversation-1',
  conversation_id: 'conversation-1',
  messageId: 'message-1',
  message_id: 'message-1',
  electionId: 'election-1',
  election_id: 'election-1',
  voteId: 'vote-1',
  vote_id: 'vote-1',
  voter_id: 'voter-1',
  endpoint: 'https://push.example.test/endpoint',
  handle: 'ada',
  query: 'roadmap',
  limit: 20,
  offset: 0,
  code: 'DEMO',
  datasetId: 'dataset-1',
  dataset_id: 'dataset-1',
  projectionId: 'projection-1',
  projection_id: 'projection-1',
  scope_type: 'group',
  scope_id: 'group-1',
  entity_type: 'group',
  entity_id: 'group-1',
  entityTypes: ['group', 'event'],
  entityIds: ['group-1', 'event-1'],
  contentTypes: ['group', 'event'],
  types: ['group', 'event'],
  topics: ['governance'],
  createdAfter: null,
  engagement: 'all',
  sort: 'recent',
  direction: 'forward',
  start: null,
  snapshotAt: null,
  visibility: 'public',
  status: 'active',
  now: 1_700_000_000_000,
};

beforeEach(() => {
  vi.resetModules();
});

async function loadQueryRegistries() {
  const harness = createQueryHarness();

  vi.doMock('@rocicorp/zero', () => ({
    defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
  }));
  vi.doMock('../schema', () => ({
    zql: harness.zql,
  }));

  const registries: [string, QueryRegistry][] = [];
  for (const [label, modulePath, exportName] of queryModules) {
    const mod = (await import(modulePath)) as Record<string, unknown>;
    registries.push([label, mod[exportName] as QueryRegistry]);
  }

  return { harness, registries };
}

describe('Zero query contracts', () => {
  it('builds a stateless query shape for every exported domain query', async () => {
    const { harness, registries } = await loadQueryRegistries();
    const failures: string[] = [];
    let queryCount = 0;

    for (const [domain, registry] of registries) {
      for (const [name, query] of Object.entries(registry)) {
        harness.reset();

        try {
          query.fn({ args: broadArgs, ctx });
          queryCount += 1;
          if (Object.keys(harness.byTable).length === 0) {
            failures.push(`${domain}.${name} did not touch zql`);
          }
        } catch (error) {
          failures.push(
            `${domain}.${name}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    expect(failures).toEqual([]);
    expect(queryCount).toBeGreaterThan(180);
  });

  it('keeps searchable document paging stateless and deterministic', async () => {
    const { harness, registries } = await loadQueryRegistries();
    const searchQueries = registries.find(([domain]) => domain === 'search')?.[1];
    if (!searchQueries) throw new Error('search queries not loaded');

    searchQueries.searchDocumentPage.fn({
      args: {
        ...broadArgs,
        query: 'Budget_2026?',
        types: ['group'],
        topics: ['finance'],
        createdAfter: 1_600_000_000_000,
        engagement: 'popular',
        sort: 'engagement',
        direction: 'backward',
        start: {
          id: 'search-1',
          created_at: 1_700_000_000_000,
          engagement_score: 42,
        },
      },
      ctx,
    });

    const calls = harness.lastQuery('search_document').calls;
    expect(calls).toEqual(
      expect.arrayContaining([
        ['where', 'search_text', 'ILIKE', '%budget%2026%'],
        ['where', 'entity_type', 'IN', ['group']],
        ['whereExists', 'topics', [['where', 'topic', 'finance']]],
        ['where', 'created_at', '>=', 1_600_000_000_000],
        ['where', 'engagement_score', '>=', 5],
        ['orderBy', 'engagement_score', 'asc'],
        ['orderBy', 'created_at', 'asc'],
        ['orderBy', 'id', 'asc'],
        [
          'start',
          {
            id: 'search-1',
            created_at: 1_700_000_000_000,
            engagement_score: 42,
          },
          { inclusive: false },
        ],
        ['limit', 20],
      ])
    );
  });

  it('intersects spoofable user-scoped search queries with the authenticated user', async () => {
    const { harness, registries } = await loadQueryRegistries();
    const searchQueries = registries.find(([domain]) => domain === 'search')?.[1];
    if (!searchQueries) throw new Error('search queries not loaded');

    searchQueries.userGroupMemberships.fn({
      args: { ...broadArgs, user_id: 'attacker-user' },
      ctx,
    });

    expect(harness.lastQuery('group_membership').calls).toEqual(
      expect.arrayContaining([
        ['where', 'user_id', ctx.userID],
        ['where', 'user_id', 'attacker-user'],
      ])
    );
  });

  it('keeps rich user profile relations private unless they belong to the caller', async () => {
    const { harness, registries } = await loadQueryRegistries();
    const userQueries = registries.find(([domain]) => domain === 'users')?.[1];
    if (!userQueries) throw new Error('user queries not loaded');

    userQueries.fullProfile.fn({
      args: { ...broadArgs, id: 'other-user' },
      ctx,
    });

    const profileCalls = harness.lastQuery('user').calls;
    const membershipRoleCalls = relatedCalls(
      relatedCalls(profileCalls, 'group_memberships'),
      'membership_roles'
    );
    const bloggerRoleCalls = relatedCalls(relatedCalls(profileCalls, 'blogger_relations'), 'role');
    const amendmentCollabCalls = relatedCalls(profileCalls, 'amendment_collaborations');

    expect(membershipRoleCalls).toEqual(expect.arrayContaining([['where', 'id', '__private__']]));
    expect(bloggerRoleCalls).toEqual(expect.arrayContaining([['where', 'id', '__private__']]));
    expect(amendmentCollabCalls).toEqual(
      expect.arrayContaining([['where', 'user_id', ctx.userID]])
    );
  });

  it('preserves query-access predicates for anonymous and authenticated users', async () => {
    const { harness, registries } = await loadQueryRegistries();
    const groupQueries = registries.find(([domain]) => domain === 'groups')?.[1];
    if (!groupQueries) throw new Error('group queries not loaded');

    groupQueries.byId.fn({
      args: { ...broadArgs, id: 'group-1' },
      ctx: { userID: 'anon', email: '' },
    });
    expect(harness.lastQuery('group').calls).toEqual(
      expect.arrayContaining([
        ['where', 'id', 'group-1'],
        ['where', 'visibility', 'public'],
        ['one'],
      ])
    );

    harness.reset();
    groupQueries.byId.fn({
      args: { ...broadArgs, id: 'group-1' },
      ctx,
    });
    const predicate = harness
      .lastQuery('group')
      .calls.find(call => call[0] === 'where' && typeof call[1] === 'function')?.[1];
    const predicateCalls = evaluatePredicate(predicate);

    expect(predicateCalls).toEqual(
      expect.arrayContaining([
        ['cmp', 'visibility', 'IN', ['public', 'authenticated']],
        ['cmp', 'owner_id', ctx.userID],
        ['exists', 'memberships'],
        ['where', 'memberships', 'user_id', ctx.userID],
        ['exists', 'guest_accesses'],
        ['where', 'guest_accesses', 'user_id', ctx.userID],
      ] satisfies QueryCall[])
    );
  });
});
