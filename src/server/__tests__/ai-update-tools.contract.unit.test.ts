import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

interface TestQuery {
  table: string;
  filters: [string, unknown][];
  single: boolean;
  where: (field: string, value: unknown) => TestQuery;
  related: (_relation: string) => TestQuery;
  one: () => TestQuery;
}

interface MutationDescriptor {
  name: string;
  args: Row;
}

const mocks = vi.hoisted(() => ({
  tables: new Map<string, Row[]>(),
  mutations: [] as MutationDescriptor[],
  queuedResults: [] as unknown[],
  syncHashtags: vi.fn(async () => undefined),
}));

function createQuery(table: string): TestQuery {
  const query: TestQuery = {
    table,
    filters: [],
    single: false,
    where: (field, value) => {
      query.filters.push([field, value]);
      return query;
    },
    related: () => query,
    one: () => {
      query.single = true;
      return query;
    },
  };
  return query;
}

function readQuery(query: TestQuery): Row | Row[] | null {
  const rows = [...(mocks.tables.get(query.table) ?? [])].filter(row =>
    query.filters.every(([field, value]) => row[field] === value)
  );
  return query.single ? (rows[0] ?? null) : rows;
}

function mutationTree(): object {
  return new Proxy(
    {},
    {
      get: (_target, domain) =>
        new Proxy(
          {},
          {
            get:
              (_nested, operation) =>
              (args: Row): MutationDescriptor => ({
                name: `${String(domain)}.${String(operation)}`,
                args,
              }),
          }
        ),
    }
  );
}

const transaction = {
  run: vi.fn(async (query: TestQuery) =>
    mocks.queuedResults.length > 0 ? mocks.queuedResults.shift() : readQuery(query)
  ),
};

vi.mock('@/zero/schema', () => ({
  zql: new Proxy({}, { get: (_target, table) => createQuery(String(table)) }),
}));
vi.mock('@/zero/mutators', () => ({ mutators: mutationTree() }));
vi.mock('@/zero/server-mutators', () => ({ serverMutators: mutationTree() }));
vi.mock('@/zero/common/server-hashtags', () => ({
  syncEntityHashtagsForUpdate: mocks.syncHashtags,
}));
vi.mock('@/features/search/logic/buildTimelineCardProps', () => ({
  buildTimelineCardProps: () => ({ cardType: 'contract', cardProps: { rendered: true } }),
}));
vi.mock('@/lib/ai/entityHref', () => ({
  buildAiEntityHref: (entityType: string, entityId: string) => `/${entityType}/${entityId}`,
}));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: (userId: string) => ({ userID: userId }),
  executeZeroTransaction: async (
    context: { userID: string },
    callback: (tx: typeof transaction, ctx: { userID: string }) => Promise<unknown>
  ) => callback(transaction, context),
  runZeroMutator: async (_tx: unknown, mutation: MutationDescriptor, _context: unknown) => {
    mocks.mutations.push(mutation);
  },
}));

import { buildAiUpdateTools } from '../ai-update-tools';

type ToolName = keyof ReturnType<typeof buildAiUpdateTools>;

function setRows(table: string, rows: Row[]) {
  mocks.tables.set(table, rows);
}

function mutation(name: string) {
  return mocks.mutations.find(item => item.name === name);
}

async function execute(name: ToolName, input: unknown) {
  const selected = buildAiUpdateTools('user-1', 'Europe/Berlin')[name] as unknown as {
    execute: (input: unknown, options: unknown) => Promise<Row>;
  };
  return selected.execute(input, {});
}

const base = {
  created_at: Date.UTC(2026, 0, 1),
  updated_at: Date.UTC(2026, 0, 2),
};

beforeEach(() => {
  mocks.tables.clear();
  mocks.mutations.length = 0;
  mocks.queuedResults.length = 0;
  mocks.syncHashtags.mockClear();
  transaction.run.mockClear();
  setRows('group_hashtag', [{ group_id: 'group-1', hashtag: { tag: 'group-tag' } }]);
  setRows('event_hashtag', [{ event_id: 'event-1', hashtag: { tag: 'event-tag' } }]);
  setRows('amendment_hashtag', [
    { amendment_id: 'amendment-1', hashtag: { tag: 'amendment-tag' } },
  ]);
  setRows('blog_hashtag', [{ blog_id: 'blog-1', hashtag: { tag: 'blog-tag' } }]);
  setRows('statement_hashtag', [
    { statement_id: 'statement-1', hashtag: { tag: 'statement-tag' } },
  ]);
});

