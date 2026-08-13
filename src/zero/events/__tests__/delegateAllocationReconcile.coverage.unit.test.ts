import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryHarness } from '../../__tests__/test-utils/zeroHarness';

beforeEach(() => vi.resetModules());

async function loadReconciler() {
  const harness = createQueryHarness();
  const state = {
    groups: [] as any[],
    connections: [] as any[],
    grants: [] as any[],
    rules: [] as any[],
    origins: [] as any[],
    relationships: [] as any[],
    childBaseGroupIds: [] as string[],
    offlineMemberships: [] as any[],
    supported: true,
  };
  const calculateDelegateAllocations = vi.fn(
    (rows: { id: string; memberCount: number }[], seats: number) =>
      rows.map((row, index) => ({
        groupId: row.id,
        allocatedDelegates: index === 0 ? seats : 0,
      }))
  );
  const calculateTotalDelegates = vi.fn((members: number, perDelegate: number) =>
    Math.ceil(members / perDelegate)
  );
  const resolveChildBaseGroups = vi.fn(() => state.childBaseGroupIds);
  const supportsMembershipComposition = vi.fn(() => state.supported);
  vi.doMock('../../schema', () => ({ zql: harness.zql }));
  vi.doMock('@/features/shared/utils/delegate-calculations', () => ({
    calculateDelegateAllocations,
    calculateTotalDelegates,
  }));
  vi.doMock('@/features/groups/logic/hierarchy', () => ({
    resolveChildBaseGroups,
  }));
  vi.doMock('@/features/groups/logic/membershipComposition', () => ({
    supportsMembershipComposition,
    resolveMembershipProvenance: vi.fn(
      ({ memberships }: { memberships: readonly Record<string, any>[] }) =>
        memberships.map(membership => ({
          ...membership,
          partGroup: membership.partGroupId ? { id: membership.partGroupId } : null,
          baseGroup: membership.baseGroupId ? { id: membership.baseGroupId } : null,
        }))
    ),
  }));
  vi.doMock('@/features/groups/logic/buildMembershipRightsSummary', () => ({
    getMembershipDisplayRoles: (membership: { roles?: readonly unknown[] }) =>
      membership.roles ?? [],
  }));
  vi.doMock('@/features/network/logic/groupRelationshipOrientation', () => ({
    getHierarchyRelationshipPair: (relationship: { pair?: unknown }) => relationship.pair ?? null,
  }));
  vi.doMock('../../groups/offline-membership-helpers', () => ({
    loadEffectiveOfflineMembershipsForGroup: vi.fn(async () => state.offlineMemberships),
    buildOfflineMembershipPersonKey: ({
      offlineMemberId,
      connectedUserId,
    }: {
      offlineMemberId?: string;
      connectedUserId?: string | null;
    }) => connectedUserId || offlineMemberId || null,
  }));
  vi.doMock('../../network/derived', () => ({
    buildDerivedGroupNetworkMetaMap: vi.fn(() => new Map()),
    deriveGroupRelationships: vi.fn(() => state.relationships),
  }));
  const mod = await import('../delegate-allocation-reconcile');
  return {
    ...mod,
    harness,
    state,
    calculateDelegateAllocations,
    calculateTotalDelegates,
    resolveChildBaseGroups,
    supportsMembershipComposition,
  };
}

