import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryOperation {
  kind: 'where' | 'orderBy';
  args: unknown[];
}

interface TestQuery {
  table: string;
  operations: QueryOperation[];
  single: boolean;
  maximum: number | null;
  where: (...args: unknown[]) => TestQuery;
  orderBy: (...args: unknown[]) => TestQuery;
  limit: (value: number) => TestQuery;
  one: () => TestQuery;
}

interface MutationDescriptor {
  name: string;
  args: Record<string, unknown>;
}

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  accessAllowed: true,
  tables: new Map<string, Row[]>(),
  directMutations: [] as { name: string; args: Row }[],
  runZeroMutator: vi.fn(
    async (_transaction: unknown, _mutation: MutationDescriptor, _context: unknown) => undefined
  ),
  notifyAgendaItemCreated: vi.fn(async () => undefined),
  notifyPaymentCreated: vi.fn(async () => undefined),
  notifyTodoAssigned: vi.fn(async () => undefined),
  cardResult: {
    cardType: 'test-card' as string | null,
    cardProps: { marker: true } as Row | null,
  },
}));

function createQuery(table: string): TestQuery {
  const query: TestQuery = {
    table,
    operations: [],
    single: false,
    maximum: null,
    where: (...args: unknown[]) => {
      query.operations.push({ kind: 'where', args });
      return query;
    },
    orderBy: (...args: unknown[]) => {
      query.operations.push({ kind: 'orderBy', args });
      return query;
    },
    limit: (value: number) => {
      query.maximum = value;
      return query;
    },
    one: () => {
      query.single = true;
      return query;
    },
  };
  return query;
}

function readQuery(query: TestQuery): Row | Row[] | null {
  let rows = [...(mocks.tables.get(query.table) ?? [])];
  for (const operation of query.operations) {
    if (operation.kind === 'where') {
      const [field, operatorOrValue, possibleValue] = operation.args;
      const operator = possibleValue === undefined ? '=' : operatorOrValue;
      const expected = possibleValue === undefined ? operatorOrValue : possibleValue;
      rows = rows.filter(row => {
        const actual = row[String(field)];
        if (operator === 'IN') {
          return (expected as unknown[]).includes(actual);
        }
        if (operator === 'ILIKE') {
          return String(actual).toLocaleLowerCase().includes(String(expected).toLocaleLowerCase());
        }
        return actual === expected;
      });
    } else {
      const [field, direction] = operation.args;
      rows.sort((left, right) => {
        const leftValue = Number(left[String(field)] ?? 0);
        const rightValue = Number(right[String(field)] ?? 0);
        return direction === 'desc' ? rightValue - leftValue : leftValue - rightValue;
      });
    }
  }
  if (query.maximum !== null) {
    rows = rows.slice(0, query.maximum);
  }
  return query.single ? (rows[0] ?? null) : rows;
}

function makeMutationTree(prefix: string): object {
  return new Proxy(
    {},
    {
      get: (_target, domain) =>
        new Proxy(
          {},
          {
            get:
              (_nestedTarget, operation) =>
              (args: Row): MutationDescriptor => ({
                name: `${prefix}.${String(domain)}.${String(operation)}`,
                args,
              }),
          }
        ),
    }
  );
}

function makeDirectMutationTree(): object {
  return new Proxy(
    {},
    {
      get: (_target, table) =>
        new Proxy(
          {},
          {
            get: (_nestedTarget, operation) => async (args: Row) => {
              mocks.directMutations.push({ name: `${String(table)}.${String(operation)}`, args });
            },
          }
        ),
    }
  );
}

const testTransaction = {
  run: vi.fn(async (query: TestQuery) => readQuery(query)),
  mutate: makeDirectMutationTree(),
};

vi.mock('@/zero/schema', () => ({
  zql: new Proxy(
    {},
    {
      get: (_target, table) => createQuery(String(table)),
    }
  ),
}));

vi.mock('@/zero/mutators', () => ({ mutators: makeMutationTree('client') }));
vi.mock('@/zero/server-mutators', () => ({ serverMutators: makeMutationTree('server') }));
vi.mock('@/features/auth/logic/checkEntityAccess', () => ({
  checkEntityAccess: () => mocks.accessAllowed,
}));
vi.mock('@/features/search/logic/buildTimelineCardProps', () => ({
  buildTimelineCardProps: () => mocks.cardResult,
}));
vi.mock('@/lib/ai/entityHref', () => ({
  buildAiEntityHref: (entityType: string, entityId: string) => `/${entityType}/${entityId}`,
}));
vi.mock('@/features/notifications/utils/notification-helpers', () => ({
  notifyAgendaItemCreated: mocks.notifyAgendaItemCreated,
  notifyPaymentCreated: mocks.notifyPaymentCreated,
  notifyTodoAssigned: mocks.notifyTodoAssigned,
}));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: (userId: string) => ({ userID: userId }),
  executeZeroTransaction: async (
    context: { userID: string },
    callback: (transaction: typeof testTransaction, context: { userID: string }) => Promise<void>
  ) => callback(testTransaction, context),
  runZeroMutator: mocks.runZeroMutator,
}));

