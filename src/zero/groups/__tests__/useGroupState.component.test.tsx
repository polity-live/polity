/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const results = new Map<string, unknown>();
  const statuses = new Map<string, string>();
  const calls: { key?: string; args?: unknown }[] = [];
  const namespace = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, property: string) => (args: unknown) => ({
          key: `${name}.${property}`,
          args,
        }),
      }
    );
  return {
    calls,
    results,
    statuses,
    queries: {
      groups: namespace('groups'),
      network: namespace('network'),
    },
    useQuery: vi.fn((query?: { key?: string; args?: unknown }) => {
      calls.push(query ?? {});
      const exactStatusKey = query?.key ? `${query.key}:${JSON.stringify(query.args)}` : '';
      return [
        query?.key ? results.get(query.key) : undefined,
        {
          type: query?.key
            ? (statuses.get(exactStatusKey) ?? statuses.get(query.key) ?? 'complete')
            : 'complete',
        },
      ];
    }),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));
vi.mock('../../queries', () => ({ queries: mocks.queries }));

import * as subject from '../useGroupState';

const memberRole = {
  id: 'role-member',
  name: 'Member',
  sort_order: 1,
  action_rights: [{ resource: 'events', action: 'create' }],
};
const boardRole = {
  id: 'role-board',
  name: 'Board Member',
  sort_order: 2,
  action_rights: [{ resource: 'events', action: 'manage' }],
};

function membership(id: string, status = 'active', role = memberRole) {
  return {
    id,
    group_id: 'group-a',
    status,
    role: null,
    membership_roles: [{ role }, { role: null }],
  };
}

function peerConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'connection-peer',
    group_a_id: 'group-a',
    group_b_id: 'group-b',
    from_group_id: 'group-a',
    to_group_id: 'group-b',
    connection_type: 'peer',
    connection_kind: 'sibling',
    parent_group_id: null,
    child_group_id: null,
    status: 'active',
    created_at: 1,
    updated_at: 2,
    group_a: { id: 'group-a', name: 'Alpha' },
    group_b: { id: 'group-b', name: 'Beta' },
    from_group: { id: 'group-a', name: 'Alpha from' },
    to_group: { id: 'group-b', name: 'Beta to' },
    grants: [],
    membership_rule: {
      id: 'rule-peer',
      connection_id: 'connection-peer',
      member_source_group_id: 'group-b',
      member_target_group_id: 'group-a',
      membership_mode: 'selected_source_groups',
      required_source_role_id: 'role-member',
      origins: [{ eligible_origin_group_id: 'group-source' }, { eligible_origin_group_id: null }],
    },
    ...overrides,
  };
}

beforeEach(() => {
  mocks.results.clear();
  mocks.statuses.clear();
  mocks.calls.length = 0;
  mocks.useQuery.mockClear();
});

describe('group state normalization helpers', () => {
  it('selects the highest sorted role and handles absent sort orders', () => {
    expect(subject.selectPrimaryGroupRole([])).toBeNull();
    expect(
      subject.selectPrimaryGroupRole([{ id: 'none', sort_order: null }, memberRole, boardRole])
    ).toBe(boardRole);
    expect(
      subject.selectPrimaryGroupRole([
        { id: 'none-left', sort_order: null },
        { id: 'none-right', sort_order: null },
      ])
    ).toHaveProperty('id');
  });

  it('normalizes membership and guest role links with legacy fallbacks', () => {
    expect(
      subject.normalizeMembershipWithRoles({
        id: 'm1',
        membership_roles: [{ role: memberRole }, { role: null }],
        role: boardRole,
      })
    ).toMatchObject({ roles: [memberRole], role: memberRole });
    expect(
      subject.normalizeMembershipWithRoles({ membership_roles: null, role: boardRole })
    ).toMatchObject({ roles: [], role: boardRole });
    expect(subject.normalizeMemberships(null)).toEqual([]);
    expect(subject.normalizeMemberships(undefined)).toEqual([]);
    expect(subject.normalizeMemberships([membership('m1')])).toHaveLength(1);

    expect(
      subject.normalizeGuestAccesses([
        { id: 'g1', guest_roles: [{ role: boardRole }, { role: null }], role: memberRole },
        { id: 'g2', guest_roles: null, role: memberRole },
        { id: 'g3', role: null },
      ])
    ).toMatchObject([
      { roles: [boardRole], role: boardRole },
      { roles: [], role: memberRole },
      { roles: [], role: null },
    ]);
    expect(subject.normalizeGuestAccesses(null)).toEqual([]);
  });

  it('filters and projects offline memberships', () => {
    const projected = subject.normalizeOfflineMemberships([
      {
        id: 'active',
        status: 'active',
        group_offline_member_id: 'offline-1',
        group_offline_member: { first_name: 'Ada', last_name: 'Lovelace' },
        membership_roles: [{ role: boardRole }, { role: null }],
      },
      {
        id: 'admin',
        status: 'admin',
        user_id: 'legacy-user',
        group_offline_member: null,
        membership_roles: null,
        role: memberRole,
      },
      { id: 'member', status: 'member', group_offline_member: {} },
      { id: 'inactive', status: 'inactive', group_offline_member: {} },
      {
        id: 'connected',
        status: 'active',
        group_offline_member: { connected_user_id: 'user-1' },
      },
    ]);

    expect(projected).toHaveLength(3);
    expect(projected[0]).toMatchObject({
      user_id: 'offline:offline-1',
      user: { first_name: 'Ada', last_name: 'Lovelace' },
      roles: [boardRole],
      role: boardRole,
    });
    expect(projected[1]).toMatchObject({ user_id: 'legacy-user', role: memberRole });
    expect(projected[2]).toMatchObject({ user_id: undefined, role: null });
    expect(subject.normalizeOfflineMemberships(undefined)).toEqual([]);
  });

  it('maps role display fields, active state, and unique IDs', () => {
    expect(
      subject.mapRoleForDisplay({
        name: 'Chair',
        term_start_date: 10,
        is_recurring: true,
        recurrence_pattern: 'yearly',
        recurrence_interval: 3,
      })
    ).toMatchObject({ title: 'Chair', term: '3', first_term_start: 10 });
    expect(
      subject.mapRoleForDisplay({
        name: null,
        term_start_date: null,
        is_recurring: true,
        recurrence_pattern: 'yearly',
        recurrence_interval: null,
      })
    ).toMatchObject({ title: null, term: '1', first_term_start: null });
    expect(subject.mapRoleForDisplay({ is_recurring: false })).toMatchObject({ term: null });
    expect(subject.isActiveConnectionStatus('active')).toBe(true);
    expect(subject.isActiveConnectionStatus('pending')).toBe(false);
    expect(subject.isActiveConnectionStatus(undefined)).toBe(false);
    expect(subject.uniqueById([{ id: 'a' }, { id: 'a' }, { id: null }, {}, { id: 'b' }])).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
  });
});