function createTx(harness: ReturnType<typeof createQueryHarness>, state: any) {
  const config = {
    event: null as any,
    groupEvents: [] as any[],
    membershipQueue: [] as any[][],
    existingRows: [] as any[],
    delegates: [] as any[],
  };
  const operations = new Map<string, ReturnType<typeof vi.fn>>();
  const mutate = new Proxy(
    {},
    {
      get: (_target, table) =>
        new Proxy(
          {},
          {
            get: (_table, operation) => {
              const key = `${String(table)}.${String(operation)}`;
              if (!operations.has(key)) operations.set(key, vi.fn().mockResolvedValue(undefined));
              return operations.get(key);
            },
          }
        ),
    }
  );
  const tx = {
    run: vi.fn(async (query: { table?: string; calls?: any[] }) => {
      const table = query?.table;
      const one = query.calls?.some(call => call[0] === 'one');
      if (table === 'event') return one ? config.event : config.groupEvents;
      if (table === 'group') return state.groups;
      if (table === 'group_connection') return state.connections;
      if (table === 'group_right_grant') return state.grants;
      if (table === 'group_membership_rule') return state.rules;
      if (table === 'group_membership_rule_origin') return state.origins;
      if (table === 'group_membership') return config.membershipQueue.shift() ?? [];
      if (table === 'group_delegate_allocation') return config.existingRows;
      if (table === 'event_delegate') return config.delegates;
      return [];
    }),
    mutate,
  };
  return {
    tx,
    config,
    operation: (table: string, operation: string) =>
      operations.get(`${table}.${operation}`) ?? vi.fn(),
  };
}

function membership(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_id: `user-${id}`,
    group_id: 'root',
    source_group_id: 'base-a',
    status: 'active',
    partGroupId: 'part-a',
    baseGroupId: 'base-a',
    membership_roles: [],
    ...overrides,
  };
}