import {
  buildAiCreateTools,
  buildAttachment,
  buildEventCreateArgs,
  buildMutationResult,
  buildUpdatedResult,
  formatCurrency,
  formatDate,
  normalizeStringList,
  parseOptionalTimestamp,
  toRichText,
  truncate,
} from '../ai-create-tools';

type ToolName = keyof ReturnType<typeof buildAiCreateTools>;

function setRows(table: string, rows: Row[]): void {
  mocks.tables.set(table, rows);
}

function mutationCalls(name: string): MutationDescriptor[] {
  return mocks.runZeroMutator.mock.calls
    .map(call => call[1] as MutationDescriptor)
    .filter(mutation => mutation.name === name);
}

async function executeTool(name: ToolName, input: unknown): Promise<Record<string, unknown>> {
  const tools = buildAiCreateTools('user-1', 'Europe/Berlin');
  const selected = tools[name] as unknown as {
    execute: (value: unknown, options: unknown) => Promise<Record<string, unknown>>;
  };
  return selected.execute(input, {});
}

const publicGroup: Row = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Public Group',
  visibility: 'public',
  owner_id: 'user-1',
};

const publicEvent: Row = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Public Event',
  visibility: 'public',
  creator_id: 'user-1',
  group_id: publicGroup.id,
};

function defaultRelationshipRights() {
  return {
    informationRight: 'none',
    amendmentRight: 'none',
    rightToSpeak: 'none',
    activeVotingRight: 'none',
    passiveVotingRight: 'none',
  } as const;
}

function defaultGroupInput(overrides: Row = {}): Row {
  return {
    name: 'New Group',
    groupType: 'base',
    membershipMode: 'none',
    relationshipRights: defaultRelationshipRights(),
    visibility: 'public',
    hashtags: [],
    invitedUserIds: [],
    ...overrides,
  };
}

function defaultEventInput(overrides: Row = {}): Row {
  return {
    title: 'New Event',
    eventType: 'open',
    visibility: 'public',
    locationType: 'physical',
    hashtags: [],
    invitedUserIds: [],
    ...overrides,
  };
}

function defaultAgendaInput(overrides: Row = {}): Row {
  return {
    eventId: publicEvent.id,
    title: 'Agenda item',
    type: 'discussion',
    majorityType: 'simple',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.tables.clear();
  mocks.directMutations.length = 0;
  mocks.runZeroMutator.mockClear();
  mocks.notifyAgendaItemCreated.mockClear();
  mocks.notifyPaymentCreated.mockClear();
  mocks.notifyTodoAssigned.mockClear();
  mocks.accessAllowed = true;
  mocks.cardResult = { cardType: 'test-card', cardProps: { marker: true } };
  testTransaction.run.mockClear();
  setRows('group', [publicGroup]);
  setRows('group_membership', []);
  setRows('role', []);
  setRows('event', [publicEvent]);
  setRows('event_participant', []);
  setRows('hashtag', []);
  setRows('user_preference', []);
  setRows('agenda_item', []);
  setRows('election', []);
  setRows('election_candidate', []);
});

