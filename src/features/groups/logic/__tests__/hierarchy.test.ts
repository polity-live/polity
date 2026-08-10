import { describe, expect, it } from 'vitest';

import {
  checkExclusivityConstraint,
  collectPathMapForBaseGroup,
  detectDuplicateHierarchyPaths,
  detectLinkConflicts,
  resolveBaseGroupMembers,
  resolveChildBaseGroups,
  resolveHierarchicalAncestors,
} from '../hierarchy';

function hierarchyRelationship(
  id: string,
  parentGroupId: string,
  childGroupId: string,
  overrides: Partial<{
    status: string | null;
    connection_type: 'hierarchy' | 'peer' | null;
    relationship_type: 'parent' | 'child' | 'sibling' | null;
  }> = {}
) {
  return {
    id,
    group_id: parentGroupId,
    related_group_id: childGroupId,
    parent_group_id: parentGroupId,
    child_group_id: childGroupId,
    relationship_type: overrides.relationship_type ?? null,
    connection_type: overrides.connection_type ?? 'hierarchy',
    with_right: null,
    status: overrides.status === undefined ? 'active' : overrides.status,
  };
}

function membership(
  userId: string,
  groupId: string,
  overrides: Partial<{ source: string; status: string }> = {}
) {
  return {
    id: `${userId}:${groupId}`,
    user_id: userId,
    group_id: groupId,
    source: overrides.source ?? 'direct',
    status: overrides.status ?? 'active',
  } as never;
}

describe('hierarchy traversal and exclusivity', () => {
  const relationships = [
    hierarchyRelationship('root-mid', 'root', 'mid'),
    hierarchyRelationship('mid-base-a', 'mid', 'base-a'),
    hierarchyRelationship('root-base-b', 'root', 'base-b'),
  ];

  it('walks ancestors bottom-up and child leaves top-down', () => {
    expect(resolveHierarchicalAncestors('base-a', relationships)).toEqual(['mid', 'root']);
    expect(resolveChildBaseGroups('root', relationships)).toEqual(['base-b', 'base-a']);
    expect(resolveChildBaseGroups('base-a', relationships)).toEqual([]);
  });

  it('ignores inactive, peer, sibling-group, and duplicate hierarchy edges', () => {
    const groupsById = new Map([
      ['root', { group_type: 'hierarchical' }],
      ['base', { group_type: 'base' }],
      ['sibling', { group_type: 'sibling' }],
    ]);
    const rows = [
      hierarchyRelationship('active', 'root', 'base'),
      hierarchyRelationship('duplicate', 'root', 'base'),
      hierarchyRelationship('inactive', 'other', 'base', { status: 'requested' }),
      hierarchyRelationship('peer', 'root', 'other', {
        connection_type: 'peer',
        relationship_type: 'sibling',
      }),
      hierarchyRelationship('sibling-source', 'sibling', 'base'),
      hierarchyRelationship('sibling-target', 'root', 'sibling'),
    ];

    expect(resolveHierarchicalAncestors('base', rows, groupsById)).toEqual(['root']);
  });

  it('collects unique direct users from leaf base groups', () => {
    const users = resolveBaseGroupMembers('root', relationships, [
      membership('u1', 'base-a'),
      membership('u1', 'base-b'),
      membership('u2', 'base-b'),
      membership('derived', 'base-a', { source: 'derived' }),
      membership('outside', 'outside'),
    ] as never[]);

    expect(new Set(users)).toEqual(new Set(['u1', 'u2']));
  });

  it('allows non-hierarchical joins and blocks direct membership in a sibling base group', () => {
    expect(checkExclusivityConstraint('u1', 'standalone', [], [] as never[])).toBe(true);
    expect(
      checkExclusivityConstraint('u1', 'base-a', relationships, [
        membership('u1', 'base-b'),
      ] as never[])
    ).toBe(false);
    expect(
      checkExclusivityConstraint('u1', 'base-a', relationships, [
        membership('u2', 'base-b'),
        membership('u1', 'base-b', { source: 'derived' }),
      ] as never[])
    ).toBe(true);
  });
});