describe('AI update tool schemas', () => {
  it('requires a real update and exactly one election candidate locator', () => {
    const tools = buildAiUpdateTools('user-1') as unknown as Record<
      string,
      { inputSchema: { safeParse: (value: unknown) => { success: boolean } } }
    >;
    expect(tools.update_group.inputSchema.safeParse({ groupId: 'group-1' }).success).toBe(false);
    expect(
      tools.update_group.inputSchema.safeParse({ groupId: 'group-1', description: null }).success
    ).toBe(true);
    expect(
      tools.update_election_candidate.inputSchema.safeParse({ candidateId: 'candidate-1' }).success
    ).toBe(false);
    expect(
      tools.update_election_candidate.inputSchema.safeParse({
        candidateId: 'candidate-1',
        electionId: 'election-1',
        statement: 'Ambiguous',
      }).success
    ).toBe(false);
    expect(
      tools.update_election_candidate.inputSchema.safeParse({
        electionId: 'election-1',
        statement: null,
      }).success
    ).toBe(true);
  });
});

describe('AI group, event and amendment updates', () => {
  it('updates every supported group field and projects the resulting attachment', async () => {
    setRows('group', [
      {
        ...base,
        id: 'group-1',
        name: null,
        description: [{ type: 'p', children: [{ text: 'Description' }] }],
        visibility: null,
        member_count: 0,
        event_count: 0,
        amendment_count: 0,
      },
    ]);

    const result = await execute('update_group', {
      groupId: 'group-1',
      name: 'Updated group',
      description: null,
      visibility: 'authenticated',
      email: null,
      country: 'DE',
      region: null,
      postCode: '10115',
      city: 'Berlin',
      street: 'Street',
      houseNumber: '1',
      latitude: 52.5,
      longitude: null,
      imageUrl: null,
      hashtags: [' policy ', 'policy'],
    });

    expect(mutation('groups.update')?.args).toMatchObject({
      id: 'group-1',
      name: 'Updated group',
      description: null,
      visibility: 'authenticated',
      email: null,
      latitude: 52.5,
      longitude: null,
    });
    expect(mocks.syncHashtags).toHaveBeenCalledWith(
      transaction,
      { userID: 'user-1' },
      'group',
      'group-1',
      [' policy ', 'policy']
    );
    expect(result).toMatchObject({
      route: '/group/group-1',
      attachments: [{ context_type: 'update' }],
    });

    mocks.mutations.length = 0;
    await execute('update_group', { groupId: 'group-1', description: 'Replacement' });
    expect(mutation('groups.update')?.args).toEqual({
      id: 'group-1',
      description: [{ type: 'p', children: [{ text: 'Replacement' }] }],
    });
  });

  it('updates delegate and non-delegate event fields including date clears', async () => {
    setRows('group', [{ id: 'group-1', name: 'Parent' }]);
    setRows('event', [
      {
        ...base,
        id: 'event-1',
        title: null,
        description: null,
        event_type: 'open',
        visibility: 'public',
        group_id: 'group-1',
        start_date: null,
        end_date: null,
        location_name: null,
        city: null,
        post_code: null,
        participant_count: 0,
        election_count: 0,
        amendment_count: 0,
      },
    ]);

    await execute('update_event', {
      eventId: 'event-1',
      title: 'Assembly',
      description: 'Agenda',
      eventType: 'delegate_assembly',
      visibility: 'private',
      locationType: 'physical',
      locationName: 'Hall',
      locationUrl: null,
      country: 'DE',
      region: 'BE',
      postCode: '10115',
      city: 'Berlin',
      street: 'Street',
      houseNumber: '1',
      latitude: 52.5,
      longitude: 13.4,
      startsAt: '2026-08-09T10:00',
      endsAt: null,
      capacity: 100,
      imageUrl: null,
      delegatesNominationDeadline: '2026-08-08T10:00',
      amendmentDeadline: null,
      totalDelegateSeats: 20,
      hashtags: ['assembly'],
    });
    expect(mutation('events.update')?.args).toMatchObject({
      event_type: 'delegate_assembly',
      has_delegates: true,
      total_delegate_seats: 20,
      end_date: null,
      amendment_deadline: null,
    });

    mocks.mutations.length = 0;
    await execute('update_event', { eventId: 'event-1', eventType: 'open' });
    expect(mutation('events.update')?.args).toMatchObject({
      event_type: 'open',
      has_delegates: false,
      total_delegate_seats: null,
      delegates_nomination_deadline: null,
    });

    setRows('event', [
      {
        ...(mocks.tables.get('event')?.[0] ?? {}),
        event_type: null,
        status: null,
        location_name: null,
        group_id: null,
        start_date: null,
        end_date: null,
      },
    ]);
    mocks.mutations.length = 0;
    await execute('update_event', { eventId: 'event-1', description: null });
    expect(mutation('events.update')?.args).toEqual({ id: 'event-1', description: null });

    setRows('event', [
      {
        ...(mocks.tables.get('event')?.[0] ?? {}),
        event_type: 'open',
        start_date: Date.UTC(2026, 7, 9),
        end_date: Date.UTC(2026, 7, 10),
      },
    ]);
    await execute('update_event', { eventId: 'event-1', title: 'Dated event' });
  });

  it('updates amendment fields and reports missing pre/post-update rows', async () => {
    setRows('amendment', [
      {
        ...base,
        id: 'amendment-1',
        title: null,
        reason: null,
        visibility: null,
        group_id: null,
        collaborator_count: 0,
        change_request_count: 0,
      },
    ]);
    await expect(
      execute('update_amendment', {
        amendmentId: 'amendment-1',
        title: 'Updated',
        code: null,
        reason: null,
        visibility: 'public',
        imageUrl: null,
        hashtags: ['one', ' one '],
      })
    ).resolves.toMatchObject({ route: '/amendment/amendment-1' });
    expect(mutation('amendments.update')?.args).toMatchObject({ tags: ['one'] });

    setRows('group', [{ id: 'group-1', name: 'Parent' }]);
    setRows('amendment', [{ ...(mocks.tables.get('amendment')?.[0] ?? {}), group_id: 'group-1' }]);
    mocks.mutations.length = 0;
    await execute('update_amendment', { amendmentId: 'amendment-1', title: 'Only title' });
    expect(mutation('amendments.update')?.args).toEqual({
      id: 'amendment-1',
      title: 'Only title',
    });
    mocks.mutations.length = 0;
    await execute('update_amendment', { amendmentId: 'amendment-1', hashtags: [] });
    expect(mutation('amendments.update')?.args).toEqual({ id: 'amendment-1', tags: [] });

    setRows('amendment', []);
    await expect(
      execute('update_amendment', { amendmentId: 'missing', title: 'Nope' })
    ).rejects.toThrow('Amendment not found');
  });
});