describe('AI create tool pure contracts', () => {
  it('formats dates and currencies without inventing invalid values', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate(Number.NaN)).toBeNull();
    expect(formatDate(0)).toContain('1970');
    expect(formatCurrency(12.5, 'EUR')).toContain('EUR');
  });

  it('normalizes summaries, lists and rich text at their boundaries', () => {
    expect(truncate(undefined)).toBeNull();
    expect(truncate('')).toBeNull();
    expect(truncate(' short ', 10)).toBe('short');
    expect(truncate('abcdef', 5)).toBe('abcd…');
    expect(normalizeStringList()).toEqual([]);
    expect(normalizeStringList(null)).toEqual([]);
    expect(normalizeStringList([' alpha ', '', 'alpha', ' beta '])).toEqual(['alpha', 'beta']);
    expect(toRichText()).toBeNull();
    expect(toRichText('   ')).toBeNull();
    expect(toRichText(' text ')).toEqual([{ type: 'p', children: [{ text: 'text' }] }]);
  });

  it('parses optional timestamps and rejects invalid input', () => {
    expect(parseOptionalTimestamp()).toBeNull();
    expect(parseOptionalTimestamp('  ')).toBeNull();
    expect(() => parseOptionalTimestamp('not-a-date')).toThrow('Invalid date/time value');
    expect(parseOptionalTimestamp('2026-01-02T12:00:00Z')).toBe(1_767_355_200_000);
  });

  it('builds attachments with and without renderable card data', () => {
    const searchItem = {
      id: 'e-1',
      type: 'event',
      title: 'Event',
      createdAt: new Date(0),
    } as Parameters<typeof buildAttachment>[5];
    const withoutItem = buildAttachment('group', 'g-1', 'Group');
    expect(withoutItem).toMatchObject({
      subtitle: null,
      prompt_context: null,
      card_data_json: null,
      href: '/group/g-1',
    });

    mocks.cardResult = { cardType: null, cardProps: { marker: true } };
    expect(buildAttachment('event', 'e-1', 'Event', null, null, searchItem)).toMatchObject({
      card_data_json: null,
    });
    mocks.cardResult = { cardType: 'event', cardProps: null };
    expect(buildAttachment('event', 'e-1', 'Event', null, null, searchItem)).toMatchObject({
      card_data_json: null,
    });
    mocks.cardResult = { cardType: 'event', cardProps: { id: 'e-1' } };
    expect(buildAttachment('event', 'e-1', 'Event', 'Soon', 'Context', searchItem)).toMatchObject({
      subtitle: 'Soon',
      prompt_context: 'Context',
      card_data_json: JSON.stringify({ cardType: 'event', cardProps: { id: 'e-1' } }),
    });
  });

  it('marks mutation results with their requested context', () => {
    const attachment = buildAttachment('group', 'g-1', 'Group');
    expect(buildMutationResult('Created', attachment, '/group/g-1')).toMatchObject({
      summary: 'Created',
      route: '/group/g-1',
      items: [{ entityType: 'group', entityId: 'g-1', title: 'Group', subtitle: null }],
      attachments: [{ context_type: 'output' }],
    });
    expect(buildUpdatedResult('Updated', attachment, '/group/g-1')).toMatchObject({
      attachments: [{ context_type: 'update' }],
    });
  });

  it('maps physical and online event inputs without leaking location fields', () => {
    expect(
      buildEventCreateArgs({
        id: 'event-1',
        title: 'Physical',
        description: ' Description ',
        event_type: 'delegate_assembly',
        group_id: 'group-1',
        visibility: 'authenticated',
        location_type: 'physical',
        location_name: 'Hall',
        location_url: 'https://ignored.test',
        country: 'DE',
        region: 'BE',
        post_code: '10115',
        city: 'Berlin',
        street: 'Street',
        house_number: '1',
        latitude: 52.5,
        longitude: 13.4,
        start_date: 1,
        end_date: 2,
        capacity: 100,
        image_url: 'https://image.test/a.png',
        has_delegates: true,
        total_delegate_seats: 10,
        delegates_nomination_deadline: 3,
        amendment_deadline: 4,
        invited_user_ids: [' user-2 ', 'user-2'],
      })
    ).toMatchObject({
      description: [{ type: 'p', children: [{ text: 'Description' }] }],
      location_name: 'Hall',
      location_url: null,
      country: 'DE',
      group_id: 'group-1',
      has_delegates: true,
      invited_user_ids: ['user-2'],
    });

    expect(
      buildEventCreateArgs({
        id: 'event-2',
        title: 'Online',
        event_type: 'open',
        visibility: 'public',
        location_type: 'online',
        location_url: 'https://meet.test',
      })
    ).toMatchObject({
      description: null,
      location_name: null,
      country: null,
      region: null,
      post_code: null,
      city: null,
      street: null,
      house_number: null,
      latitude: null,
      longitude: null,
      location_url: 'https://meet.test',
      start_date: null,
      end_date: null,
      capacity: null,
      image_url: null,
      has_delegates: false,
      total_delegate_seats: null,
      delegates_nomination_deadline: null,
      amendment_deadline: null,
      group_id: null,
      invited_user_ids: [],
    });
  });
});