describe('detectLinkConflicts', () => {
  it('finds active direct users shared by a new subtree and an existing sibling subtree', () => {
    const pvrRelationships = [
      hierarchyRelationship('new-base', 'new-child', 'new-base'),
      hierarchyRelationship('existing-base', 'existing-child', 'existing-base'),
    ];
    const activeLinks = [
      hierarchyRelationship('parent-existing', 'parent', 'existing-child'),
      hierarchyRelationship('other-parent', 'other-parent', 'outside'),
      hierarchyRelationship('same-child', 'parent', 'new-child'),
      hierarchyRelationship('inactive', 'parent', 'inactive-child', { status: 'requested' }),
    ];
    const memberships = [
      membership('conflict-active', 'new-base', { status: 'active' }),
      membership('conflict-active', 'existing-base', { status: 'member' }),
      membership('conflict-admin', 'new-base', { status: 'admin' }),
      membership('conflict-admin', 'existing-base', { status: 'active' }),
      membership('pending', 'new-base', { status: 'requested' }),
      membership('pending', 'existing-base'),
      membership('derived', 'new-base', { source: 'derived' }),
      membership('derived', 'existing-base'),
    ];

    expect(
      new Set(
        detectLinkConflicts('parent', 'new-child', pvrRelationships, memberships, activeLinks)
      )
    ).toEqual(new Set(['conflict-active', 'conflict-admin']));
  });

  it('uses the linked child itself when it has no descendant base groups', () => {
    expect(
      detectLinkConflicts(
        'parent',
        'new-child',
        [],
        [membership('u1', 'new-child'), membership('u1', 'existing-child')],
        [hierarchyRelationship('existing', 'parent', 'existing-child')]
      )
    ).toEqual(['u1']);
  });

  it('uses existing PVR children and ignores active-link bases already in the new subtree', () => {
    const pvrRelationships = [
      hierarchyRelationship('parent-existing', 'parent', 'existing-base'),
      hierarchyRelationship('parent-new', 'parent', 'new-child'),
      hierarchyRelationship('new-shared', 'new-child', 'shared-base'),
      hierarchyRelationship('other-shared', 'other-child', 'shared-base'),
    ];

    expect(
      detectLinkConflicts(
        'parent',
        'new-child',
        pvrRelationships,
        [
          membership('existing-conflict', 'existing-base'),
          membership('existing-conflict', 'shared-base'),
        ],
        [hierarchyRelationship('parent-other', 'parent', 'other-child')]
      )
    ).toEqual(['existing-conflict']);
  });
});