describe('remaining AI update handlers', () => {
  it('updates personal/group blogs and preserves date clear semantics', async () => {
    setRows('blog', [
      {
        ...base,
        id: 'blog-1',
        title: null,
        description: null,
        visibility: null,
        image_url: null,
        date: null,
        group_id: null,
        comment_count: 0,
      },
    ]);
    await expect(
      execute('update_blog_entry', {
        blogId: 'blog-1',
        title: 'Blog',
        date: '2026-08-09',
        visibility: 'public',
        imageUrl: null,
        hashtags: [],
      })
    ).resolves.toMatchObject({ route: '/user/user-1/blog/blog-1' });
    expect(mutation('blogs.update')?.args.date).toMatch(/^2026-08-08T22:00:00.000Z$/);

    setRows('blog', [
      { ...(mocks.tables.get('blog')?.[0] ?? {}), group_id: 'group-1', title: 'Blog' },
    ]);
    mocks.mutations.length = 0;
    await expect(
      execute('update_blog_entry', { blogId: 'blog-1', date: null })
    ).resolves.toMatchObject({ route: '/group/group-1/blog/blog-1' });
    expect(mutation('blogs.update')?.args.date).toBeNull();

    setRows('blog', [
      {
        ...(mocks.tables.get('blog')?.[0] ?? {}),
        date: '2026-08-09T00:00:00.000Z',
      },
    ]);
    mocks.mutations.length = 0;
    await execute('update_blog_entry', { blogId: 'blog-1', title: 'Only title' });
    expect(mutation('blogs.update')?.args).toEqual({ id: 'blog-1', title: 'Only title' });

    mocks.mutations.length = 0;
    await execute('update_blog_entry', { blogId: 'blog-1', date: '   ' });
    expect(mutation('blogs.update')?.args.date).toBeNull();
  });

  it('updates todo completion, deadline and fallback presentation fields', async () => {
    setRows('group', [{ id: 'group-1', name: undefined }]);
    setRows('todo', [
      {
        ...base,
        id: 'todo-1',
        title: null,
        description: null,
        status: 'completed',
        priority: null,
        due_date: null,
        visibility: null,
        tags: null,
        group_id: 'group-1',
      },
    ]);
    await execute('update_todo', {
      todoId: 'todo-1',
      title: 'Todo',
      description: null,
      priority: 'high',
      status: 'completed',
      dueDate: '2026-08-09',
      visibility: 'private',
      tags: ['one', ' one '],
    });
    expect(mutation('todos.update')?.args).toMatchObject({
      completed_at: expect.any(Number),
      tags: ['one'],
    });

    mocks.mutations.length = 0;
    await execute('update_todo', { todoId: 'todo-1', status: 'pending', dueDate: null });
    expect(mutation('todos.update')?.args).toMatchObject({ completed_at: null, due_date: null });

    setRows('todo', [
      {
        ...(mocks.tables.get('todo')?.[0] ?? {}),
        group_id: null,
        due_date: null,
        status: null,
        priority: null,
        tags: [],
      },
    ]);
    mocks.mutations.length = 0;
    await execute('update_todo', { todoId: 'todo-1', title: 'Only title' });
    expect(mutation('todos.update')?.args).toEqual({ id: 'todo-1', title: 'Only title' });

    setRows('todo', [{ ...(mocks.tables.get('todo')?.[0] ?? {}), due_date: Date.UTC(2026, 7, 9) }]);
    await execute('update_todo', { todoId: 'todo-1', description: 'Dated todo' });
  });

  it('updates statements and derives a title from text or the stored fallback', async () => {
    setRows('statement', [
      {
        ...base,
        id: 'statement-1',
        text: '',
        title: 'Stored title',
        visibility: null,
        image_url: null,
        video_url: null,
        user_id: 'user-1',
        group_id: null,
        comment_count: 0,
        upvotes: 0,
        downvotes: 0,
      },
    ]);
    await expect(
      execute('update_statement', {
        statementId: 'statement-1',
        text: null,
        imageUrl: null,
        videoUrl: null,
        visibility: 'authenticated',
        hashtags: ['statement'],
      })
    ).resolves.toMatchObject({ route: '/statement/statement-1' });
    expect(mutation('statements.update')?.args).toMatchObject({ text: null, image_url: null });

    setRows('group', [{ id: 'group-1', name: 'Parent' }]);
    setRows('statement', [
      {
        ...(mocks.tables.get('statement')?.[0] ?? {}),
        text: 'Visible statement text',
        title: null,
        group_id: 'group-1',
      },
    ]);
    mocks.mutations.length = 0;
    await execute('update_statement', { statementId: 'statement-1', text: 'Changed' });
    expect(mutation('statements.update')?.args).toEqual({ id: 'statement-1', text: 'Changed' });

    mocks.mutations.length = 0;
    await execute('update_statement', { statementId: 'statement-1', hashtags: [] });
    expect(mutation('statements.update')?.args).toEqual({ id: 'statement-1' });

    setRows('statement', [
      { ...(mocks.tables.get('statement')?.[0] ?? {}), text: null, title: null, group_id: null },
    ]);
    await expect(
      execute('update_statement', { statementId: 'statement-1', text: null })
    ).resolves.toMatchObject({ attachments: [{ title: 'Statement' }] });
  });

  it('updates income/expense payments and chooses group/root routes', async () => {
    setRows('payment', [
      {
        ...base,
        id: 'payment-1',
        label: null,
        type: null,
        amount: null,
        currency: null,
        receiver_group_id: 'group-1',
        payer_group_id: null,
      },
    ]);
    await expect(
      execute('update_payment', {
        paymentId: 'payment-1',
        label: null,
        type: null,
        amount: null,
        currency: 'USD',
      })
    ).resolves.toMatchObject({ route: '/group/group-1' });
    expect(mutation('payments.updatePayment')?.args).toMatchObject({ currency: 'USD' });

    setRows('payment', [
      {
        ...(mocks.tables.get('payment')?.[0] ?? {}),
        receiver_group_id: null,
        payer_group_id: null,
      },
    ]);
    await expect(
      execute('update_payment', { paymentId: 'payment-1', amount: 5 })
    ).resolves.toMatchObject({ route: '/' });

    setRows('payment', [
      {
        ...(mocks.tables.get('payment')?.[0] ?? {}),
        label: 'Expense',
        type: 'material',
        amount: 5,
        currency: 'EUR',
        payer_group_id: 'group-2',
      },
    ]);
    mocks.mutations.length = 0;
    await expect(
      execute('update_payment', { paymentId: 'payment-1', label: 'Only label' })
    ).resolves.toMatchObject({ route: '/group/group-2' });
    expect(mutation('payments.updatePayment')?.args).toEqual({
      id: 'payment-1',
      label: 'Only label',
    });
  });

  it('updates agenda items with event and amendment routes', async () => {
    setRows('event', [{ id: 'event-1', title: 'Event' }]);
    setRows('agenda_item', [
      {
        ...base,
        id: 'agenda-1',
        title: null,
        description: null,
        type: 'discussion',
        status: null,
        order_index: null,
        duration: null,
        event_id: 'event-1',
        amendment_id: null,
      },
    ]);
    await expect(
      execute('update_agenda_item', {
        agendaItemId: 'agenda-1',
        title: 'Agenda',
        description: null,
        orderIndex: 2,
        durationMinutes: 0,
      })
    ).resolves.toMatchObject({ route: '/event/event-1/agenda' });

    setRows('agenda_item', [
      { ...(mocks.tables.get('agenda_item')?.[0] ?? {}), event_id: null, amendment_id: 'a-1' },
    ]);
    await expect(
      execute('update_agenda_item', { agendaItemId: 'agenda-1', title: 'Again' })
    ).resolves.toMatchObject({ route: '/amendment/a-1' });
    mocks.mutations.length = 0;
    await execute('update_agenda_item', { agendaItemId: 'agenda-1', description: null });
    expect(mutation('agendas.updateAgendaItem')?.args).toEqual({
      id: 'agenda-1',
      description: null,
    });
  });

  it('locates election candidates directly or by election/user and selects route fallbacks', async () => {
    setRows('election_candidate', [
      {
        id: 'candidate-1',
        election_id: 'election-1',
        user_id: 'user-1',
        name: null,
        description: null,
        status: null,
      },
    ]);
    setRows('election', [{ id: 'election-1', title: 'Board', agenda_item_id: 'agenda-1' }]);
    setRows('agenda_item', [{ id: 'agenda-1', event_id: 'event-1' }]);
    await expect(
      execute('update_election_candidate', {
        candidateId: 'candidate-1',
        name: null,
        statement: 'Statement',
        imageUrl: null,
      })
    ).resolves.toMatchObject({ route: '/event/event-1/agenda' });

    setRows('election', [{ id: 'election-1', title: null, agenda_item_id: null }]);
    await expect(
      execute('update_election_candidate', {
        electionId: 'election-1',
        statement: null,
      })
    ).resolves.toMatchObject({ route: '/election/election-1' });

    mocks.mutations.length = 0;
    await execute('update_election_candidate', {
      candidateId: 'candidate-1',
      name: 'Named candidate',
    });
    expect(mutation('elections.updateCandidate')?.args).toEqual({
      id: 'candidate-1',
      name: 'Named candidate',
    });

    setRows('election_candidate', []);
    await expect(
      execute('update_election_candidate', { candidateId: 'missing', statement: 'Nope' })
    ).rejects.toThrow('Election candidate not found');
  });
});

