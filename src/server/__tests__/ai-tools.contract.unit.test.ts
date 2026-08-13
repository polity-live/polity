import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

interface TestQuery {
  table: string;
  where: (...args: any[]) => TestQuery;
  orderBy: (...args: any[]) => TestQuery;
  limit: (...args: any[]) => TestQuery;
  one: () => TestQuery;
}

const mocks = vi.hoisted(() => ({
  results: [] as unknown[],
  checkAccess: vi.fn(),
  readDocs: vi.fn(),
  timelineCard: vi.fn(),
  richText: vi.fn((value: unknown) =>
    typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value)
  ),
}));

function createQuery(table: string): TestQuery {
  const query: TestQuery = {
    table,
    where: (...args) => {
      if (typeof args[0] === 'function') {
        args[0]({
          cmp: (...parts: unknown[]) => parts,
          or: (...parts: unknown[]) => parts,
        });
      }
      return query;
    },
    orderBy: () => query,
    limit: () => query,
    one: () => query,
  };
  return query;
}

const transaction = {
  run: vi.fn(async (_query: TestQuery) => mocks.results.shift()),
};

vi.mock('@/zero/schema', () => ({
  zql: new Proxy({}, { get: (_target, table) => createQuery(String(table)) }),
}));
vi.mock('@/server/zero-mutate', () => ({
  executeZeroRead: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
    callback(transaction),
}));
vi.mock('@/features/auth/logic/checkEntityAccess', () => ({
  checkEntityAccess: mocks.checkAccess,
}));
vi.mock('@/features/docs/logic/aiDocsIndex', () => ({
  AI_DOCS_LANGUAGES: ['de', 'en'],
  AI_DOCS_PAGE_SLUGS: ['overview', 'groups'],
  readPolityDocs: mocks.readDocs,
}));
vi.mock('@/features/shared/logic/richText', () => ({ richTextToPlainText: mocks.richText }));
vi.mock('@/features/search/logic/buildTimelineCardProps', () => ({
  buildTimelineCardProps: mocks.timelineCard,
}));
vi.mock('@/lib/ai/entityHref', () => ({
  buildAiEntityHref: (type: string, id: string) => `/${type}/${id}`,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/logic/currency', () => ({
  formatCurrencyMajor: (value: number, currency: string) => `${value} ${currency}`,
}));
vi.mock('../ai-create-tools', () => ({ buildAiCreateTools: () => ({}) }));
vi.mock('../ai-update-tools', () => ({ buildAiUpdateTools: () => ({}) }));

import { buildAiTools, buildCurrentUserScopePrompt } from '../ai-tools';

type ToolName = keyof ReturnType<typeof buildAiTools>;

function queue(...results: unknown[]) {
  mocks.results.push(...results);
}

async function execute(name: ToolName, input: unknown) {
  const selected = buildAiTools('user-1', 'Europe/Berlin')[name] as unknown as {
    execute: (value: unknown, options?: unknown) => Promise<Row>;
  };
  return selected.execute(input, {});
}

const now = Date.UTC(2026, 0, 15, 12);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.results.length = 0;
  mocks.checkAccess.mockImplementation((visibility: string | null) => visibility !== 'denied');
  mocks.timelineCard.mockImplementation((item: Row) =>
    item.id === 'no-card'
      ? { cardType: null, cardProps: null }
      : { cardType: item.type, cardProps: { id: item.id } }
  );
  mocks.readDocs.mockReturnValue({ query: null, pages: [], matches: [] });
  vi.setSystemTime(now);
});

