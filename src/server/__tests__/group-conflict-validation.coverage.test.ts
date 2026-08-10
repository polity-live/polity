import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class MockPermissionError extends Error {}
  return {
    MockPermissionError,
    can: vi.fn(async () => undefined),
    userName: vi.fn(async (_tx: unknown, id: string) => `Fallback ${id}`),
    groups: [] as Record<string, any>[],
    memberships: [] as Record<string, any>[],
    connections: [] as Record<string, any>[],
    grants: [] as Record<string, any>[],
    rules: [] as Record<string, any>[],
    hierarchyPaths: [] as Record<string, any>[],
    membershipLocks: [] as Record<string, any>[],
    siblingSourceLocks: [] as Record<string, any>[],
    membershipById: undefined as Record<string, any> | undefined,
    users: {} as Record<string, Record<string, any> | undefined>,
    derivedMeta: new Map<string, Record<string, any>>(),
    snapshotRelationships: [] as Record<string, any>[],
    draftRelationships: [] as Record<string, any>[],
    derive: vi.fn(),
    childBases: {} as Record<string, string[]>,
    ancestors: {} as Record<string, string[]>,
    linkConflicts: {} as Record<string, string[]>,
    duplicatePaths: [] as Record<string, any>[],
  };
});

vi.mock('@/zero/rbac/errors', () => ({ PermissionError: mocks.MockPermissionError }));
vi.mock('@/zero/rbac/can', () => ({ can: mocks.can }));
vi.mock('@/zero/server-helpers', () => ({
  isActiveGroupStatus: (status: string | null) =>
    status === 'active' || status === 'member' || status === 'admin',
  userName: mocks.userName,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/zero/groups/membership-helpers', () => ({
  filterHierarchyRelationships: (rows: unknown[]) => rows,
}));
vi.mock('@/features/network/logic/groupRelationshipOrientation', () => ({
  getHierarchyRelationshipPair: (relationship: Record<string, any>) =>
    relationship.noPair
      ? null
      : (relationship.pair ??
        (relationship.parent_group_id && relationship.child_group_id
          ? {
              parentGroupId: relationship.parent_group_id,
              childGroupId: relationship.child_group_id,
            }
          : null)),
}));
vi.mock('@/zero/network/derived', () => ({
  buildDerivedGroupNetworkMetaMap: () => mocks.derivedMeta,
  deriveGroupRelationships: (args: Record<string, any>) => {
    mocks.derive(args);
    return args.connections === mocks.connections
      ? mocks.snapshotRelationships
      : mocks.draftRelationships;
  },
}));
vi.mock('@/features/groups/logic/hierarchy', () => ({
  resolveChildBaseGroups: (id: string) => mocks.childBases[id] ?? [],
  resolveHierarchicalAncestors: (id: string) => mocks.ancestors[id] ?? [],
  detectLinkConflicts: (_parent: string, child: string) => mocks.linkConflicts[child] ?? [],
  detectDuplicateHierarchyPaths: () => mocks.duplicatePaths,
}));

function table(name: string) {
  return {
    table: name,
    where: (_field: string, value: string) => ({
      one: () => ({ table: name, one: true, value }),
    }),
  };
}

vi.mock('@/zero/schema', () => ({
  zql: {
    user: table('user'),
    group: table('group'),
    group_membership: table('group_membership'),
    group_connection: table('group_connection'),
    group_right_grant: table('group_right_grant'),
    group_membership_rule: table('group_membership_rule'),
    group_hierarchy_path: table('group_hierarchy_path'),
    group_membership_exclusivity_lock: table('group_membership_exclusivity_lock'),
    group_sibling_source_lock: table('group_sibling_source_lock'),
  },
}));

import {
  assertNoBlockingConflictResponse,
  assertNoBlockingGroupConflicts,
  buildDraftGroupConnectionRelationships,
  getGroupConnectionUpsertConflictResponse,
  getMembershipActivationConflictResponse,
  resolveGroupConflictPreflight,
} from '../group-conflict-validation';

const ctx = { userID: 'user-1' } as never;