describe('AI update stale-row failures', () => {
  const cases = [
    ['update_group', 'group', { groupId: 'id', name: 'Name' }, 'Group'],
    ['update_event', 'event', { eventId: 'id', title: 'Title' }, 'Event'],
    ['update_blog_entry', 'blog', { blogId: 'id', title: 'Title' }, 'Blog entry'],
    ['update_todo', 'todo', { todoId: 'id', title: 'Title' }, 'Todo'],
    ['update_statement', 'statement', { statementId: 'id', text: 'Text' }, 'Statement'],
    ['update_payment', 'payment', { paymentId: 'id', label: 'Label' }, 'Payment'],
    ['update_agenda_item', 'agenda_item', { agendaItemId: 'id', title: 'Title' }, 'Agenda item'],
  ] as const;

  it.each(cases)('rejects %s when its source row is absent', async (tool, table, args, label) => {
    setRows(table, []);
    await expect(execute(tool, args)).rejects.toThrow(`${label} not found`);
  });

  it.each(cases)(
    'rejects %s when its source row disappears after the mutation',
    async (tool, _table, args, label) => {
      mocks.queuedResults.push({ id: 'id', event_type: 'open' }, null);
      await expect(execute(tool, args)).rejects.toThrow(`${label} not found after update`);
    }
  );

  it('rejects an amendment and candidate that disappear after mutation', async () => {
    mocks.queuedResults.push({ id: 'amendment-1' }, null);
    await expect(
      execute('update_amendment', { amendmentId: 'amendment-1', title: 'Title' })
    ).rejects.toThrow('Amendment not found after update');

    mocks.queuedResults.push({ id: 'candidate-1' }, null);
    await expect(
      execute('update_election_candidate', { candidateId: 'candidate-1', statement: 'Text' })
    ).rejects.toThrow('Election candidate not found after update');
  });
});