describe('derived network augmentation', () => {
  it('returns null without an identity', () => {
    expect(subject.augmentGroupWithDerivedNetworkMeta(null, [])).toBeNull();
    expect(subject.augmentGroupWithDerivedNetworkMeta({}, [])).toBeNull();
  });

  it('derives peer metadata, connected group, sources, and relationship directions', () => {
    const connection = peerConnection();
    const result = subject.augmentGroupWithDerivedNetworkMeta(
      { id: 'group-a', name: 'Alpha' },
      [connection] as never,
      [{ id: 'group-source', name: 'Source' }]
    );

    expect(result).toMatchObject({
      group_type: 'sibling',
      has_sibling_connections: true,
      connected_group_id: 'group-b',
      primary_sibling_connection_id: 'connection-peer',
      connected_group: { id: 'group-b' },
      sibling_groups: [{ id: 'group-b' }],
      sibling_sources: [
        {
          id: 'group-a:group-source',
          source_group_id: 'group-source',
          source_group: { id: 'group-source' },
        },
      ],
    });
    expect(result?.relationships_as_target).toHaveLength(0);
    expect(result?.relationships_as_source).toHaveLength(1);
  });

  it('honors persisted fields and resolves every endpoint orientation', () => {
    const persisted = subject.augmentGroupWithDerivedNetworkMeta(
      {
        id: 'group-a',
        group_type: 'hierarchical',
        has_hierarchy_children: true,
        has_sibling_connections: false,
        connected_group_id: 'persisted-peer',
        primary_sibling_membership_mode: 'all_members',
        sibling_membership_mode: 'open',
        sibling_role_id: 'persisted-role',
      },
      [
        peerConnection({
          id: 'from-only',
          group_a_id: 'other-a',
          group_b_id: 'other-b',
          from_group_id: 'group-a',
          to_group_id: 'group-c',
          group_a: null,
          group_b: null,
          from_group: null,
          to_group: { id: 'group-c', name: 'Gamma' },
          membership_rule: null,
        }),
        peerConnection({
          id: 'to-only',
          group_a_id: 'other-c',
          group_b_id: 'other-d',
          from_group_id: 'group-d',
          to_group_id: 'group-a',
          group_a: null,
          group_b: null,
          from_group: { id: 'group-d', name: 'Delta' },
          to_group: null,
          membership_rule: null,
        }),
      ] as never,
      [{ id: 'persisted-peer', name: 'Persisted' }]
    );

    expect(persisted).toMatchObject({
      group_type: 'hierarchical',
      has_hierarchy_children: true,
      has_sibling_connections: false,
      connected_group: { id: 'persisted-peer' },
      sibling_groups: [{ id: 'group-c' }, { id: 'group-d' }],
      primary_sibling_membership_mode: 'all_members',
      sibling_membership_mode: 'open',
      sibling_role_id: 'persisted-role',
    });
  });

  it('resolves reverse group endpoints and missing references', () => {
    const reverse = peerConnection({
      group_a_id: 'group-b',
      group_b_id: 'group-a',
      from_group_id: 'group-b',
      to_group_id: 'group-a',
      group_a: { id: 'group-b', name: 'Beta' },
      group_b: { id: 'group-a', name: 'Alpha' },
      from_group: null,
      to_group: null,
      membership_rule: null,
    });
    expect(
      subject.augmentGroupWithDerivedNetworkMeta({ id: 'group-a' }, [reverse] as never, [])
    ).toMatchObject({
      connected_group: { id: 'group-b' },
      sibling_groups: [{ id: 'group-b' }],
      sibling_sources: [],
    });
    expect(
      subject.augmentGroupWithDerivedNetworkMeta(
        { id: 'group-a', connected_group_id: 'missing' },
        [],
        []
      )
    ).toMatchObject({ connected_group: null, sibling_groups: [], sibling_sources: [] });
    expect(subject.augmentGroupWithDerivedNetworkMeta({ id: 'isolated' }, [], [])).toMatchObject({
      connected_group: null,
      sibling_groups: [],
      sibling_sources: [],
    });
  });

  it('uses lookup fallbacks and excludes inactive or unrelated sibling candidates', () => {
    const connections = [
      peerConnection({ group_b: null, to_group: null }),
      peerConnection({
        id: 'legacy-sibling',
        group_a_id: 'legacy-a',
        group_b_id: 'legacy-b',
        from_group_id: 'group-a',
        to_group_id: 'group-c',
        connection_type: 'hierarchy',
        connection_kind: 'sibling',
        from_group: null,
        to_group: null,
        group_a: null,
        group_b: null,
        membership_rule: null,
      }),
      peerConnection({ id: 'inactive', status: 'inactive' }),
      peerConnection({
        id: 'not-sibling',
        connection_type: 'hierarchy',
        connection_kind: 'hierarchy',
      }),
    ];
    const result = subject.augmentGroupWithDerivedNetworkMeta(
      { id: 'group-a' },
      connections as never,
      [
        { id: 'group-b', name: 'Beta lookup' },
        { id: 'group-c', name: 'Gamma lookup' },
      ]
    );
    expect(result?.sibling_groups).toEqual([
      expect.objectContaining({ id: 'group-b' }),
      expect.objectContaining({ id: 'group-c' }),
    ]);
  });

  it('drops sibling endpoints that cannot be resolved in any orientation', () => {
    const unresolved = [
      peerConnection({ group_b: null, to_group: null }),
      peerConnection({
        id: 'reverse-unresolved',
        group_a_id: 'missing-a',
        group_b_id: 'group-a',
        from_group_id: 'missing-a',
        to_group_id: 'group-a',
        group_a: null,
        group_b: null,
        from_group: null,
        to_group: null,
        membership_rule: null,
      }),
      peerConnection({
        id: 'from-unresolved',
        group_a_id: 'other-a',
        group_b_id: 'other-b',
        from_group_id: 'group-a',
        to_group_id: 'missing-to',
        group_a: null,
        group_b: null,
        from_group: null,
        to_group: null,
        membership_rule: null,
      }),
      peerConnection({
        id: 'to-unresolved',
        group_a_id: 'other-c',
        group_b_id: 'other-d',
        from_group_id: 'missing-from',
        to_group_id: 'group-a',
        group_a: null,
        group_b: null,
        from_group: null,
        to_group: null,
        membership_rule: null,
      }),
    ];
    expect(
      subject.augmentGroupWithDerivedNetworkMeta({ id: 'group-a' }, unresolved as never, [])
        ?.sibling_groups
    ).toEqual([]);
  });
});