const tx = {
  run: vi.fn(async (query: Record<string, any>) => {
    if (query.one && query.table === 'user') return mocks.users[query.value];
    if (query.one && query.table === 'group_membership') return mocks.membershipById;
    switch (query.table) {
      case 'group':
        return mocks.groups;
      case 'group_membership':
        return mocks.memberships;
      case 'group_connection':
        return mocks.connections;
      case 'group_right_grant':
        return mocks.grants;
      case 'group_membership_rule':
        return mocks.rules;
      case 'group_hierarchy_path':
        return mocks.hierarchyPaths;
      case 'group_membership_exclusivity_lock':
        return mocks.membershipLocks;
      case 'group_sibling_source_lock':
        return mocks.siblingSourceLocks;
      default:
        throw new Error(`Unexpected table ${query.table}`);
    }
  }),
  mutate: {},
} as never;

function group(id: string, groupType: string, extra: Record<string, unknown> = {}) {
  return { id, name: id, group_type: groupType, ...extra };
}

function membership(
  id: string,
  groupId: string,
  userId: string,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    group_id: groupId,
    user_id: userId,
    status: 'active',
    visibility: '',
    source: 'direct',
    source_group_id: null,
    created_at: 1,
    ...extra,
  };
}

function connectionInput(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'group_connection_upsert',
    group_a_id: 'child',
    group_b_id: 'parent',
    connection_type: 'hierarchy',
    parent_group_id: 'parent',
    child_group_id: 'child',
    grants: [],
    membership_rule: null,
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.groups = [];
  mocks.memberships = [];
  mocks.connections = [];
  mocks.grants = [];
  mocks.rules = [];
  mocks.hierarchyPaths = [];
  mocks.membershipLocks = [];
  mocks.siblingSourceLocks = [];
  mocks.membershipById = undefined;
  mocks.users = {};
  mocks.derivedMeta = new Map();
  mocks.snapshotRelationships = [];
  mocks.draftRelationships = [];
  mocks.childBases = {};
  mocks.ancestors = {};
  mocks.linkConflicts = {};
  mocks.duplicatePaths = [];
  mocks.can.mockImplementation(async () => undefined);
});

describe('group conflict draft relationship construction', () => {
  it('normalizes draft ids, grants, rules, and rejected proposals', () => {
    mocks.draftRelationships = [{ id: 'derived' }];
    expect(
      buildDraftGroupConnectionRelationships(
        connectionInput({
          grants: [
            {
              right_key: 'informationRight',
              holder_group_id: 'child',
              scope_group_id: 'parent',
              status: 'active',
            },
            {
              id: 'rejected',
              right_key: 'amendmentRight',
              holder_group_id: 'child',
              scope_group_id: 'parent',
              status: 'rejected',
            },
          ],
        })
      )
    ).toEqual([{ id: 'derived' }]);
    expect(mocks.derive).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connections: [expect.objectContaining({ id: 'draft' })],
        grants: [
          expect.objectContaining({
            id: 'draft:informationRight:child',
            initiator_group_id: null,
          }),
        ],
        rules: [],
      })
    );

    buildDraftGroupConnectionRelationships(
      connectionInput({
        connection_id: 'connection-1',
        grants: [
          {
            id: 'grant-1',
            right_key: 'informationRight',
            holder_group_id: 'child',
            scope_group_id: 'parent',
            initiator_group_id: 'child',
          },
        ],
        membership_rule: {
          member_source_group_id: 'child',
          member_target_group_id: 'parent',
          membership_mode: 'all_members',
          required_source_role_id: null,
          eligible_origin_group_ids: [],
        },
      })
    );
    expect(mocks.derive).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connections: [expect.objectContaining({ id: 'connection-1' })],
        grants: [expect.objectContaining({ id: 'grant-1', initiator_group_id: 'child' })],
        rules: [expect.objectContaining({ id: 'connection-1:membership' })],
      })
    );
  });
});

