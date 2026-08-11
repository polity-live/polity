import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getDirectSubgroups: vi.fn(),
  calculateDelegateAllocations: vi.fn(),
  finalizeDelegateSelection: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator = (value: unknown) => value;
    const chain = {
      validator(nextValidator: (value: unknown) => unknown) {
        validator = nextValidator;
        return chain;
      },
      handler(handler: (input: any) => unknown) {
        return (input: any) => handler({ ...input, data: validator(input.data) });
      },
    };
    return chain;
  },
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/shared/utils/delegate-calculations', () => ({
  getDirectSubgroups: (...args: unknown[]) => mocks.getDirectSubgroups(...args),
  calculateDelegateAllocations: (...args: unknown[]) => mocks.calculateDelegateAllocations(...args),
  finalizeDelegateSelection: (...args: unknown[]) => mocks.finalizeDelegateSelection(...args),
}));
vi.mock('@/features/notifications/utils/notification-helpers.ts', () => ({
  notifyDelegatesFinalized: (...args: unknown[]) => mocks.notify(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { finalizeDelegatesFn } from '../finalize-delegates';

interface DatabaseFixture {
  event?: any;
  eventError?: any;
  delegates?: any[];
  connections?: any[];
  groups?: any[];
}

function thenable(result: unknown) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    single: async () => result,
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function database(fixture: DatabaseFixture) {
  const writes = { updates: [] as any[], upserts: [] as any[] };
  const client = {
    from(table: string) {
      return {
        select() {
          if (table === 'event') {
            return thenable({ data: fixture.event ?? null, error: fixture.eventError ?? null });
          }
          if (table === 'event_delegate') {
            return thenable({
              data: 'delegates' in fixture ? fixture.delegates : [],
              error: null,
            });
          }
          if (table === 'group_connection') {
            return thenable({
              data: 'connections' in fixture ? fixture.connections : [],
              error: null,
            });
          }
          if (table === 'group') {
            return thenable({ data: 'groups' in fixture ? fixture.groups : [], error: null });
          }
          throw new Error(`Unexpected select table ${table}`);
        },
        update(value: unknown) {
          return {
            eq: async (column: string, id: string) => {
              writes.updates.push({ table, value, column, id });
              return { error: null };
            },
          };
        },
        async upsert(value: unknown, options: unknown) {
          writes.upserts.push({ table, value, options });
          return { error: null };
        },
      };
    },
  };
  return { client, writes };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  mocks.getDirectSubgroups.mockReturnValue([{ id: 'child-1', name: 'Child', memberCount: 100 }]);
  mocks.calculateDelegateAllocations.mockReturnValue([
    { groupId: 'child-1', allocatedDelegates: 2, memberCount: 100 },
  ]);
  mocks.finalizeDelegateSelection.mockReturnValue([
    { id: 'delegate-1', status: 'selected' },
    { id: 'delegate-2', status: 'not_selected' },
  ]);
  mocks.notify.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('finalizeDelegatesFn', () => {
  it('rejects invalid configuration and incompatible delegate events before writes', async () => {
    delete process.env.SUPABASE_URL;
    await expect((finalizeDelegatesFn as any)({ data: { eventId: 'event-1' } })).rejects.toThrow(
      'Supabase environment variables are not configured'
    );

    process.env.SUPABASE_URL = 'https://supabase.test';
    const db = database({
      event: {
        id: 'event-1',
        group_id: 'parent-1',
        event_type: 'open_meeting',
        delegates_finalized: false,
      },
    });
    mocks.createClient.mockReturnValue(db.client);
    await expect((finalizeDelegatesFn as any)({ data: { eventId: 'event-1' } })).rejects.toThrow(
      'Event is not a delegate conference'
    );
    expect(db.writes.updates).toEqual([]);
  });

  it('maps hierarchy and nominations, persists allocations and statuses, and notifies once', async () => {
    const db = database({
      event: {
        id: 'event-1',
        title: 'Congress',
        group_id: 'parent-1',
        event_type: 'delegate_conference',
        delegates_finalized: false,
      },
      delegates: [
        { id: 'delegate-1', group_id: 'child-1', user_id: 'user-1', priority: 2 },
        { id: 'delegate-2', group: { id: 'child-1' }, user: { id: 'user-2' }, priority: 1 },
      ],
      connections: [
        { id: 'connection-1', parent_group_id: 'parent-1', child_group_id: 'child-1' },
        { id: 'connection-duplicate', parent_group_id: 'parent-1', child_group_id: 'child-1' },
      ],
      groups: [{ id: 'child-1', name: 'Child', member_count: 100 }],
    });
    mocks.createClient.mockReturnValue(db.client);

    await expect(
      (finalizeDelegatesFn as any)({
        data: { eventId: 'event-1', senderId: 'organizer-1' },
      })
    ).resolves.toEqual({
      success: true,
      message: 'generated.inline.0654_delegates_finalized_successfully_16440aae',
    });
    expect(mocks.getDirectSubgroups).toHaveBeenCalledWith(
      'parent-1',
      expect.arrayContaining([
        expect.objectContaining({ childGroup: { id: 'child-1', name: 'Child', memberCount: 100 } }),
      ])
    );
    expect(mocks.calculateDelegateAllocations).toHaveBeenCalledWith(
      [{ id: 'child-1', memberCount: 100 }],
      2
    );
    expect(mocks.finalizeDelegateSelection).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: 'delegate-1', groupId: 'child-1', userId: 'user-1' }),
        expect.objectContaining({ id: 'delegate-2', groupId: 'child-1', userId: 'user-2' }),
      ],
      expect.any(Array)
    );
    expect(db.writes.upserts).toHaveLength(1);
    expect(db.writes.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'event', id: 'event-1' }),
        expect.objectContaining({ table: 'event_delegate', id: 'delegate-1' }),
        expect.objectContaining({ table: 'event_delegate', id: 'delegate-2' }),
      ])
    );
    expect(mocks.notify).toHaveBeenCalledWith({
      senderId: 'organizer-1',
      eventId: 'event-1',
      eventTitle: 'Congress',
    });
  });

  it('rejects missing IDs, events, groups, finalized events and empty subgroup graphs', async () => {
    const empty = database({});
    mocks.createClient.mockReturnValue(empty.client);
    await expect((finalizeDelegatesFn as any)({ data: { eventId: '' } })).rejects.toThrow(
      'Event ID is required'
    );
    await expect((finalizeDelegatesFn as any)({ data: { eventId: 'missing' } })).rejects.toThrow(
      'Event not found'
    );

    const eventError = database({ eventError: { message: 'offline' } });
    mocks.createClient.mockReturnValue(eventError.client);
    await expect((finalizeDelegatesFn as any)({ data: { eventId: 'event-1' } })).rejects.toThrow(
      'Event not found'
    );

    const withoutGroup = database({ event: { id: 'event-1', group_id: null } });
    mocks.createClient.mockReturnValue(withoutGroup.client);
    await expect((finalizeDelegatesFn as any)({ data: { eventId: 'event-1' } })).rejects.toThrow(
      'Event has no associated group'
    );

    const finalized = database({
      event: {
        id: 'event-1',
        group_id: 'group-1',
        event_type: 'delegate_conference',
        delegates_finalized: true,
      },
    });
    mocks.createClient.mockReturnValue(finalized.client);
    await expect((finalizeDelegatesFn as any)({ data: { eventId: 'event-1' } })).rejects.toThrow(
      'Delegates already finalized'
    );

    const noSubgroups = database({
      event: {
        id: 'event-1',
        group_id: 'group-1',
        event_type: 'delegate_conference',
        delegates_finalized: false,
      },
      connections: null as never,
      delegates: null as never,
    });
    mocks.createClient.mockReturnValue(noSubgroups.client);
    mocks.getDirectSubgroups.mockReturnValueOnce([]);
    await expect((finalizeDelegatesFn as any)({ data: { eventId: 'event-1' } })).rejects.toThrow(
      'No subgroups found'
    );
  });

  it('uses sparse hierarchy, nomination and notification fallbacks without a sender', async () => {
    const db = database({
      event: {
        id: 'event-1',
        title: null,
        group_id: 'parent-1',
        event_type: 'delegate_conference',
        delegates_finalized: false,
      },
      delegates: [
        {
          id: 'delegate-1',
          group: null,
          group_id: null,
          user: null,
          user_id: null,
          priority: null,
          status: null,
        },
      ],
      connections: [
        { id: 'without-child', parent_group_id: 'parent-1', child_group_id: null },
        { id: 'with-child', parent_group_id: 'parent-1', child_group_id: 'missing-group' },
      ],
      groups: null as never,
    });
    mocks.createClient.mockReturnValue(db.client);
    mocks.getDirectSubgroups.mockReturnValueOnce([
      { id: 'missing-group', name: 'Group', memberCount: 0 },
    ]);
    mocks.calculateDelegateAllocations.mockReturnValueOnce([]);
    mocks.finalizeDelegateSelection.mockReturnValueOnce([]);
    await expect(
      (finalizeDelegatesFn as any)({ data: { eventId: 'event-1', senderId: 'sender-1' } })
    ).resolves.toMatchObject({ success: true });
    expect(mocks.finalizeDelegateSelection).toHaveBeenCalledWith(
      [{ id: 'delegate-1', groupId: '', userId: '', priority: 0, status: 'nominated' }],
      []
    );
    expect(mocks.notify).toHaveBeenCalledWith({
      senderId: 'sender-1',
      eventId: 'event-1',
      eventTitle: 'Event',
    });
    await expect(
      (finalizeDelegatesFn as any)({ data: { eventId: 'event-1' } })
    ).resolves.toMatchObject({ success: true });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it('sanitizes non-Error failures and requires both Supabase environment variables', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect((finalizeDelegatesFn as any)({ data: { eventId: 'event-1' } })).rejects.toThrow(
      'Supabase environment variables are not configured'
    );
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    mocks.createClient.mockReturnValue({
      from() {
        throw 'database offline';
      },
    });
    await expect((finalizeDelegatesFn as any)({ data: { eventId: 'event-1' } })).rejects.toThrow(
      'Failed to finalize delegates'
    );
  });
});