describe('cross-entity AI search', () => {
  it('loads relationship sets and maps every searchable entity type', async () => {
    queue(
      [{ group_id: 'group-1' }, { group_id: '' }],
      [{ event_id: 'event-1' }],
      [{ todo_id: 'todo-1' }],
      [{ amendment_id: 'amendment-1' }],
      [{ blog_id: 'blog-1' }],
      [
        {
          id: 'user-1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          handle: 'ada',
          bio: 'Bio',
          visibility: 'private',
        },
        {
          id: 'user-2',
          first_name: null,
          last_name: null,
          handle: 'guest',
          bio: null,
          visibility: 'public',
        },
        {
          id: 'user-3',
          first_name: null,
          last_name: null,
          handle: null,
          bio: '',
          visibility: 'public',
        },
      ],
      [
        {
          id: 'group-1',
          name: 'Group',
          description: 'Description',
          visibility: 'private',
          member_count: 2,
        },
        { id: 'group-2', name: null, description: null, visibility: 'public', member_count: null },
      ],
      [
        {
          id: 'statement-1',
          text: 'A'.repeat(260),
          visibility: 'public',
          user_id: 'user-2',
          updated_at: now,
        },
        { id: 'no-card', text: null, visibility: 'private', user_id: 'user-1', updated_at: null },
      ],
      [
        {
          id: 'blog-1',
          title: 'Blog',
          description: 'Description',
          visibility: 'private',
          updated_at: now,
        },
        { id: 'blog-2', title: null, description: null, visibility: 'public', updated_at: null },
      ],
      [
        {
          id: 'amendment-1',
          title: 'Amendment',
          reason: 'Reason',
          preamble: null,
          visibility: 'private',
          updated_at: now,
        },
        {
          id: 'amendment-2',
          title: null,
          reason: null,
          preamble: 'Preamble',
          visibility: 'public',
          updated_at: null,
        },
      ],
      [
        {
          id: 'event-1',
          title: 'Event',
          description: 'Description',
          visibility: 'private',
          start_date: now + 1_000,
          end_date: now + 2_000,
          location_name: 'Hall',
          status: 'scheduled',
        },
        {
          id: 'event-2',
          title: null,
          description: null,
          visibility: 'public',
          start_date: null,
          end_date: null,
          location_name: null,
          status: null,
        },
      ],
      [
        {
          id: 'todo-1',
          title: 'Todo',
          description: 'Description',
          visibility: 'private',
          status: 'completed',
          priority: 'high',
          due_date: now,
          creator_id: 'other',
          updated_at: now,
        },
        {
          id: 'todo-2',
          title: null,
          description: null,
          visibility: 'public',
          status: null,
          priority: null,
          due_date: null,
          creator_id: 'user-1',
          updated_at: null,
        },
      ],
      [
        {
          id: 'election-1',
          title: 'Election',
          description: 'Description',
          visibility: 'public',
          status: 'open',
          updated_at: now,
        },
        {
          id: 'election-2',
          title: null,
          description: null,
          visibility: 'public',
          status: null,
          updated_at: null,
        },
      ],
      [
        {
          id: 'vote-1',
          title: 'Vote',
          description: 'Description',
          visibility: 'public',
          status: 'open',
          updated_at: now,
        },
        {
          id: 'vote-2',
          title: null,
          description: null,
          visibility: 'public',
          status: null,
          updated_at: null,
        },
      ]
    );

    const result = await execute('search_polity_entities', {
      query: '  policy, 100% ',
      entityTypes: [],
      limit: 12,
    });
    expect(result.attachments).toHaveLength(12);
    expect(result.attachments.map((item: Row) => item.entityType)).toEqual(
      expect.arrayContaining(['user', 'group', 'statement', 'blog', 'amendment', 'event'])
    );
    expect(result.attachments[0]).toMatchObject({
      href: expect.any(String),
      card_data_json: expect.anything(),
    });
  });

  it('uses explicit entity types, deduplicates results and reports empty searches', async () => {
    queue([], [], [], [], [], null, null);
    const empty = await execute('search_polity_entities', {
      query: 'none',
      entityTypes: ['user', 'group'],
      limit: undefined,
    });
    expect(empty.summary).toContain('keine Treffer');

    queue([], [], [], [], [], [{ id: 'same', first_name: 'Same', visibility: 'public' }]);
    const one = await execute('search_polity_entities', {
      query: 'same',
      entityTypes: ['user'],
      limit: 1,
    });
    expect(one.items).toHaveLength(1);
  });
});