describe('group create contracts', () => {
  it('creates a base group, de-duplicates invitations and skips the current user', async () => {
    const result = await executeTool(
      'create_group',
      defaultGroupInput({
        description: ' Description ',
        invitedUserIds: ['user-1', ' user-2 ', 'user-2'],
      })
    );

    expect(result.route).toMatch(/^\/group\//);
    expect(mutationCalls('server.groups.create')).toHaveLength(1);
    expect(mutationCalls('server.groups.inviteMember')).toHaveLength(1);
  });

  it('creates hashtags and an optional constitutional event', async () => {
    setRows('hashtag', [{ id: 'hashtag-existing', tag: 'existing' }]);
    await executeTool(
      'create_group',
      defaultGroupInput({
        email: 'group@example.test',
        country: 'DE',
        region: 'BE',
        postCode: '10115',
        city: 'Berlin',
        street: 'Street',
        houseNumber: '1',
        latitude: 52.5,
        longitude: 13.4,
        imageUrl: 'https://image.test/group.png',
        hashtags: ['existing', 'new'],
        invitedUserIds: ['user-2'],
        constitutionalEvent: {
          title: 'Founding assembly',
          location: 'Hall',
          startsAt: '2026-08-04T10:00',
        },
      })
    );

    expect(mocks.directMutations.map(call => call.name)).toEqual([
      'hashtag.insert',
      'group_hashtag.insert',
      'group_hashtag.insert',
    ]);
    expect(mutationCalls('server.events.create')).toHaveLength(1);
  });

  it('requires a connected group for sibling creation', async () => {
    await expect(
      executeTool('create_group', defaultGroupInput({ groupType: 'sibling' }))
    ).rejects.toThrow('connectedGroupId is required');
  });

  it('requires a flow for configured sibling membership', async () => {
    await expect(
      executeTool(
        'create_group',
        defaultGroupInput({
          groupType: 'sibling',
          connectedGroupId: publicGroup.id,
          membershipMode: 'all_members',
        })
      )
    ).rejects.toThrow('membershipFlow is required');
  });

  it('requires and resolves a role for role-based sibling membership', async () => {
    await expect(
      executeTool(
        'create_group',
        defaultGroupInput({
          groupType: 'sibling',
          connectedGroupId: publicGroup.id,
          membershipMode: 'role_members',
          membershipFlow: 'partner_members_to_current',
        })
      )
    ).rejects.toThrow('requiredSourceRoleId is required');

    setRows('role', [
      {
        id: '33333333-3333-4333-8333-333333333333',
        group_id: publicGroup.id,
        scope: 'group',
        name: 'Delegates',
      },
    ]);
    await executeTool(
      'create_group',
      defaultGroupInput({
        groupType: 'sibling',
        connectedGroupId: publicGroup.id,
        membershipMode: 'role_members',
        membershipFlow: 'partner_members_to_current',
        requiredSourceRoleId: 'Delegates',
        invitedUserIds: ['user-2'],
      })
    );

    expect(mutationCalls('server.groups.inviteMember')).toHaveLength(0);
    expect(mutationCalls('server.network.proposeGroupConnectionChange')[0].args).toMatchObject({
      membership_rule: {
        member_source_group_id: publicGroup.id,
        required_source_role_id: '33333333-3333-4333-8333-333333333333',
      },
    });
  });

  it('builds directed and mutual relationship grants', async () => {
    await executeTool(
      'create_group',
      defaultGroupInput({
        groupType: 'sibling',
        connectedGroupId: publicGroup.id,
        membershipMode: 'all_members',
        membershipFlow: 'current_members_to_partner',
        relationshipRights: {
          informationRight: 'none',
          amendmentRight: 'mutual',
          rightToSpeak: 'current_grants_right_to_partner',
          activeVotingRight: 'partner_grants_right_to_current',
          passiveVotingRight: 'none',
        },
      })
    );

    const proposal = mutationCalls('server.network.proposeGroupConnectionChange')[0];
    expect(proposal.args.grants).toHaveLength(4);
    expect(proposal.args.membership_rule).toMatchObject({
      member_source_group_id: expect.any(String),
      member_target_group_id: publicGroup.id,
      membership_mode: 'all_members',
    });
  });

  it('creates sibling groups without a membership rule and keeps explicit invitations', async () => {
    await executeTool(
      'create_group',
      defaultGroupInput({
        groupType: 'sibling',
        connectedGroupId: publicGroup.id,
        membershipMode: 'none',
        invitedUserIds: ['user-2'],
      })
    );
    expect(mutationCalls('server.groups.inviteMember')).toHaveLength(1);
    expect(mutationCalls('server.network.proposeGroupConnectionChange')[0].args).toMatchObject({
      membership_rule: null,
    });
  });

  it('validates UUID and named role references in the connected group', async () => {
    const roleInput = (requiredSourceRoleId: string) =>
      defaultGroupInput({
        groupType: 'sibling',
        connectedGroupId: publicGroup.id,
        membershipMode: 'role_members',
        membershipFlow: 'partner_members_to_current',
        requiredSourceRoleId,
      });

    await expect(executeTool('create_group', roleInput('   '))).rejects.toThrow(
      'Missing role reference'
    );
    const roleId = '33333333-3333-4333-8333-333333333333';
    await expect(executeTool('create_group', roleInput(roleId))).rejects.toThrow('Role not found');
    setRows('role', [{ id: roleId, group_id: 'other-group', scope: 'group', name: 'Delegates' }]);
    await expect(executeTool('create_group', roleInput(roleId))).rejects.toThrow('Role not found');
    setRows('role', [{ id: roleId, group_id: publicGroup.id, scope: 'event', name: 'Delegates' }]);
    await expect(executeTool('create_group', roleInput(roleId))).rejects.toThrow('Role not found');
    setRows('role', [{ id: roleId, group_id: publicGroup.id, scope: 'group', name: 'Delegates' }]);
    await expect(executeTool('create_group', roleInput(roleId))).resolves.toBeDefined();

    setRows('role', [
      { id: 'role-1', group_id: publicGroup.id, scope: 'group', name: 'Delegates' },
      { id: 'role-2', group_id: publicGroup.id, scope: 'group', name: 'Delegates' },
    ]);
    await expect(executeTool('create_group', roleInput('Delegates'))).rejects.toThrow(
      'Multiple roles named'
    );
    setRows('role', [
      { id: 'role-1', group_id: publicGroup.id, scope: 'group', name: 'Regional Delegates' },
    ]);
    await expect(executeTool('create_group', roleInput('delegates'))).resolves.toBeDefined();
    setRows('role', [
      { id: 'role-1', group_id: publicGroup.id, scope: 'group', name: 'Regional Delegates' },
      { id: 'role-2', group_id: publicGroup.id, scope: 'group', name: 'Local Delegates' },
    ]);
    await expect(executeTool('create_group', roleInput('delegates'))).rejects.toThrow(
      'Multiple roles match'
    );
    setRows('role', []);
    await expect(executeTool('create_group', roleInput('delegates'))).rejects.toThrow(
      'No group role matches'
    );
  });

  it('resolves current-group role membership against the newly generated group', async () => {
    const generatedGroupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const randomUuid = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue(generatedGroupId as `${string}-${string}-${string}-${string}-${string}`);
    setRows('role', [
      { id: 'role-current', group_id: generatedGroupId, scope: 'group', name: 'Members' },
    ]);
    try {
      await executeTool(
        'create_group',
        defaultGroupInput({
          groupType: 'sibling',
          connectedGroupId: publicGroup.id,
          membershipMode: 'role_members',
          membershipFlow: 'current_members_to_partner',
          requiredSourceRoleId: 'Members',
        })
      );
    } finally {
      randomUuid.mockRestore();
    }
    expect(mutationCalls('server.network.proposeGroupConnectionChange')[0].args).toMatchObject({
      membership_rule: { member_source_group_id: generatedGroupId },
    });
  });

  it('supports a constitutional event without optional location or start', async () => {
    await executeTool(
      'create_group',
      defaultGroupInput({ constitutionalEvent: { title: 'Founding assembly' } })
    );
    expect(mutationCalls('server.events.create')[0].args).toMatchObject({
      location_name: null,
      start_date: null,
    });
  });
});

describe('reference and access contracts', () => {
  it('resolves a group by exact and fuzzy accessible names', async () => {
    await expect(
      executeTool('create_event', defaultEventInput({ groupId: 'Public Group' }))
    ).resolves.toMatchObject({ route: expect.stringMatching(/^\/event\//) });

    setRows('group', [{ ...publicGroup, name: 'North Coalition', owner_id: 'other-user' }]);
    setRows('group_membership', [{ group_id: publicGroup.id, user_id: 'user-1' }]);
    await expect(
      executeTool('create_event', defaultEventInput({ groupId: 'coalition' }))
    ).resolves.toMatchObject({ route: expect.stringMatching(/^\/event\//) });
  });

  it('accepts direct UUID access through membership when the user is not owner', async () => {
    setRows('group', [{ ...publicGroup, owner_id: 'other-user' }]);
    setRows('group_membership', [{ group_id: publicGroup.id, user_id: 'user-1' }]);
    await expect(
      executeTool('create_event', defaultEventInput({ groupId: publicGroup.id }))
    ).resolves.toBeDefined();
  });

  it('rejects missing, unknown, inaccessible and ambiguous group references', async () => {
    await expect(
      executeTool('create_event', defaultEventInput({ groupId: '   ' }))
    ).rejects.toThrow('Missing group reference');

    setRows('group', []);
    await expect(
      executeTool('create_event', defaultEventInput({ groupId: publicGroup.id }))
    ).rejects.toThrow('Group not found');
    await expect(
      executeTool('create_event', defaultEventInput({ groupId: 'Unknown' }))
    ).rejects.toThrow('No accessible group matches');

    setRows('group', [{ ...publicGroup, owner_id: 'other-user', visibility: 'private' }]);
    mocks.accessAllowed = false;
    await expect(
      executeTool('create_event', defaultEventInput({ groupId: publicGroup.id }))
    ).rejects.toThrow('do not have access');
    await expect(
      executeTool('create_event', defaultEventInput({ groupId: 'Public Group' }))
    ).rejects.toThrow('No accessible group matches');

    mocks.accessAllowed = true;
    setRows('group', [publicGroup, { ...publicGroup, id: 'group-2' }]);
    await expect(
      executeTool('create_event', defaultEventInput({ groupId: 'Public Group' }))
    ).rejects.toThrow('Multiple accessible groups');
  });

  it('resolves events by UUID, exact title, fuzzy title and participant relationship', async () => {
    await expect(executeTool('create_agenda_item', defaultAgendaInput())).resolves.toMatchObject({
      route: `/event/${publicEvent.id}/agenda`,
    });
    await expect(
      executeTool('create_agenda_item', defaultAgendaInput({ eventId: 'Public Event' }))
    ).resolves.toMatchObject({ route: `/event/${publicEvent.id}/agenda` });

    setRows('event', [{ ...publicEvent, title: 'Regional Assembly', creator_id: 'other-user' }]);
    setRows('event_participant', [{ event_id: publicEvent.id, user_id: 'user-1' }]);
    await expect(
      executeTool('create_agenda_item', defaultAgendaInput({ eventId: 'assembly' }))
    ).resolves.toMatchObject({ route: `/event/${publicEvent.id}/agenda` });
  });

  it('accepts direct UUID event access through participation when the user is not creator', async () => {
    setRows('event', [{ ...publicEvent, creator_id: 'other-user' }]);
    setRows('event_participant', [{ event_id: publicEvent.id, user_id: 'user-1' }]);
    await expect(executeTool('create_agenda_item', defaultAgendaInput())).resolves.toBeDefined();
  });

  it('rejects missing, unknown, inaccessible and ambiguous event references', async () => {
    await expect(
      executeTool('create_agenda_item', defaultAgendaInput({ eventId: '  ' }))
    ).rejects.toThrow('Missing event reference');
    setRows('event', []);
    await expect(executeTool('create_agenda_item', defaultAgendaInput())).rejects.toThrow(
      'Event not found'
    );
    await expect(
      executeTool('create_agenda_item', defaultAgendaInput({ eventId: 'Unknown' }))
    ).rejects.toThrow('No accessible event matches');

    setRows('event', [{ ...publicEvent, creator_id: 'other-user', visibility: 'private' }]);
    mocks.accessAllowed = false;
    await expect(executeTool('create_agenda_item', defaultAgendaInput())).rejects.toThrow(
      'do not have access'
    );
    await expect(
      executeTool('create_agenda_item', defaultAgendaInput({ eventId: 'Public Event' }))
    ).rejects.toThrow('No accessible event matches');

    mocks.accessAllowed = true;
    setRows('event', [publicEvent, { ...publicEvent, id: 'event-2' }]);
    await expect(
      executeTool('create_agenda_item', defaultAgendaInput({ eventId: 'Public Event' }))
    ).rejects.toThrow('Multiple accessible events');
  });
});

describe('remaining create tool contracts', () => {
  it('creates physical delegate and online events with optional group linkage', async () => {
    await executeTool(
      'create_event',
      defaultEventInput({
        description: 'Description',
        eventType: 'delegate_assembly',
        groupId: publicGroup.id,
        locationName: 'Hall',
        country: 'DE',
        region: 'BE',
        postCode: '10115',
        city: 'Berlin',
        street: 'Street',
        houseNumber: '1',
        latitude: 1,
        longitude: 2,
        startsAt: '2026-08-04T10:00',
        endsAt: '2026-08-04T12:00',
        capacity: 100,
        imageUrl: 'https://image.test/event.png',
        hashtags: ['event'],
        invitedUserIds: ['user-2'],
        delegatesNominationDeadline: '2026-08-03T10:00',
        amendmentDeadline: '2026-08-03T11:00',
        totalDelegateSeats: 20,
      })
    );
    await executeTool(
      'create_event',
      defaultEventInput({ locationType: 'online', locationUrl: 'https://meet.test' })
    );
    expect(mutationCalls('server.events.create')).toHaveLength(2);
    expect(mocks.directMutations.map(call => call.name)).toContain('event_hashtag.insert');
  });

  it('preserves delegate and online event fallbacks when optional values are absent', async () => {
    await executeTool('create_event', defaultEventInput({ eventType: 'delegate_assembly' }));
    await executeTool('create_event', defaultEventInput({ locationType: 'online' }));
    expect(mutationCalls('server.events.create')[0].args).toMatchObject({
      has_delegates: true,
      total_delegate_seats: null,
    });
    expect(mutationCalls('server.events.create')[1].args).toMatchObject({ location_url: null });
  });

  it('creates an amendment document and an optional routed agenda/vote path', async () => {
    await executeTool('create_amendment', {
      title: 'Amendment',
      visibility: 'public',
      hashtags: [],
      pathSegments: [],
    });
    await executeTool('create_amendment', {
      title: 'Routed amendment',
      code: 'A-1',
      reason: 'Because',
      groupId: publicGroup.id,
      eventId: publicEvent.id,
      visibility: 'authenticated',
      hashtags: ['policy'],
      imageUrl: 'https://image.test/amendment.png',
      workflowId: ' workflow-1 ',
      pathSegments: [
        { groupId: publicGroup.id, eventId: publicEvent.id, forwardingStatus: ' ready ' },
        {},
      ],
    });

    expect(mutationCalls('server.amendments.create')).toHaveLength(2);
    expect(mutationCalls('server.documents.create')).toHaveLength(2);
    expect(mutationCalls('server.amendments.createPath')).toHaveLength(1);
    expect(mutationCalls('server.amendments.createPathSegment')).toHaveLength(2);
    expect(mutationCalls('server.agendas.createAgendaItem')).toHaveLength(1);
    expect(mutationCalls('server.votes.createVote')).toHaveLength(1);
  });

  it('creates a routed amendment with empty workflow and reason fallbacks', async () => {
    await executeTool('create_amendment', {
      title: 'Fallback path',
      visibility: 'public',
      hashtags: [],
      workflowId: '   ',
      pathSegments: [{ eventId: publicEvent.id }],
    });
    expect(mutationCalls('server.amendments.createPath')[0].args).toMatchObject({
      workflow_id: null,
    });
    expect(mutationCalls('server.agendas.createAgendaItem')[0].args).toMatchObject({
      description: '',
    });
    expect(mutationCalls('server.votes.createVote')[0].args).toMatchObject({ description: null });
  });

  it('creates user and group blog entries with explicit and default dates', async () => {
    const personal = await executeTool('create_blog_entry', {
      title: 'Personal',
      visibility: 'public',
      hashtags: [],
    });
    const grouped = await executeTool('create_blog_entry', {
      title: 'Grouped',
      date: '2026-08-04',
      visibility: 'private',
      hashtags: ['news'],
      imageUrl: 'https://image.test/blog.png',
      groupId: publicGroup.id,
    });
    expect(personal.route).toMatch(/^\/user\/user-1\/blog\//);
    expect(grouped.route).toMatch(new RegExp(`^/group/${String(publicGroup.id)}/blog/`));
  });

  it('falls back to creation time when a directly executed blog date is invalid', async () => {
    await expect(
      executeTool('create_blog_entry', {
        title: 'Imported legacy date',
        date: 'invalid-date',
        visibility: 'public',
        hashtags: [],
      })
    ).resolves.toBeDefined();
  });

  it('creates pending and completed todos and only notifies external group assignees', async () => {
    await executeTool('create_todo', {
      title: 'Mine',
      priority: 'low',
      status: 'pending',
      visibility: 'private',
      tags: [],
    });
    await executeTool('create_todo', {
      title: 'Assigned',
      description: 'Do this',
      priority: 'high',
      status: 'completed',
      dueDate: '2026-08-04',
      visibility: 'authenticated',
      tags: ['work'],
      assigneeId: ' user-2 ',
      groupId: publicGroup.id,
      eventId: publicEvent.id,
      amendmentId: 'amendment-1',
    });
    expect(mutationCalls('client.todos.create')).toHaveLength(2);
    expect(mutationCalls('client.todos.assign')).toHaveLength(2);
    expect(mocks.notifyTodoAssigned).toHaveBeenCalledOnce();
  });

  it('uses the todo notification group fallback when a group has no name', async () => {
    setRows('group', [{ ...publicGroup, name: null }]);
    await executeTool('create_todo', {
      title: 'Assigned',
      priority: 'medium',
      status: 'pending',
      visibility: 'private',
      tags: [],
      assigneeId: 'user-2',
      groupId: publicGroup.id,
    });
    expect(mocks.notifyTodoAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ groupName: 'Group' })
    );
  });

  it('creates statements without and with valid surveys', async () => {
    await executeTool('create_statement', {
      text: 'Simple statement',
      visibility: 'public',
      hashtags: [],
      surveyOptions: [],
      surveyDurationHours: 24,
    });
    await executeTool('create_statement', {
      text: 'Survey statement',
      groupId: publicGroup.id,
      imageUrl: 'https://image.test/statement.png',
      videoUrl: 'https://video.test/statement.mp4',
      visibility: 'authenticated',
      hashtags: ['survey'],
      surveyQuestion: ' Choose? ',
      surveyOptions: [' Yes ', 'No', 'Yes'],
      surveyDurationHours: 48,
    });
    expect(mutationCalls('server.statements.create')).toHaveLength(2);
    expect(mutationCalls('server.statements.createSurvey')).toHaveLength(1);
    expect(mutationCalls('server.statements.createSurveyOption')).toHaveLength(2);
  });

  it('validates payment counterparties before opening a transaction', async () => {
    await expect(
      executeTool('create_payment', {
        groupId: publicGroup.id,
        direction: 'income',
        label: 'Donation',
        type: 'donation',
        amount: 10,
      })
    ).rejects.toThrow('Either counterpartyUserId or counterpartyGroupId');
    await expect(
      executeTool('create_payment', {
        groupId: publicGroup.id,
        direction: 'income',
        label: 'Donation',
        type: 'donation',
        amount: 10,
        counterpartyUserId: 'user-2',
        counterpartyGroupId: publicGroup.id,
      })
    ).rejects.toThrow('Specify only one counterparty');
  });

  it('creates income and expense payments for users and groups', async () => {
    setRows('user_preference', [{ user_id: 'user-1', display_currency: 'USD' }]);
    await executeTool('create_payment', {
      groupId: publicGroup.id,
      direction: 'income',
      label: 'Donation',
      type: 'donation',
      amount: 10,
      counterpartyUserId: 'user-2',
    });
    const counterpartyGroupId = '44444444-4444-4444-8444-444444444444';
    setRows('group', [publicGroup, { ...publicGroup, id: counterpartyGroupId, name: null }]);
    await executeTool('create_payment', {
      groupId: publicGroup.id,
      direction: 'expense',
      label: 'Material',
      type: 'material',
      amount: 20,
      currency: 'EUR',
      counterpartyGroupId,
    });
    expect(mutationCalls('client.payments.createPayment')).toHaveLength(2);
    expect(mocks.notifyPaymentCreated).toHaveBeenCalledTimes(2);
  });

  it('uses payment currency and party fallbacks for group income', async () => {
    const counterpartyGroupId = '44444444-4444-4444-8444-444444444444';
    setRows('group', [
      { ...publicGroup, name: null },
      { ...publicGroup, id: counterpartyGroupId, name: null },
    ]);
    await executeTool('create_payment', {
      groupId: publicGroup.id,
      direction: 'income',
      label: 'Transfer',
      type: 'others',
      amount: 5,
      counterpartyGroupId,
    });
    expect(mutationCalls('client.payments.createPayment')[0].args).toMatchObject({
      currency: 'EUR',
      payer_user_id: null,
      payer_group_id: counterpartyGroupId,
      receiver_user_id: null,
      receiver_group_id: publicGroup.id,
    });
    expect(mocks.notifyPaymentCreated).toHaveBeenCalledWith(
      expect.objectContaining({ groupName: 'Group' })
    );
  });

  it('creates discussion, election and vote agenda items', async () => {
    setRows('agenda_item', [{ event_id: publicEvent.id, order_index: 4 }]);
    await executeTool('create_agenda_item', defaultAgendaInput());
    await executeTool(
      'create_agenda_item',
      defaultAgendaInput({
        title: 'Election',
        type: 'election',
        description: 'Elect',
        orderIndex: 2,
        durationMinutes: 15,
        roleId: 'role-1',
        majorityType: 'absolute',
        timeLimitMinutes: 3,
      })
    );
    await executeTool(
      'create_agenda_item',
      defaultAgendaInput({
        title: 'Vote',
        type: 'vote',
        amendmentId: 'amendment-1',
        majorityType: 'two_thirds',
      })
    );
    expect(mutationCalls('server.agendas.createAgendaItem')).toHaveLength(3);
    expect(mutationCalls('server.elections.createElection')).toHaveLength(1);
    expect(mutationCalls('server.votes.createVote')).toHaveLength(1);
    expect(mutationCalls('server.votes.createVoteChoice')).toHaveLength(3);
    expect(mocks.notifyAgendaItemCreated).toHaveBeenCalledTimes(3);
  });

  it('covers agenda defaults for unnamed events, optional election fields and described votes', async () => {
    setRows('event', [{ ...publicEvent, title: null }]);
    setRows('agenda_item', [{ event_id: publicEvent.id, order_index: null }]);
    await executeTool(
      'create_agenda_item',
      defaultAgendaInput({ title: 'Election defaults', type: 'election' })
    );
    await executeTool(
      'create_agenda_item',
      defaultAgendaInput({ title: 'Described vote', type: 'vote', description: 'Vote now' })
    );
    expect(mutationCalls('server.elections.createElection')[0].args).toMatchObject({
      role_id: null,
      description: null,
    });
    expect(mutationCalls('server.votes.createVote')[0].args).toMatchObject({
      amendment_id: null,
      description: 'Vote now',
    });
    expect(mocks.notifyAgendaItemCreated).toHaveBeenCalledWith(
      expect.objectContaining({ eventTitle: 'Event' })
    );
  });

  it('rejects missing elections and duplicate candidacies', async () => {
    await expect(
      executeTool('create_election_candidate', { electionId: 'election-1' })
    ).rejects.toThrow('Election not found');

    setRows('election', [{ id: 'election-1', title: 'Board', agenda_item_id: null }]);
    setRows('election_candidate', [
      { id: 'candidate-1', election_id: 'election-1', user_id: 'user-1' },
    ]);
    await expect(
      executeTool('create_election_candidate', { electionId: 'election-1' })
    ).rejects.toThrow('already listed');
  });

  it('creates candidates with standalone and event agenda routes', async () => {
    setRows('election', [{ id: 'election-1', title: null, agenda_item_id: null }]);
    const standalone = await executeTool('create_election_candidate', {
      electionId: 'election-1',
    });
    expect(standalone.route).toBe('/election/election-1');

    setRows('election', [{ id: 'election-2', title: 'Board', agenda_item_id: 'agenda-1' }]);
    setRows('agenda_item', [{ id: 'agenda-1', event_id: publicEvent.id }]);
    const eventCandidate = await executeTool('create_election_candidate', {
      electionId: 'election-2',
      statement: ' My statement ',
      imageUrl: 'https://image.test/candidate.png',
    });
    expect(eventCandidate.route).toBe(`/event/${publicEvent.id}/agenda`);
    expect(mutationCalls('server.elections.addCandidate')).toHaveLength(2);
  });

  it('creates a standalone candidate when its agenda item no longer exists', async () => {
    setRows('election', [{ id: 'election-3', title: 'Board', agenda_item_id: 'deleted-agenda' }]);
    const result = await executeTool('create_election_candidate', { electionId: 'election-3' });
    expect(result.route).toBe('/election/election-3');
  });
});