describe('focused group query hooks', () => {
  it('projects wiki and viewer membership data', () => {
    mocks.results.set('groups.wikiOverview', [
      { id: 'group-a', name: 'Alpha', roles: [{ id: 'ignored' }] },
    ]);
    mocks.results.set('network.wikiNetwork', [peerConnection()]);
    mocks.results.set('groups.wikiRoleProjection', [
      {
        roles: [
          {
            id: 'chair',
            name: 'Chair',
            is_recurring: true,
            recurrence_pattern: 'yearly',
            recurrence_interval: 2,
          },
        ],
      },
    ]);
    expect(subject.useGroupWikiData).toBeTypeOf('function');
    expect(renderHook(() => subject.useGroupWikiData('group-a')).result.current).toMatchObject({
      group: { id: 'group-a', memberships: [], roles: [{ title: 'Chair', term: '2' }] },
      isLoading: false,
    });

    mocks.results.set('groups.viewerMembershipOverview', [
      {
        id: 'group-a',
        memberships: [membership('self')],
        guest_accesses: [{ id: 'guest-a' }],
        connected_group: {
          memberships: [membership('connected')],
          guest_accesses: [{ id: 'guest-b' }],
        },
      },
    ]);
    expect(
      renderHook(() => subject.useViewerMembershipOverview('group-a')).result.current
    ).toMatchObject({
      group: { id: 'group-a' },
      memberships: [{ id: 'self', role: memberRole }],
      guestAccesses: [{ id: 'guest-a' }],
      connectedGroupMemberships: [{ id: 'connected' }],
      connectedGroupGuestAccesses: [{ id: 'guest-b' }],
      isLoading: false,
    });
  });

  it('normalizes specific membership and subscriber fallbacks', () => {
    mocks.results.set('groups.userMembershipInGroup', [membership('mine')]);
    mocks.results.set('groups.allMembershipsInGroupWithRole', [membership('all')]);
    expect(
      renderHook(() => subject.useUserMembershipInGroup('user-a', 'group-a')).result.current
    ).toMatchObject({ memberships: [{ id: 'mine' }], allMemberships: [{ id: 'all' }] });

    mocks.results.set('groups.byIdBasic', [{ name: 'Alpha', subscriber_count: 9 }]);
    mocks.results.set('groups.subscribersByGroup', [{ id: 'subscriber' }]);
    expect(renderHook(() => subject.useGroupSubscribers('group-a')).result.current).toEqual({
      groupName: 'Alpha',
      subscriberCount: 1,
      subscribers: [{ id: 'subscriber' }],
      isLoading: false,
    });
    mocks.results.delete('groups.subscribersByGroup');
    expect(renderHook(() => subject.useGroupSubscribers('group-a')).result.current).toEqual({
      groupName: 'Alpha',
      subscriberCount: 9,
      subscribers: [],
      isLoading: false,
    });
    mocks.results.delete('groups.byIdBasic');
    expect(renderHook(() => subject.useGroupSubscribers(undefined)).result.current).toEqual({
      groupName: 'Group',
      subscriberCount: 0,
      subscribers: [],
      isLoading: false,
    });
  });

  it('returns all groups, documents, and a fully projected group', () => {
    mocks.results.set('groups.all', [{ id: 'group-a' }]);
    mocks.results.set('network.allGroupConnections', [peerConnection()]);
    expect(renderHook(() => subject.useAllGroups()).result.current.groups).toHaveLength(1);

    mocks.results.set('groups.allDocuments', [{ id: 'document-a' }]);
    expect(renderHook(() => subject.useAllDocuments()).result.current.documents).toEqual([
      { id: 'document-a' },
    ]);

    mocks.results.set('groups.byIdFull', [
      {
        id: 'group-a',
        memberships: [
          membership('active'),
          membership('admin', 'admin'),
          membership('invited', 'invited'),
          membership('requested', 'requested'),
          membership('board', 'other', boardRole),
        ],
        guest_accesses: [{ id: 'guest', guest_roles: [{ role: memberRole }] }],
        roles: [memberRole],
        events: [{ id: 'event' }],
        amendments: [{ id: 'amendment' }],
        conversations: [{ id: 'conversation' }],
      },
    ]);
    const group = renderHook(() => subject.useGroupById('group-a')).result.current;
    expect(group).toMatchObject({
      memberships: expect.any(Array),
      roles: [memberRole],
      events: [{ id: 'event' }],
      amendments: [{ id: 'amendment' }],
      conversation: [{ id: 'conversation' }],
      memberStats: { total: 5, members: 1, admins: 2, invited: 1, requested: 1 },
    });
  });

  it('partitions memberships and guest accesses by state', () => {
    mocks.results.set('groups.membershipsWithRolesAndRights', [
      membership('active'),
      membership('admin', 'admin'),
      membership('member', 'member'),
      membership('board', 'other', boardRole),
      membership('invited', 'invited'),
      membership('requested', 'requested'),
      membership('ignored', 'revoked'),
    ]);
    const memberships = renderHook(() => subject.useGroupMemberships('group-a')).result.current;
    expect(memberships.activeMemberships).toHaveLength(4);
    expect(memberships.invitedMemberships).toHaveLength(1);
    expect(memberships.requestedMemberships).toHaveLength(1);
    expect(memberships.pendingMemberships).toHaveLength(2);

    mocks.results.set('groups.membershipsWithRolesAndRightsByGroupIds', [
      membership('active'),
      membership('invited', 'invited'),
      membership('requested', 'requested'),
    ]);
    const byIds = renderHook(() =>
      subject.useGroupMembershipsByGroupIds(['group-a', '', 'group-a'])
    ).result.current;
    expect(byIds).toMatchObject({
      activeMemberships: [{ id: 'active' }],
      invitedMemberships: [{ id: 'invited' }],
      requestedMemberships: [{ id: 'requested' }],
    });

    mocks.results.set('groups.guestAccessesWithRolesAndRights', [
      { id: 'active', status: 'active' },
      { id: 'requested', status: 'requested' },
      { id: 'invited', status: 'invited' },
      { id: 'revoked', status: 'revoked' },
      { id: 'ignored', status: 'other' },
    ]);
    const guests = renderHook(() => subject.useGroupGuestAccesses('group-a')).result.current;
    expect(guests.activeGuestAccesses).toHaveLength(1);
    expect(guests.requestedGuestAccesses).toHaveLength(1);
    expect(guests.invitedGuestAccesses).toHaveLength(1);
    expect(guests.revokedGuestAccesses).toHaveLength(1);
  });

  it('projects network, documents, roles, todos, links, and payments', () => {
    mocks.results.set('groups.accessRolesWithRights', [boardRole]);
    expect(renderHook(() => subject.useGroupAccessRoles('group-a')).result.current.roles).toEqual([
      boardRole,
    ]);

    mocks.results.set('groups.byIdForNetwork', [{ id: 'group-a' }]);
    mocks.results.set('network.allGroupConnections', [peerConnection()]);
    expect(renderHook(() => subject.useGroupNetwork('group-a')).result.current).toMatchObject({
      group: { id: 'group-a', connected_group_id: 'group-b' },
      relationships: expect.any(Array),
    });

    mocks.results.set('groups.amendmentsByGroup', [{ id: 'amendment' }]);
    expect(
      renderHook(() => subject.useGroupAmendments('group-a')).result.current.amendments
    ).toEqual([{ id: 'amendment' }]);
    mocks.results.set('groups.amendmentEventStepRunsByEventIds', [{ id: 'run' }]);
    expect(
      renderHook(() => subject.useGroupAmendmentEventStepRuns(['event-a'])).result.current.stepRuns
    ).toEqual([{ id: 'run' }]);

    mocks.results.set('groups.amendmentsWithDocuments', [
      { title: 'Amendment', documents: [{ id: 'doc-a' }, { id: 'doc-b' }] },
      { title: 'Empty', documents: null },
    ]);
    expect(renderHook(() => subject.useGroupDocuments('group-a')).result.current.documents).toEqual(
      [
        { id: 'doc-a', title: 'Amendment' },
        { id: 'doc-b', title: 'Amendment' },
      ]
    );

    mocks.results.set('groups.roleManagementProjection', [
      {
        roles: [
          {
            ...boardRole,
            is_recurring: true,
            recurrence_pattern: 'yearly',
            recurrence_interval: null,
            term_start_date: 10,
            holder_history: [
              { end_date: 1, user: { id: 'old' } },
              {
                end_date: null,
                user: {
                  id: 'holder',
                  first_name: 'Ada',
                  last_name: 'Lovelace',
                  handle: 'ada',
                  avatar: 'avatar',
                },
              },
            ],
            group_membership_roles: [],
          },
          {
            ...memberRole,
            holder_history: [],
            group_membership_roles: [
              {
                group_membership: {
                  user: { id: 'member', first_name: null, last_name: null },
                },
              },
            ],
          },
          { id: 'vacant', name: 'Vacant', holder_history: [], group_membership_roles: [] },
        ],
      },
    ]);
    const roles = renderHook(() => subject.useGroupRoles('group-a')).result.current.roles;
    expect(roles).toMatchObject([
      { term: '1', currentHolder: { id: 'holder', fullName: 'Ada Lovelace', source: 'incumbent' } },
      { term: null, currentHolder: { id: 'member', fullName: null, source: 'membership' } },
      { currentHolder: null },
    ]);

    mocks.results.set('groups.roleOptionProjection', [{ roles: [memberRole] }]);
    expect(renderHook(() => subject.useGroupRoleOptions('group-a')).result.current.roles).toEqual([
      memberRole,
    ]);

    mocks.results.set('groups.todosByGroup', [{ id: 'todo' }]);
    const todos = renderHook(() => subject.useGroupTodos('group-a')).result.current;
    expect(todos.todos).toEqual([{ id: 'todo' }]);
    expect(todos.archivedTodos).toEqual([{ id: 'todo' }]);

    mocks.results.set('groups.linksByGroup', [{ id: 'link' }]);
    expect(renderHook(() => subject.useGroupLinks('group-a')).result.current.links).toEqual([
      { id: 'link' },
    ]);

    mocks.results.set('groups.paymentsReceivedByGroup', [{ id: 'same' }, { id: 'received' }]);
    mocks.results.set('groups.paymentsPaidByGroup', [{ id: 'same' }, { id: 'paid' }]);
    expect(
      renderHook(() => subject.useGroupPaymentsData('group-a')).result.current.payments
    ).toEqual([{ id: 'same' }, { id: 'received' }, { id: 'paid' }]);
  });

  it('returns active, assignable, and offline member projections', () => {
    mocks.results.set('groups.activeMembersByGroup', [{ id: 'active' }]);
    expect(
      renderHook(() => subject.useGroupActiveMembers('group-a')).result.current.members
    ).toEqual([{ id: 'active' }]);

    mocks.results.set('groups.assignableActiveMembersByGroupIds', [{ id: 'assignable' }]);
    expect(
      renderHook(() => subject.useAssignableGroupMembersByGroupIds(['group-a', 'group-a'])).result
        .current.members
    ).toEqual([{ id: 'assignable' }]);

    mocks.results.set('groups.offlineMembersByGroup', [{ id: 'offline' }]);
    expect(
      renderHook(() => subject.useGroupOfflineMembers('group-a')).result.current.offlineMembers
    ).toEqual([{ id: 'offline' }]);

    const offline = {
      id: 'offline-membership',
      status: 'active',
      group_offline_member_id: 'offline',
      group_offline_member: { first_name: 'Offline' },
    };
    mocks.results.set('groups.offlineMembershipsWithRolesAndRights', [offline]);
    expect(
      renderHook(() => subject.useGroupOfflineMemberships('group-a')).result.current
        .offlineMemberships
    ).toHaveLength(1);
    mocks.results.set('groups.offlineMembershipsWithRolesAndRightsByGroupIds', [offline]);
    expect(
      renderHook(() => subject.useGroupOfflineMembershipsByGroupIds(['group-a', '', 'group-a']))
        .result.current.offlineMemberships
    ).toHaveLength(1);
  });

  it('filters user search and returns public/subscription data', () => {
    mocks.results.set('groups.allUsersLimited', [
      { id: 'ada', first_name: 'Ada', last_name: 'Lovelace', handle: 'analytical' },
      { id: 'grace', first_name: 'Grace', last_name: 'Hopper', handle: null },
      { id: 'linus', first_name: null, last_name: null, handle: 'torvalds' },
    ]);
    expect(
      renderHook(() => subject.useUserSearch('  ADA ', ['grace'])).result.current.users
    ).toEqual([expect.objectContaining({ id: 'ada' })]);
    expect(renderHook(() => subject.useUserSearch('torv')).result.current.users).toEqual([
      expect.objectContaining({ id: 'linus' }),
    ]);
    expect(renderHook(() => subject.useUserSearch('', ['ada'])).result.current.users).toHaveLength(
      2
    );

    mocks.results.set('groups.publicGroups', [{ id: 'public' }]);
    expect(renderHook(() => subject.usePublicGroups()).result.current.groups).toEqual([
      { id: 'public' },
    ]);
    mocks.results.set('groups.userMembershipsWithGroupRelations', [{ id: 'subscription' }]);
    expect(
      renderHook(() => subject.useUserGroupSubscriptions('user-a')).result.current.memberships
    ).toEqual([{ id: 'subscription' }]);
  });

  it('derives active and event-manageable current-user groups', () => {
    mocks.results.set('groups.currentUserMembershipsWithGroups', [
      membership('active', 'active'),
      { ...membership('admin', 'admin'), group_id: 'group-admin' },
      { ...membership('member', 'member'), group_id: 'group-member' },
      { ...membership('missing', 'active'), group_id: null },
      membership('inactive', 'revoked'),
    ]);
    expect(
      renderHook(() => subject.useCurrentUserActiveGroupIds()).result.current.activeGroupIds
    ).toEqual(new Set(['group-a', 'group-admin', 'group-member']));

    mocks.results.set('groups.currentUserActiveMembershipsWithGroups', [
      { ...membership('b'), group: { id: 'b', name: ' beta ' } },
      { ...membership('a'), group: { id: 'a', name: 'Alpha' } },
      { ...membership('a2'), group: { id: 'a', name: 'Alpha duplicate' } },
      { ...membership('fallback'), group: { id: 'fallback', name: ' ' } },
      { ...membership('none'), group: null },
    ]);
    expect(renderHook(() => subject.useCurrentUserActiveGroups()).result.current.groups).toEqual([
      { id: 'a', name: 'Alpha duplicate' },
      { id: 'b', name: 'beta' },
      { id: 'fallback', name: 'fallback' },
    ]);

    mocks.results.set('groups.currentUserMembershipsWithRights', [
      membership('create', 'active', memberRole),
      { ...membership('manage', 'admin', boardRole), group_id: 'group-board' },
      membership('inactive', 'revoked', boardRole),
      { ...membership('no-role', 'active', memberRole), membership_roles: [], role: null },
      {
        ...membership('wrong-right', 'active', memberRole),
        membership_roles: [
          { role: { id: 'other', action_rights: [{ resource: 'groups', action: 'manage' }] } },
        ],
      },
      { ...membership('no-group', 'active', memberRole), group_id: null },
    ]);
    expect(
      renderHook(() => subject.useUserGroupsWithManageEvents()).result.current.manageEventGroupIds
    ).toEqual(new Set(['group-a', 'group-board']));
  });

  it('returns deterministic empty contracts for every focused hook', () => {
    expect(renderHook(() => subject.useGroupWikiData('group-a')).result.current.group).toBeNull();
    expect(
      renderHook(() => subject.useViewerMembershipOverview(undefined)).result.current
    ).toMatchObject({
      group: null,
      memberships: [],
      guestAccesses: [],
      connectedGroupMemberships: [],
      connectedGroupGuestAccesses: [],
      isLoading: false,
    });
    expect(
      renderHook(() => subject.useUserMembershipInGroup(undefined)).result.current
    ).toMatchObject({ memberships: [], allMemberships: [], isLoading: false });
    expect(renderHook(() => subject.useAllGroups()).result.current.groups).toEqual([]);
    expect(renderHook(() => subject.useAllDocuments()).result.current.documents).toEqual([]);
    expect(renderHook(() => subject.useGroupById()).result.current).toMatchObject({
      group: null,
      memberships: [],
      roles: [],
      events: [],
      amendments: [],
      isLoading: false,
    });
    expect(renderHook(() => subject.useGroupMemberships()).result.current.memberships).toEqual([]);
    expect(
      renderHook(() => subject.useGroupMembershipsByGroupIds()).result.current.memberships
    ).toEqual([]);
    expect(renderHook(() => subject.useGroupGuestAccesses()).result.current.guestAccesses).toEqual(
      []
    );
    expect(renderHook(() => subject.useGroupAccessRoles()).result.current.roles).toEqual([]);
    expect(renderHook(() => subject.useGroupNetwork('group-a')).result.current).toMatchObject({
      group: null,
      relationships: [],
    });
    expect(
      renderHook(() => subject.useGroupAmendments('group-a')).result.current.amendments
    ).toEqual([]);
    expect(
      renderHook(() => subject.useGroupAmendmentEventStepRuns([])).result.current
    ).toMatchObject({ stepRuns: [], isLoading: false });
    expect(renderHook(() => subject.useGroupDocuments('group-a')).result.current.documents).toEqual(
      []
    );
    expect(renderHook(() => subject.useGroupRoles('group-a')).result.current.roles).toEqual([]);
    expect(renderHook(() => subject.useGroupRoleOptions(undefined)).result.current).toMatchObject({
      roles: [],
      isLoading: false,
    });
    expect(renderHook(() => subject.useGroupTodos('group-a')).result.current).toMatchObject({
      todos: [],
      archivedTodos: [],
    });
    expect(renderHook(() => subject.useGroupLinks('group-a')).result.current.links).toEqual([]);
    expect(
      renderHook(() => subject.useGroupPaymentsData('group-a')).result.current.payments
    ).toEqual([]);
    expect(
      renderHook(() => subject.useGroupActiveMembers('group-a')).result.current.members
    ).toEqual([]);
    expect(
      renderHook(() => subject.useAssignableGroupMembersByGroupIds()).result.current
    ).toMatchObject({ members: [], isLoading: false });
    expect(renderHook(() => subject.useGroupOfflineMembers()).result.current).toMatchObject({
      offlineMembers: [],
      isLoading: false,
    });
    expect(renderHook(() => subject.useGroupOfflineMemberships()).result.current).toMatchObject({
      offlineMemberships: [],
      isLoading: false,
    });
    expect(
      renderHook(() => subject.useGroupOfflineMembershipsByGroupIds()).result.current
    ).toMatchObject({ offlineMemberships: [], isLoading: false });
    expect(renderHook(() => subject.useUserSearch('')).result.current.users).toEqual([]);
    expect(renderHook(() => subject.usePublicGroups()).result.current.groups).toEqual([]);
    expect(
      renderHook(() => subject.useUserGroupSubscriptions()).result.current.memberships
    ).toEqual([]);
    expect(
      renderHook(() => subject.useCurrentUserActiveGroupIds()).result.current.activeGroupIds
    ).toEqual(new Set());
    expect(renderHook(() => subject.useCurrentUserActiveGroups()).result.current.groups).toEqual(
      []
    );
    expect(
      renderHook(() => subject.useUserGroupsWithManageEvents()).result.current.manageEventGroupIds
    ).toEqual(new Set());
  });

  it('uses focused hook fallbacks after their parent rows have loaded', () => {
    mocks.results.set('groups.wikiOverview', [{ id: 'group-a' }]);
    expect(
      renderHook(() => subject.useGroupWikiData('group-a')).result.current.group
    ).toMatchObject({
      id: 'group-a',
      roles: [],
    });

    mocks.results.set('groups.all', [{ id: 'group-a' }]);
    expect(renderHook(() => subject.useAllGroups()).result.current.groups).toHaveLength(1);

    mocks.results.set('groups.byIdFull', [{ id: 'group-a' }]);
    expect(renderHook(() => subject.useGroupById('group-a')).result.current.group).toMatchObject({
      id: 'group-a',
      memberships: [],
      guest_accesses: [],
    });

    mocks.results.set('groups.membershipsWithRolesAndRightsByGroupIds', [
      membership('ignored', 'revoked'),
    ]);
    expect(
      renderHook(() => subject.useGroupMembershipsByGroupIds(['group-a'])).result.current
        .pendingMemberships
    ).toEqual([]);
  });

  it('combines loading results without depending on query timing', () => {
    const expectLoading = (key: string, hook: () => { isLoading: boolean }) => {
      mocks.statuses.set(key, 'unknown');
      expect(renderHook(hook).result.current.isLoading).toBe(true);
      mocks.statuses.delete(key);
    };

    expectLoading('groups.wikiOverview', () => subject.useGroupWikiData('group-a'));
    expectLoading('network.wikiNetwork', () => subject.useGroupWikiData('group-a'));
    expectLoading('groups.wikiRoleProjection', () => subject.useGroupWikiData('group-a'));
    expectLoading('groups.viewerMembershipOverview', () =>
      subject.useViewerMembershipOverview('group-a')
    );
    expectLoading('groups.userMembershipInGroup', () =>
      subject.useUserMembershipInGroup('user-a', 'group-a')
    );
    expectLoading('groups.allMembershipsInGroupWithRole', () =>
      subject.useUserMembershipInGroup(undefined, 'group-a')
    );
    expectLoading('groups.byIdBasic', () => subject.useGroupSubscribers('group-a'));
    expectLoading('groups.subscribersByGroup', () => subject.useGroupSubscribers('group-a'));
    expectLoading('groups.all', subject.useAllGroups);
    expectLoading('network.allGroupConnections', subject.useAllGroups);
    expectLoading('groups.allDocuments', subject.useAllDocuments);
    expectLoading('groups.byIdFull', () => subject.useGroupById('group-a'));
    expectLoading('network.allGroupConnections', () => subject.useGroupById('group-a'));
    expectLoading('groups.membershipsWithRolesAndRightsByGroupIds', () =>
      subject.useGroupMembershipsByGroupIds(['group-a'])
    );
    expectLoading('groups.roleOptionProjection', () => subject.useGroupRoleOptions('group-a'));
    mocks.statuses.set('groups.todosByGroup:{"groupId":"group-a","archive":"active"}', 'complete');
    mocks.statuses.set('groups.todosByGroup:{"groupId":"group-a","archive":"archived"}', 'unknown');
    expect(renderHook(() => subject.useGroupTodos('group-a')).result.current.isLoading).toBe(true);
    mocks.statuses.clear();
    expectLoading('groups.paymentsPaidByGroup', () => subject.useGroupPaymentsData('group-a'));
    expectLoading('groups.assignableActiveMembersByGroupIds', () =>
      subject.useAssignableGroupMembersByGroupIds(['group-a'])
    );
    expectLoading('groups.offlineMembersByGroup', () => subject.useGroupOfflineMembers('group-a'));
    expectLoading('groups.offlineMembershipsWithRolesAndRights', () =>
      subject.useGroupOfflineMemberships('group-a')
    );
    expectLoading('groups.offlineMembershipsWithRolesAndRightsByGroupIds', () =>
      subject.useGroupOfflineMembershipsByGroupIds(['group-a'])
    );
  });
});