describe('current-user AI tools', () => {
  it('merges created and assigned todos, filters status and sorts due dates', async () => {
    queue(
      [
        {
          id: 'created',
          title: 'Created',
          status: 'pending',
          due_date: null,
          updated_at: 1,
          creator_id: 'user-1',
        },
        {
          id: 'same-due-a',
          title: 'A',
          status: 'pending',
          due_date: 5,
          updated_at: 1,
          creator_id: 'user-1',
        },
        {
          id: 'same-due-b',
          title: 'B',
          status: 'pending',
          due_date: 5,
          updated_at: 2,
          creator_id: 'user-1',
        },
      ],
      [{ todo_id: 'assigned' }, { todo_id: 'created' }, { todo_id: '' }],
      [
        {
          id: 'assigned',
          title: 'Assigned',
          status: 'completed',
          due_date: 1,
          updated_at: 1,
          creator_id: 'other',
        },
      ]
    );
    const pending = await execute('find_my_todos', { status: 'pending', limit: 12 });
    expect(pending.attachments.map((item: Row) => item.entityId)).toEqual([
      'same-due-b',
      'same-due-a',
      'created',
    ]);

    queue(null, null);
    const empty = await execute('find_my_todos', { status: undefined, limit: undefined });
    expect(empty.attachments).toEqual([]);

    queue(
      [
        {
          id: 'undated-a',
          title: 'A',
          status: 'pending',
          due_date: null,
          updated_at: null,
          creator_id: 'user-1',
        },
        {
          id: 'undated-b',
          title: 'B',
          status: 'pending',
          due_date: null,
          updated_at: null,
          creator_id: 'user-1',
        },
      ],
      []
    );
    await expect(execute('find_my_todos', {})).resolves.toMatchObject({
      attachments: expect.any(Array),
    });
  });

  it('filters upcoming, past and all calendar events and loads missing participant events', async () => {
    queue(
      [{ event_id: 'participant' }, { event_id: 'created' }],
      [{ id: 'created', title: 'Created', start_date: now + 10, updated_at: now }],
      [{ id: 'participant', title: 'Participant', start_date: now + 5, updated_at: now }]
    );
    const upcoming = await execute('find_my_calendar', { timeframe: 'upcoming', limit: 6 });
    expect(upcoming.attachments.map((item: Row) => item.entityId)).toEqual([
      'participant',
      'created',
    ]);

    queue(
      [],
      [
        { id: 'old', title: 'Old', start_date: now - 10, updated_at: now },
        { id: 'older', title: 'Older', start_date: now - 20, updated_at: now },
        { id: 'unknown', title: 'Unknown', start_date: null, updated_at: now },
      ]
    );
    const past = await execute('find_my_calendar', { timeframe: 'past', limit: 6 });
    expect(past.attachments.map((item: Row) => item.entityId)).toEqual(['old', 'older']);

    queue(null, null);
    await expect(execute('find_my_calendar', { timeframe: 'all' })).resolves.toMatchObject({
      attachments: [],
    });

    queue(
      [],
      [
        { id: 'undated', title: 'Undated', start_date: null, updated_at: null },
        { id: 'dated', title: 'Dated', start_date: now, updated_at: now },
      ]
    );
    const all = await execute('find_my_calendar', { timeframe: 'all' });
    expect(all.attachments.map((item: Row) => item.entityId)).toEqual(['dated', 'undated']);

    queue(
      [],
      [
        { id: 'dated', title: 'Dated', start_date: now, updated_at: now },
        { id: 'undated', title: 'Undated', start_date: null, updated_at: null },
      ]
    );
    await expect(execute('find_my_calendar', { timeframe: 'all' })).resolves.toMatchObject({
      attachments: expect.any(Array),
    });
  });

  it('requires role links for groups, amendments, events and blogs', async () => {
    queue(
      [
        { id: 'membership-1', group_id: 'group-1' },
        { id: 'membership-2', group_id: 'missing' },
      ],
      [{ group_membership_id: 'membership-1', role_id: 'role-1' }],
      [{ id: 'group-1', name: 'Group', visibility: 'public', member_count: 0 }]
    );
    expect(
      (await execute('find_my_groups', { query: 'group', limit: 6 })).attachments
    ).toHaveLength(1);

    queue(
      [
        { amendment_id: 'amendment-1', role_id: 'role-1' },
        { amendment_id: 'ignored', role_id: null },
      ],
      [{ id: 'amendment-1', title: 'Amendment', visibility: 'public' }]
    );
    expect(
      (await execute('find_my_amendments', { query: undefined, limit: 6 })).attachments
    ).toHaveLength(1);

    queue(
      [{ id: 'participant-1', event_id: 'event-1' }],
      [{ event_participant_id: 'participant-1', role_id: 'role-1' }],
      [{ id: 'event-1', title: 'Event', visibility: 'public', start_date: now }]
    );
    expect(
      (await execute('find_my_role_events', { query: 'missing', limit: 6 })).attachments
    ).toEqual([]);

    queue(
      [{ blog_id: 'blog-1', role_id: 'role-1' }],
      [{ id: 'blog-1', title: 'Blog', visibility: 'public' }]
    );
    expect((await execute('find_my_blogs', { query: null, limit: 6 })).attachments).toHaveLength(1);

    queue([], [], [], []);
    expect((await execute('find_my_groups', {})).attachments).toEqual([]);
    expect((await execute('find_my_amendments', {})).attachments).toEqual([]);
    expect((await execute('find_my_role_events', {})).attachments).toEqual([]);
    expect((await execute('find_my_blogs', {})).attachments).toEqual([]);
  });
});