describe('delegate allocation reconciliation coverage', () => {
  it('covers allocation arithmetic and provenance deduplication', async () => {
    const loaded = await loadReconciler();

    expect([
      ...loaded.buildOpenGroupAllocations({
        bucketRows: [
          { partGroupId: 'part-a', memberCount: 3 },
          { partGroupId: 'part-b', memberCount: 2 },
        ],
        lockedSeatCountsByGroupId: new Map([['part-a', 2]]),
        totalSeatCount: 2,
      }),
    ]).toEqual([]);
    expect(
      loaded
        .buildOpenGroupAllocations({
          bucketRows: [{ partGroupId: 'part-a', memberCount: 3 }],
          lockedSeatCountsByGroupId: new Map(),
          totalSeatCount: 2,
        })
        .get('part-a')
    ).toBe(2);

    const rows = loaded.buildDelegateAllocationBucketRows({
      targetGroup: { id: 'root', group_type: 'hierarchical' },
      relationships: [],
      targetMemberships: [
        membership('one'),
        membership('duplicate', { user_id: 'user-one' }),
        membership('missing-part', { partGroupId: null }),
      ] as never,
      hierarchyBaseMemberships: [
        membership('base', { source_group_id: null, group_id: 'base-b', partGroupId: 'part-b' }),
      ] as never,
      rootMemberships: [
        membership('inactive-root', { status: 'left', roles: [] }),
        membership('board-root', {
          status: 'left',
          roles: [{ id: 'board', name: 'Board Member' }],
        }),
      ] as never,
    });
    expect(rows).toEqual(expect.arrayContaining([{ partGroupId: 'part-a', memberCount: 1 }]));

    const fallbackRows = loaded.buildDelegateAllocationBucketRows({
      targetGroup: { id: 'root', group_type: 'hierarchical' },
      relationships: [],
      targetMemberships: [
        membership('user-object', {
          user: { id: 'user-object-id' },
          user_id: null,
          baseGroupId: 'base-object',
          source_group_id: null,
          group_id: null,
          partGroupId: 'part-object',
          status: null,
          membership_roles: [{ role: { id: 'nameless', name: null } }],
        }),
        membership('id-only', {
          user: null,
          user_id: null,
          baseGroupId: null,
          source_group_id: null,
          group_id: null,
          partGroupId: 'part-id',
          status: 'active',
          membership_roles: [],
        }),
      ] as never,
      hierarchyBaseMemberships: [
        membership('already-sourced', { source_group_id: 'base-a' }),
        membership('missing-group', { source_group_id: null, group_id: null }),
      ] as never,
      rootMemberships: undefined,
    });
    expect(fallbackRows.some(row => row.partGroupId === 'part-id')).toBe(true);
  });

  it('covers event exits and a complete hierarchical reconciliation lifecycle', async () => {
    const loaded = await loadReconciler();
    const test = createTx(loaded.harness, loaded.state);

    test.config.event = null;
    await expect(
      loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'missing')
    ).resolves.toEqual({ affectedGroupIds: [] });

    test.config.event = { id: 'event-1', event_type: 'meeting', group_id: 'root' };
    test.config.existingRows = [{ id: 'obsolete' }];
    await loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'event-1');
    expect(test.operation('group_delegate_allocation', 'delete')).toHaveBeenCalledWith({
      id: 'obsolete',
    });

    test.config.event = { id: 'event-1', event_type: 'delegate_assembly', group_id: 'missing' };
    loaded.state.groups = [];
    await loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'event-1');

    loaded.state.groups = [
      { id: 'root', group_type: 'hierarchical' },
      { id: 'base-a', group_type: 'base' },
      { id: 'part-a', group_type: 'base' },
      { id: 'part-b', group_type: 'base' },
    ];
    loaded.state.relationships = [
      {
        group_id: 'base-a',
        related_group_id: 'root',
        connection_type: 'hierarchy',
        grant_id: null,
        status: 'active',
        pair: { childGroupId: 'base-a', parentGroupId: 'root' },
      },
      {
        group_id: 'ignored',
        related_group_id: 'root',
        connection_type: 'association',
        grant_id: 'grant',
        status: 'inactive',
        pair: null,
      },
    ];
    loaded.state.childBaseGroupIds = ['base-a'];
    loaded.state.origins = [
      { membership_rule_id: 'rule-1', eligible_origin_group_id: 'origin-a' },
      { membership_rule_id: 'rule-1', eligible_origin_group_id: 'origin-b' },
    ];
    loaded.state.rules = [{ id: 'rule-1' }, { id: 'rule-without-origins' }];
    loaded.state.offlineMemberships = [
      { group_offline_member: null },
      {
        group_offline_member: {
          id: '',
          group_id: 'base-a',
          connected_user_id: null,
          group: { id: 'base-a' },
        },
      },
      {
        group_offline_member: {
          id: 'offline-a',
          group_id: 'base-a',
          connected_user_id: null,
          group: { id: 'base-a' },
        },
      },
      {
        group_offline_member: {
          id: 'offline-duplicate',
          group_id: 'base-a',
          connected_user_id: 'offline-a',
          group: { id: 'base-a' },
        },
      },
    ];
    loaded.state.supported = false;
    test.config.event = { id: 'event-1', event_type: 'delegate_assembly', group_id: 'root' };
    await loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'event-1');

    loaded.state.supported = true;
    test.config.event = {
      id: 'event-1',
      event_type: 'delegate_assembly',
      group_id: 'root',
      delegate_seat_allocation_type: 'fixed_total',
      total_delegate_seats: 4,
      delegate_finalized_at: 123,
    };
    test.config.membershipQueue = [
      [
        membership('active', {
          membership_roles: [
            { role: { id: 'role-low', name: 'Member', sort_order: null } },
            { role: null },
            { role: { id: 'role-high', name: 'Member', sort_order: 2 } },
          ],
        }),
        membership('board', {
          status: 'left',
          membership_roles: [{ role: { id: 'board', name: 'Board Member' } }],
        }),
        membership('inactive', { status: 'left', membership_roles: null }),
        membership('missing-status', {
          status: null,
          membership_roles: [{ role: { id: 'nameless-role', name: null } }],
        }),
      ],
      [membership('hierarchy', { source_group_id: null, group_id: 'base-a' })],
      [],
    ];
    test.config.existingRows = [
      { id: 'same', group_id: 'part-a', allocated_seats: 3 },
      { id: 'stale', group_id: 'part-stale', allocated_seats: 1 },
      { id: 'no-group', group_id: null, allocated_seats: 1 },
    ];
    test.config.delegates = [
      { id: 'no-group', group_id: null },
      { id: 'locked', group_id: 'part-a', seat_count: null },
      { id: 'locked-more', group_id: 'part-a', seat_count: 2 },
    ];

    const result = await loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'event-1');
    expect(result.affectedGroupIds).toContain('part-a');
    expect(test.operation('event', 'update')).toHaveBeenCalledWith(
      expect.objectContaining({
        delegate_distribution_method: 'fixed_total',
        delegate_distribution_status: 'finalized',
      })
    );

    test.config.event = {
      ...test.config.event,
      delegate_seat_allocation_type: 'members_per_delegate',
      main_group_delegate_allocation_mode: 'invalid',
      delegate_finalized_at: null,
    };
    test.config.membershipQueue = [[membership('dynamic')], []];
    test.config.existingRows = [{ id: 'changed', group_id: 'part-a', allocated_seats: 99 }];
    test.config.delegates = [];
    await loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'event-1');
    expect(loaded.calculateTotalDelegates).toHaveBeenCalled();
    expect(test.operation('group_delegate_allocation', 'update')).toHaveBeenCalled();

    test.config.event = {
      ...test.config.event,
      delegate_seat_allocation_type: 'members_per_delegate',
      main_group_delegate_allocation_mode: '25',
    };
    test.config.membershipQueue = [
      [
        membership('valid-ratio', {
          membership_roles: [
            { role: { id: 'high-first', name: 'Member', sort_order: 2 } },
            { role: { id: 'low-second', name: 'Member', sort_order: null } },
          ],
        }),
      ],
      [],
    ];
    await loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'event-1');

    test.config.event = {
      ...test.config.event,
      main_group_delegate_allocation_mode: null,
    };
    test.config.membershipQueue = [[membership('missing-ratio')], []];
    await loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'event-1');

    test.config.event = {
      ...test.config.event,
      delegate_seat_allocation_type: 'fixed_total',
      total_delegate_seats: null,
    };
    test.config.membershipQueue = [[membership('zero-fixed')], []];
    await loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'event-1');

    async function runSibling(
      targetGroup: Record<string, unknown>,
      relationships: any[],
      offlineMemberships: any[],
      targetMemberships: any[] = []
    ) {
      loaded.state.groups = [
        targetGroup,
        { id: 'base-a', group_type: 'base' },
        { id: 'part-a', group_type: 'base' },
        { id: 'root-source', group_type: 'hierarchical' },
        { id: 'flat-source', group_type: 'base' },
      ];
      loaded.state.relationships = [
        {
          group_id: String(targetGroup.id),
          related_group_id: 'base-a',
          connection_type: 'association',
          grant_id: null,
          status: 'active',
          pair: null,
        },
        ...relationships,
        {
          group_id: 'unknown-group',
          related_group_id: 'unknown-related',
          connection_type: 'association',
          grant_id: null,
          status: 'active',
          pair: null,
        },
      ];
      loaded.state.offlineMemberships = offlineMemberships;
      test.config.event = {
        id: 'sibling-event',
        event_type: 'delegate_assembly',
        group_id: targetGroup.id,
        delegate_seat_allocation_type: 'members_per_delegate',
        main_group_delegate_allocation_mode: '0',
        delegate_finalized_at: null,
      };
      test.config.membershipQueue = [
        targetMemberships,
        [
          membership('root-loaded', {
            group: { id: 'root-source', group_type: 'hierarchical' },
            source_group: { id: 'base-a' },
          }),
        ],
      ];
      test.config.existingRows = [];
      test.config.delegates = [];
      return loaded.reconcileDelegateAllocationsForEvent(test.tx as never, 'sibling-event');
    }

    await runSibling(
      { id: 'sibling', group_type: 'sibling', sibling_membership_mode: 'elected' },
      [],
      [
        {
          group_offline_member: {
            id: 'offline-elected',
            group_id: 'base-a',
            connected_user_id: null,
          },
        },
      ],
      [
        membership('sibling-source', { source_group_id: 'base-a' }),
        membership('no-source', { source_group_id: null }),
      ]
    );

    await runSibling(
      {
        id: 'sibling',
        group_type: 'sibling',
        sibling_membership_mode: 'elected',
        connected_group_id: 'base-a',
      },
      [],
      [
        {
          group_offline_member: {
            id: 'offline-root-equals-base',
            group_id: 'base-a',
            connected_user_id: null,
          },
        },
      ]
    );
    expect(loaded.resolveChildBaseGroups).toHaveBeenCalled();

    await runSibling(
      { id: 'sibling', group_type: 'sibling', sibling_membership_mode: 'open' },
      [],
      [
        {
          group_offline_member: {
            id: 'offline-open',
            group_id: 'base-a',
            connected_user_id: null,
          },
        },
      ]
    );

    const hierarchyPaths = [
      {
        group_id: 'root-source',
        related_group_id: 'sibling',
        connection_type: 'association',
        grant_id: null,
        status: 'active',
        pair: null,
      },
      {
        group_id: 'base-a',
        related_group_id: 'part-a',
        connection_type: 'hierarchy',
        grant_id: null,
        status: 'active',
        pair: { childGroupId: 'base-a', parentGroupId: 'part-a' },
      },
      {
        group_id: 'part-a',
        related_group_id: 'root-source',
        connection_type: 'hierarchy',
        grant_id: null,
        status: 'active',
        pair: { childGroupId: 'part-a', parentGroupId: 'root-source' },
      },
      {
        group_id: 'part-a',
        related_group_id: 'base-a',
        connection_type: 'hierarchy',
        grant_id: null,
        status: 'active',
        pair: { childGroupId: 'part-a', parentGroupId: 'base-a' },
      },
      {
        group_id: 'ignored',
        related_group_id: 'root-source',
        connection_type: 'hierarchy',
        grant_id: 'grant',
        status: 'inactive',
        pair: { childGroupId: 'ignored', parentGroupId: 'root-source' },
      },
    ];
    loaded.state.childBaseGroupIds = ['base-a'];
    loaded.resolveChildBaseGroups.mockClear();
    loaded.supportsMembershipComposition.mockClear();
    await runSibling(
      {
        id: 'sibling',
        group_type: 'sibling',
        sibling_membership_mode: 'parliament',
        parliament_source_group_ids: ['root-source'],
      },
      hierarchyPaths,
      [
        { group_offline_member: null },
        {
          group_offline_member: {
            id: '',
            group_id: 'base-a',
            connected_user_id: null,
          },
        },
        {
          group_offline_member: {
            id: 'offline-parliament',
            group_id: 'base-a',
            connected_user_id: null,
          },
        },
        {
          group_offline_member: {
            id: 'offline-parliament-duplicate',
            group_id: 'base-a',
            connected_user_id: 'offline-parliament',
          },
        },
      ]
    );
    expect(loaded.resolveChildBaseGroups).toHaveBeenCalledWith(
      'root-source',
      expect.any(Array),
      expect.any(Map)
    );

    await runSibling(
      {
        id: 'sibling',
        group_type: 'sibling',
        sibling_membership_mode: 'parliament',
        parliament_source_group_ids: ['base-a', 'root-source', 'flat-source'],
      },
      hierarchyPaths,
      [
        {
          group_offline_member: {
            id: 'offline-ambiguous',
            group_id: 'base-a',
            connected_user_id: null,
          },
        },
      ]
    );

    loaded.state.childBaseGroupIds = ['base-a', 'orphan-base'];
    await runSibling(
      {
        id: 'sibling',
        group_type: 'sibling',
        sibling_membership_mode: 'parliament',
        parliament_source_group_ids: ['root-source'],
      },
      [],
      [
        {
          group_offline_member: {
            id: 'offline-orphan',
            group_id: 'orphan-base',
            connected_user_id: null,
          },
        },
      ]
    );

    await runSibling({ id: 'flat-null-memberships', group_type: 'base' }, [], [], null as never);

    await runSibling(
      { id: 'flat-target', group_type: 'base' },
      [],
      [
        {
          group_offline_member: {
            id: 'offline-flat',
            group_id: 'base-a',
            connected_user_id: null,
          },
        },
      ]
    );

    test.config.groupEvents = [{ id: 'event-1' }];
    test.config.membershipQueue = [[membership('group-batch')], []];
    await loaded.reconcileDelegateAllocationsForGroups(test.tx as never, ['', 'root', 'root']);
    await loaded.reconcileDelegateAllocationsForGroups(test.tx as never, []);
  });
});