describe('membership activation conflicts', () => {
  it('returns an empty response when target identity or target group is absent', async () => {
    expect(
      await getMembershipActivationConflictResponse(
        tx,
        { userID: null } as never,
        {
          kind: 'membership_activation',
        } as never
      )
    ).toMatchObject({ blocking: false, conflicts: [] });

    expect(
      await resolveGroupConflictPreflight(tx, ctx, {
        kind: 'membership_activation',
        group_id: 'missing',
      } as never)
    ).toMatchObject({ blocking: false, conflicts: [] });
  });

  it('merges persisted and derived group network metadata', async () => {
    mocks.groups = [
      {
        id: 'derived',
        name: null,
        group_type: null,
        has_hierarchy_children: null,
        has_sibling_connections: null,
        connected_group_id: null,
        sibling_membership_mode: null,
        sibling_role_id: null,
      },
      {
        id: 'persisted',
        group_type: 'base',
        has_hierarchy_children: false,
        has_sibling_connections: false,
        connected_group_id: 'partner',
        sibling_membership_mode: 'none',
        sibling_role_id: 'role',
      },
    ];
    mocks.derivedMeta = new Map([
      [
        'derived',
        {
          group_type: 'sibling',
          has_hierarchy_children: true,
          has_sibling_connections: true,
          connected_group_id: 'derived-partner',
          sibling_membership_mode: 'all_members',
          sibling_role_id: 'derived-role',
        },
      ],
    ]);
    const response = await getMembershipActivationConflictResponse(tx, ctx, {
      kind: 'membership_activation',
      group_id: 'derived',
      user_id: 'user-1',
    });
    expect(response.blocking).toBe(false);
  });

  it('detects hierarchy-lock, simulated-direct, and parliament-source overlaps', async () => {
    mocks.groups = [
      group('base-a', 'base'),
      group('base-b', 'base'),
      group('hierarchy', 'hierarchical'),
      group('parliament', 'sibling', {
        sibling_membership_mode: 'parliament',
        parliament_source_group_ids: ['base-a', 'base-b'],
      }),
      group('empty-parliament', 'sibling', {
        sibling_membership_mode: 'parliament',
        parliament_source_group_ids: null,
      }),
      group('unrelated', 'base'),
      group('ignored-sibling', 'sibling', {
        sibling_membership_mode: 'none',
        parliament_source_group_ids: null,
      }),
    ];
    mocks.snapshotRelationships = [
      { relationship_type: 'parent', status: 'active' },
      { relationship_type: 'sibling', status: 'active' },
      { relationship_type: 'parent', status: 'accepted' },
    ];
    mocks.hierarchyPaths = [
      { status: 'inactive', base_group_id: 'base-a', ancestor_group_id: 'ignored' },
      {
        status: 'active',
        base_group_id: 'other',
        descendant_group_id: 'other',
        ancestor_group_id: 'ignored',
      },
      {
        status: 'active',
        base_group_id: 'base-a',
        descendant_group_id: 'x',
        ancestor_group_id: 'hierarchy',
      },
    ];
    mocks.membershipById = membership('target-membership', 'base-a', 'user-1', {
      status: 'invited',
    });
    mocks.memberships = [
      membership('target-membership', 'base-a', 'user-1'),
      membership('other-active', 'base-b', 'user-1'),
      membership('unrelated-active', 'unrelated', 'user-1'),
      membership('wrong-user', 'base-b', 'user-2'),
      membership('inactive', 'base-b', 'user-1', { status: 'inactive' }),
      membership('derived', 'base-b', 'user-1', { source: 'hierarchy' }),
    ];
    mocks.membershipLocks = [
      {
        status: 'inactive',
        user_id: 'user-1',
        hierarchy_group_id: 'hierarchy',
        source_group_id: 'base-b',
      },
      {
        status: 'active',
        user_id: 'user-2',
        hierarchy_group_id: 'hierarchy',
        source_group_id: 'base-b',
      },
      {
        status: 'active',
        user_id: 'user-1',
        hierarchy_group_id: 'other',
        source_group_id: 'base-b',
      },
      {
        status: 'active',
        user_id: 'user-1',
        hierarchy_group_id: 'hierarchy',
        source_group_id: 'base-a',
      },
      {
        status: 'active',
        user_id: 'user-1',
        hierarchy_group_id: 'hierarchy',
        source_group_id: 'base-b',
        group_membership_id: 'target-membership',
      },
      {
        status: 'active',
        user_id: 'user-1',
        hierarchy_group_id: 'hierarchy',
        source_group_id: 'base-b',
        group_membership_id: 'other',
      },
    ];
    mocks.ancestors = { 'base-a': ['hierarchy'] };
    mocks.childBases = { hierarchy: ['base-a', 'base-b'] };
    mocks.users = {
      'user-1': { first_name: 'Ada', last_name: 'Lovelace', handle: 'ada', avatar: 'avatar' },
    };

    const response = await getMembershipActivationConflictResponse(tx, ctx, {
      kind: 'membership_activation',
      membership_id: 'target-membership',
    });
    expect(response.blocking).toBe(true);
    expect(response.conflicts.map(conflict => conflict.kind)).toEqual(
      expect.arrayContaining(['hierarchy_member_overlap', 'sibling_source_overlap'])
    );
    expect(response.conflicts[0]?.details.users[0]).toMatchObject({
      name: 'Ada Lovelace',
      handle: 'ada',
      avatar_url: 'avatar',
    });
  });

  it('uses handle and fallback names and admin-only resolutions for another user', async () => {
    mocks.groups = [
      group('base-a', 'base'),
      group('base-b', 'base'),
      group('hierarchy', 'hierarchical'),
      group('parliament', 'sibling', {
        sibling_membership_mode: 'parliament',
        parliament_source_group_ids: ['base-a', 'base-b'],
      }),
    ];
    mocks.snapshotRelationships = [{ relationship_type: 'parent', status: 'active' }];
    mocks.memberships = [membership('other-active', 'base-b', 'target-user')];
    mocks.ancestors = { 'base-a': ['hierarchy'] };
    mocks.childBases = { hierarchy: ['base-a', 'base-b'] };
    mocks.hierarchyPaths = [
      { status: 'active', base_group_id: 'base-a', ancestor_group_id: 'hierarchy' },
    ];
    mocks.membershipLocks = [
      {
        status: 'active',
        user_id: 'target-user',
        hierarchy_group_id: 'hierarchy',
        source_group_id: 'base-b',
      },
    ];
    mocks.users = { 'target-user': { handle: 'target-handle', avatar: null } };
    const handleResponse = await getMembershipActivationConflictResponse(tx, ctx, {
      kind: 'membership_activation',
      group_id: 'base-a',
      user_id: 'target-user',
    });
    expect(handleResponse.conflicts[0]?.details.users[0]?.name).toBe('target-handle');
    expect(handleResponse.conflicts[0]?.resolutions).toHaveLength(1);

    mocks.users = {};
    const fallbackResponse = await getMembershipActivationConflictResponse(tx, ctx, {
      kind: 'membership_activation',
      group_id: 'base-a',
      user_id: 'fallback-user',
    });
    expect(fallbackResponse.blocking).toBe(false);

    mocks.memberships = [membership('other-active', 'base-b', 'fallback-user')];
    const namedFallback = await getMembershipActivationConflictResponse(tx, ctx, {
      kind: 'membership_activation',
      group_id: 'base-a',
      user_id: 'fallback-user',
    });
    expect(namedFallback.conflicts[0]?.details.users[0]?.name).toBe('Fallback fallback-user');
  });
});