describe('current-user scope prompt', () => {
  it('formats names and empty role sections and falls back after read failures', async () => {
    queue(
      { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
      [],
      [],
      [],
      []
    );
    const prompt = await buildCurrentUserScopePrompt('user-1');
    expect(prompt).toContain('Ada Lovelace (@ada)');
    expect(prompt).toContain('Role-scoped groups: none');

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    transaction.run.mockRejectedValueOnce(new Error('offline'));
    await expect(buildCurrentUserScopePrompt('user-1')).resolves.toBe('Current user: user-1');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('uses handle-only and user-id display fallbacks', async () => {
    queue({ id: 'user-1', first_name: null, last_name: null, handle: 'ada' }, [], [], [], []);
    await expect(buildCurrentUserScopePrompt('user-1')).resolves.toContain('@ada');
    queue(null, [], [], [], []);
    await expect(buildCurrentUserScopePrompt('user-1')).resolves.toContain('Current user: user-1');

    queue({ id: 'user-1', first_name: 'Ada', last_name: 'Lovelace', handle: null }, [], [], [], []);
    await expect(buildCurrentUserScopePrompt('user-1')).resolves.toContain(
      'Ada Lovelace (id: user-1)'
    );
  });

  it('formats nonempty role-scoped sections', async () => {
    queue(
      { id: 'user-1', first_name: 'Ada', last_name: null, handle: null },
      [{ id: 'membership-1', group_id: 'group-1' }],
      [],
      [],
      [],
      [{ group_membership_id: 'membership-1', role_id: 'role-1' }],
      [{ id: 'group-1', name: 'Group', visibility: 'public', member_count: 1 }]
    );
    const prompt = await buildCurrentUserScopePrompt('user-1');
    expect(prompt).toContain('Role-scoped groups:\n- Group (id: group-1)');
  });
});

describe('group and event resource AI tools', () => {
  it('rejects missing and inaccessible groups', async () => {
    queue(null, []);
    await expect(
      execute('find_group_resources', { groupId: 'missing', resourceTypes: [], limit: 6 })
    ).rejects.toThrow('Group not found');

    mocks.checkAccess.mockReturnValueOnce(false);
    queue({ id: 'group-1', name: 'Group', visibility: 'private', owner_id: 'other' }, []);
    await expect(
      execute('find_group_resources', { groupId: 'group-1', resourceTypes: [], limit: 6 })
    ).rejects.toThrow('You do not have access to this group');
  });

  it('maps all group resource types and filters and deduplicates attachments', async () => {
    queue(
      { id: 'group-1', name: 'Group', visibility: 'private', owner_id: 'user-1' },
      null,
      [
        {
          id: 'income',
          label: 'Income',
          type: 'grant',
          amount: 10,
          currency: 'EUR',
          receiver_group_id: 'group-1',
          payer_group_id: 'other',
          created_at: now,
        },
        {
          id: 'expense',
          label: null,
          type: null,
          amount: null,
          currency: null,
          receiver_group_id: 'other',
          payer_group_id: 'group-1',
          created_at: now,
        },
        {
          id: 'neutral',
          label: null,
          type: null,
          amount: null,
          currency: null,
          receiver_group_id: 'other',
          payer_group_id: 'other',
          created_at: now,
        },
      ],
      [{ id: 'todo-1', title: 'Todo', updated_at: now }],
      [
        { id: 'link-1', label: null, url: 'https://example.test', created_at: now },
        { id: 'link-2', label: null, url: null, created_at: now },
      ],
      [
        {
          id: 'amendment-1',
          title: 'Amendment',
          reason: 'Reason',
          document_id: 'document-1',
          updated_at: now,
        },
        { id: 'amendment-2', title: null, reason: null, document_id: null, updated_at: now },
      ],
      [
        { id: 'document-1', amendment_id: 'amendment-1', updated_at: now },
        { id: 'orphan', amendment_id: null, updated_at: now },
      ],
      [{ id: 'event-1', title: 'Event', updated_at: now, start_date: now }],
      [{ id: 'blog-1', title: 'Blog', updated_at: now }]
    );
    const result = await execute('find_group_resources', {
      groupId: 'group-1',
      resourceTypes: ['payments', 'todos', 'links', 'amendments', 'events', 'blogs', 'files'],
      query: undefined,
      limit: 12,
    });
    expect(result.attachments.map((item: Row) => item.entityType)).toEqual(
      expect.arrayContaining(['payment', 'todo', 'link', 'amendment', 'document', 'event', 'blog'])
    );

    queue({ id: 'group-1', name: null, visibility: 'public', owner_id: null }, [], [], [], [], []);
    const empty = await execute('find_group_resources', {
      groupId: 'group-1',
      resourceTypes: ['payments', 'todos', 'links', 'events', 'blogs'],
      query: 'none',
    });
    expect(empty.attachments).toEqual([]);
  });

  it('handles omitted group resource categories and sparse payment/file contexts', async () => {
    queue({ id: 'group-1', name: null, visibility: 'public', owner_id: null }, null);
    const none = await execute('find_group_resources', {
      groupId: 'group-1',
      resourceTypes: [],
    });
    expect(none.attachments).toEqual([]);

    queue({ id: 'group-1', name: null, visibility: 'public', owner_id: null }, null, [
      {
        id: 'payment-1',
        label: null,
        type: null,
        amount: null,
        currency: null,
        receiver_group_id: 'other',
        payer_group_id: 'other',
        created_at: now,
      },
    ]);
    const payment = await execute('find_group_resources', {
      groupId: 'group-1',
      resourceTypes: ['payments'],
    });
    expect(payment.attachments).toMatchObject([
      { title: 'Zahlung', subtitle: expect.any(String), prompt_context: null },
    ]);

    queue(
      { id: 'group-1', name: null, visibility: 'public', owner_id: null },
      [],
      [{ id: 'amendment-1', title: 'Amendment', document_id: null, updated_at: now }]
    );
    await expect(
      execute('find_group_resources', {
        groupId: 'group-1',
        resourceTypes: ['files'],
      })
    ).resolves.toMatchObject({ attachments: [] });

    queue(
      { id: 'group-1', name: null, visibility: 'public', owner_id: null },
      [],
      [
        {
          id: 'amendment-1',
          title: null,
          reason: null,
          document_id: 'document-1',
          updated_at: now,
        },
      ],
      [{ id: 'orphan-document', amendment_id: null, updated_at: now }]
    );
    await expect(
      execute('find_group_resources', {
        groupId: 'group-1',
        resourceTypes: ['files'],
      })
    ).resolves.toMatchObject({
      attachments: [{ entityType: 'document', prompt_context: null }],
    });

    queue(
      { id: 'group-1', name: 'Group', visibility: 'public', owner_id: null },
      [],
      [{ id: 'amendment-1', title: 'Amendment', document_id: null, updated_at: now }]
    );
    await expect(
      execute('find_group_resources', {
        groupId: 'group-1',
        resourceTypes: ['amendments'],
      })
    ).resolves.toMatchObject({ attachments: [{ entityType: 'amendment' }] });
  });

  it('rejects missing and inaccessible events', async () => {
    queue(null, []);
    await expect(
      execute('find_event_resources', { eventId: 'missing', resourceTypes: [], limit: 6 })
    ).rejects.toThrow('Event not found');
    mocks.checkAccess.mockReturnValueOnce(false);
    queue({ id: 'event-1', title: 'Event', visibility: 'private', creator_id: 'other' }, []);
    await expect(
      execute('find_event_resources', { eventId: 'event-1', resourceTypes: [], limit: 6 })
    ).rejects.toThrow('You do not have access to this event');
  });

  it('maps agenda, amendment, election and vote resources and returns an event fallback', async () => {
    queue(
      { id: 'event-1', title: 'Event', visibility: 'private', creator_id: 'user-1' },
      null,
      [
        {
          id: 'agenda-1',
          title: 'Agenda',
          type: 'vote',
          status: 'open',
          scheduled_time: '10:00',
          description: 'Description',
          order_index: 0,
          duration: 10,
          amendment_id: 'amendment-1',
          created_at: now,
          updated_at: now,
        },
        {
          id: 'agenda-2',
          title: null,
          type: null,
          status: null,
          scheduled_time: null,
          description: null,
          order_index: null,
          duration: null,
          amendment_id: null,
          created_at: now,
          updated_at: null,
        },
      ],
      [{ id: 'amendment-1', title: 'Direct', updated_at: now }],
      [{ id: 'amendment-1', title: 'Agenda duplicate', updated_at: now }],
      [{ id: 'election-1', title: 'Election', updated_at: now }],
      [{ id: 'vote-1', title: 'Vote', updated_at: now }]
    );
    const result = await execute('find_event_resources', {
      eventId: 'event-1',
      resourceTypes: ['agenda_items', 'amendments', 'elections', 'votes'],
      limit: 12,
    });
    expect(result.attachments.map((item: Row) => item.entityType)).toEqual(
      expect.arrayContaining(['agenda_item', 'amendment', 'election', 'vote'])
    );

    queue({ id: 'event-1', title: 'Event', visibility: 'public', creator_id: 'other' }, [], []);
    const fallback = await execute('find_event_resources', {
      eventId: 'event-1',
      resourceTypes: ['amendments'],
      query: 'none',
      limit: 6,
    });
    expect(fallback.attachments).toMatchObject([{ entityType: 'event', entityId: 'event-1' }]);

    queue({ id: 'event-2', title: null, visibility: 'public', creator_id: 'other' }, [], []);
    const empty = await execute('find_event_resources', {
      eventId: 'event-2',
      resourceTypes: ['elections', 'votes'],
      limit: 6,
    });
    expect(empty.attachments).toEqual([]);
  });

  it('returns the event fallback when all resource categories are omitted', async () => {
    queue({ id: 'event-1', title: 'Event', visibility: 'public', creator_id: 'other' }, null, null);
    const result = await execute('find_event_resources', {
      eventId: 'event-1',
      resourceTypes: [],
    });
    expect(result.attachments).toMatchObject([{ entityType: 'event' }]);
  });
});

describe('docs, presentation and create-flow AI tools', () => {
  it('formats empty and populated docs results', async () => {
    await expect(execute('read_polity_docs', { language: 'de', limit: 8 })).resolves.toMatchObject({
      summary: 'Polity Docs: keine Treffer.',
      items: [],
    });

    mocks.readDocs.mockReturnValue({
      query: 'roles',
      pages: [{ slug: 'groups', title: 'Groups', route: '/docs/groups' }],
      matches: [
        {
          pageSlug: 'groups',
          pageTitle: 'Groups',
          sectionId: 'roles',
          sectionTitle: 'Roles',
          route: '/docs/groups#roles',
        },
        {
          pageSlug: 'groups',
          pageTitle: 'Groups',
          sectionId: null,
          sectionTitle: null,
          route: '/docs/groups',
        },
      ],
    });
    const result = await execute('read_polity_docs', { query: 'roles', language: 'en', limit: 2 });
    expect(result.summary).toContain('3 Treffer');
    expect(result.items).toHaveLength(3);
    expect(result.items[2]).toMatchObject({ entityId: 'groups:page', title: 'Groups' });
  });

  it('presents findings with optional fields and builds every create route variant', async () => {
    const findings = await execute('present_findings', {
      title: 'Options',
      items: [
        { title: 'A', description: 'First', tone: 'neutral' },
        { title: 'B', description: 'Second', badge: 'Best', tone: 'success' },
      ],
    });
    expect(findings.presentations[0]).toMatchObject({
      summary: null,
      items: [{ badge: null }, { badge: 'Best' }],
    });

    for (const flow of [
      'group',
      'event',
      'amendment',
      'blog-entry',
      'todo',
      'statement',
      'payment',
      'election-candidate',
    ]) {
      const result = await execute('open_create_flow', { flow });
      expect(result.route).toContain('/create/');
    }
    await expect(execute('open_create_flow', { flow: 'agenda-item' })).resolves.toMatchObject({
      route: '/create/agenda-item',
    });
    await expect(
      execute('open_create_flow', {
        flow: 'agenda-item',
        eventId: 'event-1',
        agendaItemType: 'vote',
      })
    ).resolves.toMatchObject({ route: '/create/agenda-item?eventId=event-1&type=vote' });
    await expect(
      execute('open_create_flow', { flow: 'agenda-item', eventId: 'event-1' })
    ).resolves.toMatchObject({ route: '/create/agenda-item?eventId=event-1' });
    await expect(
      execute('open_create_flow', { flow: 'agenda-item', agendaItemType: 'speech' })
    ).resolves.toMatchObject({ route: '/create/agenda-item?type=speech' });
  });
});
