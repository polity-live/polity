import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

interface Query {
  table: string;
  filters: [string, string, unknown][];
  single: boolean;
  where: (field: string, opOrValue: unknown, maybeValue?: unknown) => Query;
  orderBy: () => Query;
  one: () => Query;
}

const mocks = vi.hoisted(() => ({
  tables: new Map<string, Row[]>(),
  mutations: [] as { table: string; operation: string; value: Row }[],
  groupMembers: vi.fn(),
  signedUpMembers: vi.fn(),
  eventParticipants: vi.fn(),
}));

function query(table: string): Query {
  const value: Query = {
    table,
    filters: [],
    single: false,
    where(field, opOrValue, maybeValue) {
      value.filters.push([
        field,
        maybeValue === undefined ? '=' : String(opOrValue),
        maybeValue === undefined ? opOrValue : maybeValue,
      ]);
      return value;
    },
    orderBy: () => value,
    one: () => {
      value.single = true;
      return value;
    },
  };
  return value;
}

function read(value: Query) {
  const rows = (mocks.tables.get(value.table) ?? []).filter(row =>
    value.filters.every(([field, operator, expected]) =>
      operator === 'IN' ? (expected as unknown[]).includes(row[field]) : row[field] === expected
    )
  );
  return value.single ? (rows[0] ?? null) : rows;
}

function mutationTable(table: string) {
  return {
    insert: vi.fn(async (value: Row) => {
      mocks.mutations.push({ table, operation: 'insert', value });
    }),
    update: vi.fn(async (value: Row) => {
      mocks.mutations.push({ table, operation: 'update', value });
    }),
    delete: vi.fn(async (value: Row) => {
      mocks.mutations.push({ table, operation: 'delete', value });
    }),
  };
}

const tx = {
  run: vi.fn(async (value: Query) => read(value)),
  mutate: {
    conversation: mutationTable('conversation'),
    conversation_participant: mutationTable('conversation_participant'),
    user: mutationTable('user'),
    group: mutationTable('group'),
    event: mutationTable('event'),
    amendment: mutationTable('amendment'),
    blog: mutationTable('blog'),
  },
};

vi.mock('../schema', () => ({
  zql: new Proxy({}, { get: (_target, table) => query(String(table)) }),
}));
vi.mock('../offline-roster-helpers', () => ({
  computeDistinctEventParticipantCount: mocks.eventParticipants,
  computeDistinctGroupMemberCount: mocks.groupMembers,
  computeDistinctSignedUpGroupMemberCount: mocks.signedUpMembers,
}));

import {
  amendmentTitle,
  blogTitle,
  ensureEventConversation,
  ensureGroupConversation,
  eventTitle,
  groupName,
  isActiveEventStatus,
  isActiveGroupGuestStatus,
  isActiveGroupStatus,
  isOwnedAppTutorialAgendaItem,
  recomputeAmendmentCounters,
  recomputeBlogCounters,
  recomputeEventCounters,
  recomputeEventEndDate,
  recomputeGroupCounters,
  recomputeUserCounters,
  requireConfiguredRecentVotingPasswordVerification,
  requireRecentVotingPasswordVerification,
  roleName,
  syncUserWithEventConversation,
  syncUserWithGroupConversation,
  userName,
} from '../server-helpers';

function setRows(table: string, rows: Row[]) {
  mocks.tables.set(table, rows);
}