describe('group connection conflicts', () => {
  it('detects member overlaps and relevant duplicate hierarchy paths', async () => {
    mocks.groups = [
      group('parent', 'hierarchical'),
      group('ancestor', 'hierarchical'),
      group('child', 'base'),
      group('other-child', 'base'),
      { id: 'unnamed', name: null, group_type: 'base' },
      { id: 'leaf', name: null, group_type: null },
      group('irrelevant', 'base'),
      group('extra-child', 'base'),
      group('extra-leaf', 'base'),
    ];
    mocks.connections = [{ id: 'old' }];
    mocks.snapshotRelationships = [
      {
        connection_id: 'old',
        relationship_type: 'parent',
        status: null,
        pair: { parentGroupId: 'parent', childGroupId: 'other-child' },
      },
      {
        connection_id: 'old-extra',
        relationship_type: 'parent',
        status: 'active',
        pair: { parentGroupId: 'parent', childGroupId: 'extra-child' },
      },
      {
        connection_id: 'inactive',
        relationship_type: 'parent',
        status: 'inactive',
        pair: { parentGroupId: 'parent', childGroupId: 'ignored' },
      },
      {
        connection_id: 'connection-1',
        relationship_type: 'parent',
        status: 'accepted',
        pair: { parentGroupId: 'parent', childGroupId: 'ignored-self' },
      },
      { connection_id: 'peer', relationship_type: 'sibling', status: 'active' },
    ];
    const primaryDraft = {
      connection_id: 'connection-1',
      relationship_type: 'parent',
      status: 'active',
      pair: { parentGroupId: 'parent', childGroupId: 'child' },
    };
    mocks.draftRelationships = [
      primaryDraft,
      { ...primaryDraft, id: 'duplicate' },
      {
        connection_id: 'second',
        relationship_type: 'parent',
        status: 'active',
        pair: { parentGroupId: 'parent', childGroupId: 'child-2' },
      },
      { relationship_type: 'parent', status: 'active', noPair: true },
      { relationship_type: 'sibling', status: 'active' },
    ];
    mocks.memberships = [
      membership('member-child', 'child', 'user-1'),
      membership('member-other', 'other-child', 'user-1'),
      membership('irrelevant-user', 'irrelevant', 'user-1'),
      membership('different-user', 'irrelevant', 'user-2'),
      membership('inactive', 'child', 'user-2', { status: 'inactive' }),
      membership('derived', 'child', 'user-2', { source: 'hierarchy' }),
    ];
    mocks.linkConflicts = { child: ['user-1'] };
    mocks.childBases = {
      child: ['leaf'],
      parent: ['leaf', 'other-child'],
      'other-child': ['leaf'],
      'extra-child': ['extra-leaf'],
    };
    mocks.ancestors = { parent: ['ancestor'] };
    mocks.duplicatePaths = [
      {
        baseGroupId: 'leaf',
        targetGroupId: 'parent',
        paths: [
          ['leaf', 'unnamed', 'parent'],
          ['leaf', 'parent'],
        ],
      },
      { baseGroupId: 'other', targetGroupId: 'parent', paths: [] },
      { baseGroupId: 'child', targetGroupId: 'other', paths: [] },
    ];
    mocks.users = { 'user-1': { first_name: 'User', last_name: 'One' } };
    mocks.can
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new mocks.MockPermissionError('denied'));

    const response = await getGroupConnectionUpsertConflictResponse(
      tx,
      ctx,
      connectionInput({ connection_id: 'connection-1' })
    );
    expect(response.blocking).toBe(true);
    expect(response.conflicts.map(conflict => conflict.kind)).toEqual(
      expect.arrayContaining(['hierarchy_member_overlap', 'hierarchy_duplicate_path'])
    );
    const duplicate = response.conflicts.find(
      conflict => conflict.kind === 'hierarchy_duplicate_path'
    );
    expect(duplicate?.details.paths[0]?.group_names).toContain('Group');
    expect(mocks.can).toHaveBeenCalledTimes(2);
  });

  it('rethrows unexpected permission failures', async () => {
    mocks.groups = [group('parent', 'hierarchical'), group('child', 'base')];
    mocks.connections = [{ id: 'old' }];
    mocks.snapshotRelationships = [
      {
        connection_id: 'old',
        relationship_type: 'parent',
        status: 'active',
        pair: { parentGroupId: 'parent', childGroupId: 'existing' },
      },
    ];
    mocks.draftRelationships = [
      {
        relationship_type: 'parent',
        status: 'active',
        pair: { parentGroupId: 'parent', childGroupId: 'child' },
      },
    ];
    mocks.linkConflicts = { child: ['user-1'] };
    mocks.users = { 'user-1': { handle: 'user' } };
    mocks.can.mockRejectedValueOnce(new Error('unexpected'));
    await expect(
      getGroupConnectionUpsertConflictResponse(tx, ctx, connectionInput())
    ).rejects.toThrow('unexpected');
  });

  it('detects selected-source peer overlaps and skips non-overlapping configurations', async () => {
    mocks.groups = [
      group('peer-a', 'sibling'),
      group('peer-b', 'sibling'),
      group('source-a', 'base'),
      group('source-b', 'base'),
    ];
    mocks.memberships = [
      membership('a', 'source-a', 'user-1'),
      membership('b', 'source-b', 'user-1'),
      membership('inactive', 'source-b', 'user-2', { status: 'inactive' }),
    ];
    mocks.users = { 'user-1': { handle: 'overlap' } };
    const selectedRule = {
      member_source_group_id: 'peer-a',
      member_target_group_id: 'peer-b',
      membership_mode: 'selected_source_groups',
      required_source_role_id: null,
      eligible_origin_group_ids: ['source-a', '', 'source-a', 'source-b'],
    };
    const response = await getGroupConnectionUpsertConflictResponse(
      tx,
      ctx,
      connectionInput({
        group_a_id: 'peer-a',
        group_b_id: 'peer-b',
        connection_type: 'peer',
        parent_group_id: null,
        child_group_id: null,
        membership_rule: selectedRule,
      })
    );
    expect(response.conflicts).toHaveLength(1);
    expect(response.conflicts[0]?.kind).toBe('sibling_source_overlap');

    await expect(
      resolveGroupConflictPreflight(
        tx,
        ctx,
        connectionInput({
          group_a_id: 'peer-a',
          group_b_id: 'peer-b',
          connection_type: 'peer',
          parent_group_id: null,
          child_group_id: null,
          membership_rule: selectedRule,
        })
      )
    ).resolves.toMatchObject({ blocking: true });

    for (const membershipRule of [
      null,
      { ...selectedRule, membership_mode: 'all_members' },
      { ...selectedRule, eligible_origin_group_ids: null },
      { ...selectedRule, eligible_origin_group_ids: ['source-a'] },
      { ...selectedRule, eligible_origin_group_ids: ['source-a', 'source-b'] },
    ]) {
      if (membershipRule?.eligible_origin_group_ids?.length === 2) mocks.memberships = [];
      const clean = await getGroupConnectionUpsertConflictResponse(
        tx,
        ctx,
        connectionInput({
          group_a_id: 'peer-a',
          group_b_id: 'peer-b',
          connection_type: 'peer',
          parent_group_id: null,
          child_group_id: null,
          membership_rule: membershipRule,
        })
      );
      expect(clean.blocking).toBe(false);
    }
  });
});