describe('aggregate useGroupState contract', () => {
  it('combines opt-in query data and augments nested groups', () => {
    mocks.results.set('groups.byId', { id: 'group-a' });
    mocks.results.set('groups.memberships', [membership('membership')]);
    mocks.results.set('groups.roles', [memberRole]);
    mocks.results.set('groups.scopedRoles', [boardRole]);
    mocks.results.set('network.allGroupConnections', [peerConnection()]);
    mocks.results.set('groups.membershipsByUser', [membership('by-user')]);
    mocks.results.set('groups.search', [{ id: 'group-a' }, { id: 'group-b' }]);
    mocks.results.set('groups.byUser', [{ ...membership('user-group'), group: { id: 'group-b' } }]);
    mocks.results.set('groups.membershipsWithUsers', [membership('with-users')]);
    mocks.results.set('groups.currentUserMembershipsWithGroups', [
      { ...membership('current'), group: { id: 'group-a' } },
    ]);
    mocks.results.set('groups.currentUserGuestAccessesWithGroups', [
      { group: { id: 'group-b' }, id: 'guest-current' },
      { group: null, id: 'guest-without-group' },
    ]);

    const current = renderHook(() =>
      subject.useGroupState({
        groupId: 'group-a',
        userId: 'user-a',
        includeSearch: true,
        includeMemberships: true,
        includeRoles: true,
        includeScopedRoles: true,
        includeAllRelationships: true,
        includeByUser: true,
        includeMembershipsWithUsers: true,
        includeCurrentUserMembershipsWithGroups: true,
        includeCurrentUserGuestAccessesWithGroups: true,
        includeAllRelationshipsWithGroups: true,
      })
    ).result.current;

    expect(current).toMatchObject({
      group: { id: 'group-a', connected_group_id: 'group-b' },
      memberships: [{ id: 'membership' }],
      roles: [memberRole],
      scopedRoles: [boardRole],
      userMemberships: [{ id: 'by-user' }],
      searchResults: [{ id: 'group-a' }, { id: 'group-b' }],
      userGroupMemberships: [{ group: { id: 'group-b' } }],
      membershipsWithUsers: [{ id: 'with-users' }],
      currentUserMembershipsWithGroups: [{ group: { id: 'group-a' } }],
      currentUserGuestAccessesWithGroups: [
        { group: { id: 'group-b' }, id: 'guest-current' },
        { group: null, id: 'guest-without-group' },
      ],
      isLoading: false,
    });
    expect(current.relationships).toHaveLength(1);
    expect(current.relationshipsAsTarget).toHaveLength(0);
    expect(current.allRelationships).toHaveLength(1);
    expect(current.allRelationshipsWithGroups).toHaveLength(1);
  });

  it('keeps every opt-in disabled by default', () => {
    expect(renderHook(() => subject.useGroupState()).result.current).toMatchObject({
      group: null,
      memberships: [],
      relationships: [],
      relationshipsAsTarget: [],
      searchResults: [],
      allRelationships: [],
      allRelationshipsWithGroups: [],
      isLoading: false,
    });
    expect(mocks.calls.every(call => call.key === undefined)).toBe(true);
  });

  it('reports every aggregate query boundary independently as loading', () => {
    const options = {
      groupId: 'group-a',
      userId: 'user-a',
      includeSearch: true,
      includeMemberships: true,
      includeRoles: true,
      includeScopedRoles: true,
      includeAllRelationships: true,
      includeByUser: true,
      includeMembershipsWithUsers: true,
      includeCurrentUserMembershipsWithGroups: true,
      includeCurrentUserGuestAccessesWithGroups: true,
      includeAllRelationshipsWithGroups: true,
    };
    const keys = [
      'groups.byId',
      'groups.memberships',
      'groups.roles',
      'groups.scopedRoles',
      'network.allGroupConnections',
      'groups.membershipsByUser',
      'groups.search',
      'groups.byUser',
      'groups.membershipsWithUsers',
      'groups.currentUserMembershipsWithGroups',
      'groups.currentUserGuestAccessesWithGroups',
    ];
    for (const key of keys) {
      mocks.statuses.set(key, 'unknown');
      expect(renderHook(() => subject.useGroupState(options)).result.current.isLoading).toBe(true);
      mocks.statuses.delete(key);
    }
  });

  it('uses empty I/O fallbacks while optional aggregate queries are enabled', () => {
    mocks.results.set('groups.byId', { id: 'group-a' });
    mocks.results.set('groups.search', [{ id: 'group-a' }]);
    mocks.results.set('groups.byUser', [{ ...membership('nested'), group: null }]);
    mocks.results.set('groups.currentUserMembershipsWithGroups', [
      { ...membership('current'), group: null },
    ]);
    const current = renderHook(() =>
      subject.useGroupState({
        groupId: 'group-a',
        includeSearch: true,
        includeByUser: true,
        includeCurrentUserMembershipsWithGroups: true,
      })
    ).result.current;
    expect(current.group).toMatchObject({ id: 'group-a', connected_group: null });
    expect(current.searchResults).toHaveLength(1);
    expect(current.userGroupMemberships[0]?.group).toBeNull();
    expect(current.currentUserMembershipsWithGroups[0]?.group).toBeNull();
  });
});