function lastMutation(table: string, operation = 'update') {
  return [...mocks.mutations]
    .reverse()
    .find(item => item.table === table && item.operation === operation)?.value;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tables.clear();
  mocks.mutations.length = 0;
  mocks.groupMembers.mockResolvedValue(3);
  mocks.signedUpMembers.mockResolvedValue(2);
  mocks.eventParticipants.mockResolvedValue(4);
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

describe('server helper status and voting guards', () => {
  it('recognizes active group, guest and event statuses including nulls', () => {
    expect(isActiveGroupStatus('active')).toBe(true);
    expect(isActiveGroupStatus('member')).toBe(true);
    expect(isActiveGroupStatus(null)).toBe(false);
    expect(isActiveEventStatus('confirmed')).toBe(true);
    expect(isActiveEventStatus(undefined)).toBe(false);
    expect(isActiveGroupGuestStatus('active')).toBe(true);
    expect(isActiveGroupGuestStatus(null)).toBe(false);
  });

  it('allows missing or recently verified optional voting PINs and rejects stale PINs', async () => {
    await expect(
      requireRecentVotingPasswordVerification(tx as never, 'user-1')
    ).resolves.toBeUndefined();
    setRows('voting_password', [{ user_id: 'user-1', last_verified_at: null }]);
    await expect(requireRecentVotingPasswordVerification(tx as never, 'user-1')).rejects.toThrow(
      'verify your voting PIN'
    );
    setRows('voting_password', [{ user_id: 'user-1', last_verified_at: Date.now() - 2_000 }]);
    await expect(
      requireRecentVotingPasswordVerification(tx as never, 'user-1', 1_000)
    ).rejects.toThrow('verify your voting PIN');
    setRows('voting_password', [{ user_id: 'user-1', last_verified_at: Date.now() - 500 }]);
    await expect(
      requireRecentVotingPasswordVerification(tx as never, 'user-1', 1_000)
    ).resolves.toBeUndefined();
  });

  it('requires configured and recent PINs for candidacy changes', async () => {
    await expect(
      requireConfiguredRecentVotingPasswordVerification(tx as never, 'user-1')
    ).rejects.toThrow('set your voting PIN');
    setRows('voting_password', [{ user_id: 'user-1', last_verified_at: 0 }]);
    await expect(
      requireConfiguredRecentVotingPasswordVerification(tx as never, 'user-1')
    ).rejects.toThrow('verify your voting PIN');
    setRows('voting_password', [{ user_id: 'user-1', last_verified_at: Date.now() }]);
    await expect(
      requireConfiguredRecentVotingPasswordVerification(tx as never, 'user-1', 500)
    ).resolves.toBeUndefined();
  });
});

describe('tutorial ownership and display-name lookups', () => {
  it('validates every tutorial agenda ownership boundary and active or paused runs', async () => {
    await expect(isOwnedAppTutorialAgendaItem(tx as never, null, 'user-1')).resolves.toBe(false);
    await expect(isOwnedAppTutorialAgendaItem(tx as never, 'missing', 'user-1')).resolves.toBe(
      false
    );
    setRows('agenda_item', [{ id: 'agenda-1', event_id: null }]);
    await expect(isOwnedAppTutorialAgendaItem(tx as never, 'agenda-1', 'user-1')).resolves.toBe(
      false
    );
    setRows('agenda_item', [{ id: 'agenda-1', event_id: 'event-1' }]);
    setRows('event', [{ id: 'event-1', tutorial_run_id: null }]);
    await expect(isOwnedAppTutorialAgendaItem(tx as never, 'agenda-1', 'user-1')).resolves.toBe(
      false
    );
    setRows('event', [{ id: 'event-1', tutorial_run_id: 'run-1' }]);
    setRows('app_tutorial_run', [{ id: 'run-1', user_id: 'user-1', status: 'completed' }]);
    await expect(isOwnedAppTutorialAgendaItem(tx as never, 'agenda-1', 'user-1')).resolves.toBe(
      false
    );
    setRows('app_tutorial_run', [{ id: 'run-1', user_id: 'user-1', status: 'active' }]);
    await expect(isOwnedAppTutorialAgendaItem(tx as never, 'agenda-1', 'user-1')).resolves.toBe(
      true
    );
    setRows('app_tutorial_run', [{ id: 'run-1', user_id: 'user-1', status: 'paused' }]);
    await expect(isOwnedAppTutorialAgendaItem(tx as never, 'agenda-1', 'user-1')).resolves.toBe(
      true
    );
  });

  it('returns entity titles and their fallbacks', async () => {
    setRows('group', [{ id: 'group-1', name: 'Group one' }]);
    setRows('event', [{ id: 'event-1', title: 'Event one' }]);
    setRows('amendment', [{ id: 'amendment-1', title: 'Amendment one' }]);
    setRows('blog', [{ id: 'blog-1', title: 'Blog one' }]);
    await expect(groupName(tx as never, 'group-1')).resolves.toBe('Group one');
    await expect(eventTitle(tx as never, 'event-1')).resolves.toBe('Event one');
    await expect(amendmentTitle(tx as never, 'amendment-1')).resolves.toBe('Amendment one');
    await expect(blogTitle(tx as never, 'blog-1')).resolves.toBe('Blog one');
    await expect(groupName(tx as never, 'missing')).resolves.toBe('Group');
    await expect(eventTitle(tx as never, 'missing')).resolves.toBe('Event');
    await expect(amendmentTitle(tx as never, 'missing')).resolves.toBe('Amendment');
    await expect(blogTitle(tx as never, 'missing')).resolves.toBe('Blog');
  });

  it('formats user names and role scope fallbacks', async () => {
    setRows('user', [{ id: 'full', first_name: 'Ada', last_name: 'Lovelace' }]);
    await expect(userName(tx as never, 'full')).resolves.toBe('Ada Lovelace');
    setRows('user', [
      { id: 'email', first_name: null, last_name: null, email: 'ada@example.test' },
    ]);
    await expect(userName(tx as never, 'email')).resolves.toBe('ada');
    await expect(userName(tx as never, 'missing')).resolves.toBe('A user');

    setRows('role', [
      {
        id: 'role-1',
        name: 'Chair',
        group_id: 'group-1',
        event_id: 'event-1',
        amendment_id: 'amendment-1',
        blog_id: 'blog-1',
      },
    ]);
    await expect(roleName(tx as never, 'role-1')).resolves.toEqual({
      name: 'Chair',
      groupId: 'group-1',
      eventId: 'event-1',
      amendmentId: 'amendment-1',
      blogId: 'blog-1',
    });
    await expect(roleName(tx as never, 'missing')).resolves.toEqual({
      name: 'Role',
      groupId: null,
      eventId: null,
      amendmentId: null,
      blogId: null,
    });
  });
});

describe('conversation creation and participant synchronization', () => {
  it('reuses and creates group and event conversations with default and explicit fields', async () => {
    setRows('conversation', [{ id: 'existing', group_id: 'group-1', type: 'group' }]);
    await expect(
      ensureGroupConversation(tx as never, { groupId: 'group-1', requestedById: 'user-1' })
    ).resolves.toBe('existing');
    setRows('conversation', []);
    await ensureGroupConversation(tx as never, {
      groupId: 'group-2',
      requestedById: 'user-1',
      name: '  Group chat  ',
      createdAt: 123,
    });
    expect(lastMutation('conversation', 'insert')).toMatchObject({
      name: 'Group chat',
      created_at: 123,
    });
    await ensureGroupConversation(tx as never, {
      groupId: 'group-3',
      requestedById: 'user-1',
      name: ' ',
    });
    expect(lastMutation('conversation', 'insert')).toMatchObject({ name: 'Group Chat' });

    setRows('conversation', [{ id: 'event-existing', event_id: 'event-1', type: 'event' }]);
    await expect(
      ensureEventConversation(tx as never, { eventId: 'event-1', requestedById: 'user-1' })
    ).resolves.toBe('event-existing');
    setRows('conversation', []);
    await ensureEventConversation(tx as never, {
      eventId: 'event-2',
      requestedById: 'user-1',
      name: ' Event chat ',
      createdAt: 456,
    });
    expect(lastMutation('conversation', 'insert')).toMatchObject({
      name: 'Event chat',
      created_at: 456,
    });
    await ensureEventConversation(tx as never, { eventId: 'event-3', requestedById: 'user-1' });
    expect(lastMutation('conversation', 'insert')).toMatchObject({ name: 'Event Chat' });
  });

  it('adds, reactivates, retains and removes group conversation participants', async () => {
    await syncUserWithGroupConversation(tx as never, { groupId: 'missing', userId: 'user-1' });
    expect(mocks.mutations).toEqual([]);

    setRows('conversation', [{ id: 'conversation-1', group_id: 'group-1', type: 'group' }]);
    setRows('group_membership', [{ group_id: 'group-1', user_id: 'user-1', status: 'active' }]);
    setRows('group_guest_access', []);
    setRows('conversation_participant', []);
    await syncUserWithGroupConversation(tx as never, { groupId: 'group-1', userId: 'user-1' });
    expect(lastMutation('conversation_participant', 'insert')).toMatchObject({
      user_id: 'user-1',
      left_at: null,
    });

    setRows('conversation_participant', [
      { id: 'participant-1', conversation_id: 'conversation-1', user_id: 'user-1', left_at: 123 },
    ]);
    await syncUserWithGroupConversation(tx as never, { groupId: 'group-1', userId: 'user-1' });
    expect(lastMutation('conversation_participant')).toEqual({
      id: 'participant-1',
      left_at: null,
    });

    setRows('conversation_participant', [
      { id: 'participant-1', conversation_id: 'conversation-1', user_id: 'user-1', left_at: null },
    ]);
    await syncUserWithGroupConversation(tx as never, { groupId: 'group-1', userId: 'user-1' });

    setRows('group_membership', [{ group_id: 'group-1', user_id: 'user-1', status: 'inactive' }]);
    setRows('group_guest_access', [{ group_id: 'group-1', user_id: 'user-1', status: 'active' }]);
    setRows('conversation_participant', []);
    await syncUserWithGroupConversation(tx as never, { groupId: 'group-1', userId: 'user-1' });
    expect(lastMutation('conversation_participant', 'insert')).toBeTruthy();

    setRows('group_guest_access', []);
    setRows('conversation_participant', [
      { id: 'participant-1', conversation_id: 'conversation-1', user_id: 'user-1' },
    ]);
    await syncUserWithGroupConversation(tx as never, { groupId: 'group-1', userId: 'user-1' });
    expect(lastMutation('conversation_participant', 'delete')).toEqual({ id: 'participant-1' });
    setRows('conversation_participant', []);
    await syncUserWithGroupConversation(tx as never, { groupId: 'group-1', userId: 'user-1' });
  });

  it('adds and removes event conversation participants', async () => {
    await syncUserWithEventConversation(tx as never, { eventId: 'missing', userId: 'user-1' });
    setRows('conversation', [{ id: 'conversation-1', event_id: 'event-1', type: 'event' }]);
    setRows('event_participant', [{ event_id: 'event-1', user_id: 'user-1', status: 'confirmed' }]);
    setRows('conversation_participant', []);
    await syncUserWithEventConversation(tx as never, { eventId: 'event-1', userId: 'user-1' });
    expect(lastMutation('conversation_participant', 'insert')).toBeTruthy();
    setRows('event_participant', [{ event_id: 'event-1', user_id: 'user-1', status: 'cancelled' }]);
    setRows('conversation_participant', [
      { id: 'participant-1', conversation_id: 'conversation-1', user_id: 'user-1' },
    ]);
    await syncUserWithEventConversation(tx as never, { eventId: 'event-1', userId: 'user-1' });
    expect(lastMutation('conversation_participant', 'delete')).toEqual({ id: 'participant-1' });
  });
});

describe('counter recomputation', () => {
  it('recomputes user and group counters with derived, active and cancelled filtering', async () => {
    setRows('subscriber', [{ user_id: 'user-1' }, { user_id: 'user-1' }]);
    setRows('group_membership', [
      { user_id: 'user-1', status: 'active', source: 'direct' },
      { user_id: 'user-1', status: 'active', source: 'derived' },
      { user_id: 'user-1', status: 'inactive', source: 'direct' },
    ]);
    setRows('amendment', [{ created_by_id: 'user-1' }]);
    await recomputeUserCounters(tx as never, 'user-1');
    expect(lastMutation('user')).toMatchObject({
      subscriber_count: 2,
      group_count: 1,
      amendment_count: 1,
    });

    setRows('subscriber', [{ group_id: 'group-1' }]);
    setRows('event', [
      { group_id: 'group-1', status: 'scheduled' },
      { group_id: 'group-1', status: 'cancelled' },
    ]);
    setRows('amendment', [{ group_id: 'group-1' }]);
    await recomputeGroupCounters(tx as never, 'group-1');
    expect(lastMutation('group')).toMatchObject({
      member_count: 3,
      signed_up_member_count: 2,
      event_count: 1,
    });
  });

  it('projects event end dates from configured, default, completed and explicit end times', async () => {
    await recomputeEventEndDate(tx as never, 'missing');
    setRows('event', [{ id: 'event-1', start_date: null }]);
    await recomputeEventEndDate(tx as never, 'event-1');
    setRows('event', [{ id: 'event-1', start_date: 1_000, end_date: 10_000_000 }]);
    setRows('agenda_item', [
      { event_id: 'event-1', duration: 10, completed_at: 2_000, end_time: null },
      { event_id: 'event-1', duration: null, completed_at: null, end_time: 3_000 },
      { event_id: 'event-1', duration: 5, completed_at: null, end_time: null },
    ]);
    await recomputeEventEndDate(tx as never, 'event-1');
    const previousUpdates = mocks.mutations.length;
    setRows('event', [{ id: 'event-1', start_date: 1_000, end_date: null }]);
    await recomputeEventEndDate(tx as never, 'event-1');
    expect(mocks.mutations.length).toBeGreaterThan(previousUpdates);
    expect(lastMutation('event')?.end_date).toBeGreaterThan(3_000);
  });

  it('recomputes event counters for empty and populated agenda graphs', async () => {
    setRows('subscriber', [{ event_id: 'event-1' }]);
    setRows('agenda_item', []);
    await recomputeEventCounters(tx as never, 'event-1');
    expect(lastMutation('event')).toMatchObject({
      election_count: 0,
      amendment_count: 0,
      open_change_request_count: 0,
    });

    setRows('agenda_item', [
      { id: 'agenda-1', event_id: 'event-1', amendment_id: 'amendment-1' },
      { id: 'agenda-2', event_id: 'event-1', amendment_id: 'amendment-1' },
    ]);
    setRows('election', [{ agenda_item_id: 'agenda-1' }]);
    setRows('change_request', [
      { amendment_id: 'amendment-1', status: null, obsolete_at: null, obsolete_reason: null },
      { amendment_id: 'amendment-1', status: 'open', obsolete_at: 1, obsolete_reason: null },
      { amendment_id: 'amendment-1', status: 'closed', obsolete_at: null, obsolete_reason: null },
      {
        amendment_id: 'amendment-1',
        status: 'open',
        obsolete_at: null,
        obsolete_reason: 'duplicate',
      },
    ]);
    await recomputeEventCounters(tx as never, 'event-1');
    expect(lastMutation('event')).toMatchObject({
      election_count: 1,
      amendment_count: 2,
      open_change_request_count: 1,
    });
  });

  it('recomputes amendment and blog vote, collaborator and comment counters', async () => {
    setRows('amendment_collaborator', [
      { amendment_id: 'amendment-1', status: 'collaborator' },
      { amendment_id: 'amendment-1', status: null },
    ]);
    setRows('subscriber', [{ amendment_id: 'amendment-1' }]);
    setRows('amendment', [{ clone_source_id: 'amendment-1' }]);
    setRows('change_request', [{ amendment_id: 'amendment-1' }]);
    setRows('amendment_support_vote', [
      { amendment_id: 'amendment-1', vote: null },
      { amendment_id: 'amendment-1', vote: 1 },
      { amendment_id: 'amendment-1', vote: -1 },
      { amendment_id: 'amendment-1', vote: 0 },
    ]);
    await recomputeAmendmentCounters(tx as never, 'amendment-1');
    expect(lastMutation('amendment')).toMatchObject({
      upvotes: 2,
      downvotes: 1,
      collaborator_count: 1,
    });

    setRows('subscriber', [{ blog_id: 'blog-1' }]);
    setRows('blog_support_vote', [
      { blog_id: 'blog-1', vote: null },
      { blog_id: 'blog-1', vote: 1 },
      { blog_id: 'blog-1', vote: -1 },
    ]);
    setRows('thread', []);
    await recomputeBlogCounters(tx as never, 'blog-1');
    expect(lastMutation('blog')).toMatchObject({ supporter_count: 1, comment_count: 0 });
    setRows('thread', [{ id: 'thread-1', blog_id: 'blog-1' }]);
    setRows('comment', [{ thread_id: 'thread-1' }, { thread_id: 'thread-1' }]);
    await recomputeBlogCounters(tx as never, 'blog-1');
    expect(lastMutation('blog')).toMatchObject({ comment_count: 2 });
  });
});