describe('blocking response assertions', () => {
  it('returns clean responses and throws blocking responses through every entry point', async () => {
    const clean = Promise.resolve({ blocking: false, summary: '', conflicts: [] });
    await expect(assertNoBlockingConflictResponse(clean)).resolves.toMatchObject({
      blocking: false,
    });
    await expect(
      assertNoBlockingConflictResponse(
        Promise.resolve({
          blocking: true,
          summary: 'Blocked',
          conflicts: [
            {
              kind: 'hierarchy_member_overlap',
              blocking: true,
              summary: 'Blocked',
              explanation: 'Blocked',
              details: { users: [], groups: [], source_groups: [], paths: [], target_group: null },
              resolutions: [],
            },
          ],
        }) as never
      )
    ).rejects.toThrow();

    await expect(
      assertNoBlockingGroupConflicts(tx, ctx, {
        kind: 'membership_activation',
        group_id: 'missing',
      })
    ).resolves.toMatchObject({ blocking: false });

    mocks.groups = [
      group('base-a', 'base'),
      group('base-b', 'base'),
      group('hierarchy', 'hierarchical'),
    ];
    mocks.snapshotRelationships = [{ relationship_type: 'parent', status: 'active' }];
    mocks.memberships = [membership('other', 'base-b', 'user-1')];
    mocks.ancestors = { 'base-a': ['hierarchy'] };
    mocks.childBases = { hierarchy: ['base-a', 'base-b'] };
    mocks.users = { 'user-1': { handle: 'user' } };
    await expect(
      assertNoBlockingGroupConflicts(tx, ctx, {
        kind: 'membership_activation',
        group_id: 'base-a',
        user_id: 'user-1',
      })
    ).rejects.toThrow();
  });
});
