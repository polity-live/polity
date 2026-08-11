import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Query {
  entity: string;
  conditions: unknown[][];
  oneRequested: boolean;
  one: () => Query;
  where: (...args: unknown[]) => Query;
}

function query(entity: string): Query {
  const value = {
    entity,
    conditions: [] as unknown[][],
    oneRequested: false,
  } as Query;
  value.where = (...args: unknown[]) => {
    value.conditions.push(args);
    return value;
  };
  value.one = () => {
    value.oneRequested = true;
    return value;
  };
  return value;
}

const mocks = vi.hoisted(() => ({
  buildGroups: vi.fn(),
  executeRead: vi.fn(),
  getSession: vi.fn(),
  loadGroup: vi.fn(),
  loadRelationships: vi.fn(),
  resolveAncestors: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/zero-mutate', () => ({ executeZeroRead: mocks.executeRead }));
vi.mock('@/features/groups/logic/hierarchy', () => ({
  resolveHierarchicalAncestors: mocks.resolveAncestors,
}));
vi.mock('@/zero/schema', () => ({
  zql: {
    event: query('event'),
    event_participant: query('event_participant'),
    group_membership: query('group_membership'),
  },
}));
vi.mock('@/zero/groups/membership-helpers', () => ({
  buildGroupsById: mocks.buildGroups,
  loadActiveHierarchyRelationships: mocks.loadRelationships,
  loadGroupWithDerivedNetworkMeta: mocks.loadGroup,
}));

import { Route } from '../debug/group-general-assemblies';

type Handler = (input: { request: Request }) => Promise<Response>;
const get = (Route as unknown as { server: { handlers: { GET: Handler } } }).server.handlers.GET;

function request(membershipId?: string) {
  const url = new URL('http://localhost/api/debug/group-general-assemblies');
  if (membershipId !== undefined) url.searchParams.set('membershipId', membershipId);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.buildGroups.mockResolvedValue(new Map([['group-1', { id: 'group-1' }]]));
  mocks.loadRelationships.mockResolvedValue([{ parentId: 'group-parent' }]);
  mocks.resolveAncestors.mockReturnValue(['group-parent']);
});

afterEach(() => vi.restoreAllMocks());

describe('group general assemblies debug route', () => {
  it('rejects anonymous and incomplete requests', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await get({ request: request('membership-1') });
    expect(response.status).toBe(401);
    response = await get({ request: request() });
    expect(response.status).toBe(400);
    response = await get({ request: request('') });
    expect(response.status).toBe(400);
  });

  it('returns an empty diagnostic when the membership is missing', async () => {
    const run = vi.fn().mockResolvedValue(null);
    mocks.executeRead.mockImplementation(callback => callback({ run }));
    const response = await get({ request: request('membership-1') });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      membership: null,
      affectedGroupIds: [],
      events: [],
      participations: [],
    });
  });

  it.each([undefined, { group_type: 'regional' }])(
    'loads a non-base membership without hierarchy expansion',
    async group => {
      const membership = {
        id: 'membership-1',
        group_id: 'group-1',
        user_id: 'user-1',
        status: null,
        source: undefined,
      };
      const run = vi.fn(async (queryValue: Query) => {
        if (queryValue.entity === 'group_membership') return membership;
        if (queryValue.entity === 'event') return [];
        throw new Error(`Unexpected query: ${queryValue.entity}`);
      });
      mocks.executeRead.mockImplementation(callback => callback({ run }));
      mocks.loadGroup.mockResolvedValue(group);

      const response = await get({ request: request('membership-1') });
      await expect(response.json()).resolves.toEqual({
        membership: {
          id: 'membership-1',
          group_id: 'group-1',
          user_id: 'user-1',
          status: null,
          source: null,
        },
        affectedGroupIds: ['group-1'],
        events: [],
        participations: [],
      });
      expect(mocks.buildGroups).not.toHaveBeenCalled();
      expect(run).toHaveBeenCalledTimes(2);
    }
  );

  it('expands base-group ancestors and maps event timing and participation defaults', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const membership = {
      id: 'membership-1',
      group_id: 'group-1',
      user_id: 'user-1',
      status: 'active',
      source: 'direct',
    };
    const events = [
      {
        id: 'event-1',
        group_id: 'group-1',
        title: 'Assembly',
        status: 'cancelled',
        start_date: 800,
        end_date: 1_200,
      },
      { id: 'event-2', end_date: null, start_date: 1_100 },
      { id: 'event-3', end_date: null, start_date: null },
      { id: 'event-4', end_date: 900, start_date: 2_000, status: 'planned' },
    ];
    const participations = [
      { id: 'participation-1', event_id: 'event-1', user_id: 'user-1', status: 'going' },
      { id: 'participation-2', event_id: 'event-2', user_id: 'user-1', status: undefined },
    ];
    const run = vi.fn(async (queryValue: Query) => {
      if (queryValue.entity === 'group_membership') return membership;
      if (queryValue.entity === 'event') return events;
      if (queryValue.entity === 'event_participant') return participations;
      throw new Error(`Unexpected query: ${queryValue.entity}`);
    });
    mocks.executeRead.mockImplementation(callback => callback({ run }));
    mocks.loadGroup.mockResolvedValue({ group_type: 'base' });

    const response = await get({ request: request('membership-1') });
    const payload = await response.json();
    expect(payload.membership).toMatchObject({ status: 'active', source: 'direct' });
    expect(payload.affectedGroupIds).toEqual(['group-1', 'group-parent']);
    expect(payload.events).toEqual([
      expect.objectContaining({
        id: 'event-1',
        isCancelled: true,
        isOngoingOrUpcomingByEndDate: true,
      }),
      expect.objectContaining({
        id: 'event-2',
        group_id: null,
        title: null,
        status: null,
        start_date: 1_100,
        end_date: null,
        isCancelled: false,
        isOngoingOrUpcomingByEndDate: true,
      }),
      expect.objectContaining({ id: 'event-3', isOngoingOrUpcomingByEndDate: false }),
      expect.objectContaining({ id: 'event-4', isOngoingOrUpcomingByEndDate: false }),
    ]);
    expect(payload.participations).toEqual([
      expect.objectContaining({ status: 'going' }),
      expect.objectContaining({ status: null }),
    ]);
    expect(mocks.resolveAncestors).toHaveBeenCalledWith(
      'group-1',
      [{ parentId: 'group-parent' }],
      expect.any(Map)
    );
  });
});