describe('hierarchy duplicate paths', () => {
  it('detects when the same base group reaches the same target over two active paths', () => {
    const relationships = [
      {
        id: 'root-mid-a',
        group_id: 'root',
        related_group_id: 'mid-a',
        relationship_type: null,
        with_right: 'passiveVotingRight',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
      {
        id: 'mid-a-leaf',
        group_id: 'mid-a',
        related_group_id: 'leaf',
        relationship_type: null,
        with_right: 'passiveVotingRight',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
      {
        id: 'root-mid-b',
        group_id: 'root',
        related_group_id: 'mid-b',
        relationship_type: null,
        with_right: 'passiveVotingRight',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
      {
        id: 'mid-b-leaf',
        group_id: 'mid-b',
        related_group_id: 'leaf',
        relationship_type: null,
        with_right: 'passiveVotingRight',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
    ];

    expect(detectDuplicateHierarchyPaths(relationships)).toEqual([
      {
        baseGroupId: 'leaf',
        targetGroupId: 'root',
        paths: [
          ['leaf', 'mid-a', 'root'],
          ['leaf', 'mid-b', 'root'],
        ],
      },
    ]);
  });

  it('detects duplicate paths even when hierarchy edges do not carry passive voting rights', () => {
    const relationships = [
      {
        id: 'root-mid-a',
        group_id: 'root',
        related_group_id: 'mid-a',
        relationship_type: null,
        with_right: null,
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
      {
        id: 'mid-a-leaf',
        group_id: 'mid-a',
        related_group_id: 'leaf',
        relationship_type: null,
        with_right: 'informationRight',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
      {
        id: 'root-mid-b',
        group_id: 'root',
        related_group_id: 'mid-b',
        relationship_type: null,
        with_right: 'rightToSpeak',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
      {
        id: 'mid-b-leaf',
        group_id: 'mid-b',
        related_group_id: 'leaf',
        relationship_type: null,
        with_right: null,
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
    ];

    expect(detectDuplicateHierarchyPaths(relationships)).toEqual([
      {
        baseGroupId: 'leaf',
        targetGroupId: 'root',
        paths: [
          ['leaf', 'mid-a', 'root'],
          ['leaf', 'mid-b', 'root'],
        ],
      },
    ]);
  });

  it('uses group types to restrict leaves and filters sibling endpoints', () => {
    const relationships = [
      hierarchyRelationship('root-a', 'root', 'mid-a'),
      hierarchyRelationship('a-leaf', 'mid-a', 'leaf'),
      hierarchyRelationship('root-b', 'root', 'mid-b'),
      hierarchyRelationship('b-leaf', 'mid-b', 'leaf'),
      hierarchyRelationship('sibling-leaf', 'sibling', 'leaf'),
    ];
    const groupsById = new Map([
      ['root', { group_type: 'hierarchical' }],
      ['mid-a', { group_type: 'hierarchical' }],
      ['mid-b', { group_type: 'hierarchical' }],
      ['leaf', { group_type: 'base' }],
      ['sibling', { group_type: 'sibling' }],
    ]);

    expect(detectDuplicateHierarchyPaths(relationships, groupsById)).toEqual([
      {
        baseGroupId: 'leaf',
        targetGroupId: 'root',
        paths: [
          ['leaf', 'mid-a', 'root'],
          ['leaf', 'mid-b', 'root'],
        ],
      },
    ]);
    expect(
      detectDuplicateHierarchyPaths(
        relationships,
        new Map([...groupsById, ['leaf', { group_type: 'hierarchical' }]])
      )
    ).toEqual([]);
  });

  it('returns no conflicts for a single path and terminates cyclic graphs', () => {
    const relationships = [
      hierarchyRelationship('root-mid', 'root', 'mid'),
      hierarchyRelationship('mid-leaf', 'mid', 'leaf'),
      hierarchyRelationship('leaf-root', 'leaf', 'root'),
    ];

    expect(detectDuplicateHierarchyPaths(relationships)).toEqual([]);
  });

  it('caps stored alternatives at two when three duplicate paths exist', () => {
    const relationships = ['a', 'b', 'c'].flatMap(mid => [
      hierarchyRelationship(`root-${mid}`, 'root', `mid-${mid}`),
      hierarchyRelationship(`${mid}-leaf`, `mid-${mid}`, 'leaf'),
    ]);

    expect(detectDuplicateHierarchyPaths(relationships)[0]?.paths).toHaveLength(2);
  });

  it('treats missing group metadata as a non-base leaf when a lookup is supplied', () => {
    const relationships = [
      hierarchyRelationship('root-a', 'root', 'mid-a'),
      hierarchyRelationship('a-leaf', 'mid-a', 'leaf'),
      hierarchyRelationship('root-b', 'root', 'mid-b'),
      hierarchyRelationship('b-leaf', 'mid-b', 'leaf'),
    ];

    expect(detectDuplicateHierarchyPaths(relationships, new Map())).toEqual([]);
  });
});

describe('collectPathMapForBaseGroup', () => {
  it('does not revisit a group already present in the current path', () => {
    const paths = collectPathMapForBaseGroup('leaf', [
      hierarchyRelationship('mid-leaf', 'mid', 'leaf'),
      hierarchyRelationship('leaf-mid', 'leaf', 'mid'),
    ]);

    expect(paths.get('mid')).toEqual([['leaf', 'mid']]);
    expect(paths.has('leaf')).toBe(false);
  });
});
