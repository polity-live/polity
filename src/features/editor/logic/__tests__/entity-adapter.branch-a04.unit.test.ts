import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyResolved: vi.fn((content: unknown) => content),
  decorate: vi.fn((_branches: unknown[], rows: { id: string; noDisplay?: boolean }[]) =>
    rows.map((row, index) =>
      row.noDisplay
        ? row
        : {
            ...row,
            displayCrId: `Display ${index + 1}`,
            branchDisplayNumber: index + 1,
            branchScopedCrNumber: index + 10,
          }
    )
  ),
}));

vi.mock('@/features/amendments/logic/amendmentPermissions', () => ({
  getAmendmentPermissionFlags: (amendment: Record<string, unknown>) =>
    amendment.permissionFlags ?? {
      canEdit: false,
      canChangeMode: false,
      canVoteOnChangeRequests: false,
      canManageChangeRequestVotes: false,
    },
  getAmendmentRoleCollaborators: (amendment: Record<string, unknown>) =>
    amendment.roleCollaborators ?? [],
  isActiveAmendmentCollaborator: (collaborator: { active?: boolean }) =>
    collaborator.active !== false,
  mapRoleActionRights: (rights: unknown) => (Array.isArray(rights) ? rights : []),
}));

vi.mock('@/features/change-requests/logic/branchScopedDisplay', () => ({
  decorateBranchScopedChangeRequests: mocks.decorate,
}));

vi.mock('@/features/change-requests/logic/applySuggestionToContent', () => ({
  applyResolvedSuggestionsToContent: mocks.applyResolved,
}));

vi.mock('@/zero/amendments/editing-mode-policy', () => ({
  normalizeEditingMode: (mode: string | null | undefined) => mode ?? 'view',
  isTerminalEditingMode: (mode: string) => mode === 'passed' || mode === 'rejected',
}));

import {
  adaptAmendmentToEntity,
  adaptBlogToEntity,
  adaptDocumentToEntity,
  adaptGroupDocumentToEntity,
  adaptToEditorEntity,
  buildEditorUsersMap,
  checkEntityAccess,
  checkIsOwnerOrCollaborator,
} from '../entity-adapter';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.applyResolved.mockImplementation((content: unknown) => content);
});

const contentMatrix = [
  null,
  'primitive',
  { text: 'leaf' },
  { type: 'p', children: [{ text: 'nested' }] },
  { type: 'p', children: [] },
  { type: 'quote' },
];

function baseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    title: 'Document title',
    content: contentMatrix,
    discussions: [],
    editing_mode: 'edit',
    visibility: 'private',
    updated_at: 123,
    ...overrides,
  };
}

function baseAmendment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'amendment-1',
    title: 'Amendment title',
    group_id: 'group-1',
    discussions: [],
    change_requests: [],
    roleCollaborators: [],
    permissionFlags: {
      canEdit: true,
      canChangeMode: true,
      canVoteOnChangeRequests: true,
      canManageChangeRequestVotes: true,
    },
    ...overrides,
  };
}

describe('entity adapter non-amendment matrix A04', () => {
  it('adapts complete blogs and every blogger status', () => {
    const blog = {
      id: 'blog-1',
      title: 'Blog title',
      content: contentMatrix,
      discussions: [{ id: 'discussion-1' }],
      editing_mode: 'passed',
      visibility: 'authenticated',
      updated_at: 99,
      date: '2026-08-09',
      upvotes: 4,
      group_id: 'group-1',
      bloggers: [
        {
          id: 'owner-link',
          status: 'owner',
          user: {
            id: 'owner',
            first_name: '  Ada ',
            last_name: ' Lovelace  ',
            avatar: 'owner.png',
          },
          role: { name: 'Owner role' },
        },
        {
          id: 'admin-link',
          status: 'admin',
          user: { id: 'admin', first_name: '', last_name: '', email: 'admin@example.test' },
        },
        {
          id: 'writer-link',
          status: 'writer',
          user: { id: 'writer', first_name: null, last_name: null },
        },
        { id: 'missing-user', status: 'writer', user: null },
      ],
    };

    const entity = adaptBlogToEntity(blog);
    expect(entity).toMatchObject({
      id: 'blog-1',
      title: 'Blog title',
      editingMode: 'view',
      visibility: 'authenticated',
      updatedAt: 99,
      owner: { id: 'owner', name: 'Ada Lovelace', avatarUrl: 'owner.png' },
      metadata: { entityType: 'blog', blogId: 'blog-1', blogUpvotes: 4 },
    });
    expect(entity?.collaborators.map(item => item.status)).toEqual([
      'owner',
      'admin',
      'collaborator',
    ]);
    expect(entity?.collaborators[1].user.name).toBe('admin@example.test');
    expect(entity?.collaborators[2].user.name).toBe('Blogger');
    expect(entity?.content[4]).toEqual(expect.objectContaining({ children: [{ text: '' }] }));
  });

  it('covers empty and fallback blog shapes', () => {
    expect(adaptBlogToEntity(null)).toBeNull();
    expect(adaptBlogToEntity(undefined)).toBeNull();
    const entity = adaptBlogToEntity({ id: 'blog-empty', bloggers: null });
    expect(entity).toMatchObject({
      title: '',
      discussions: [],
      visibility: 'public',
      owner: undefined,
      collaborators: [],
    });
    expect(entity?.content).toBeDefined();
    expect(entity?.updatedAt).toEqual(expect.any(Number));
  });

  it('adapts complete and fallback standalone documents', () => {
    const complete = adaptDocumentToEntity(
      baseDocument({
        owner: {
          id: 'owner',
          first_name: 'Owner',
          last_name: 'Person',
          email: 'owner@example.test',
          avatar: null,
        },
        collaborators: [
          {
            id: 'collab-1',
            canEdit: false,
            user: { id: 'collab', first_name: 'Collab', avatar: 'collab.png' },
          },
          { id: 'collab-missing', user: {} },
        ],
      })
    );
    expect(complete).toMatchObject({
      title: 'Document title',
      editingMode: 'edit',
      owner: { id: 'owner' },
      collaborators: [{ id: 'collab-1', canEdit: false }],
    });

    const fallback = adaptDocumentToEntity({
      id: 'document-empty',
      title: '',
      amendment: { title: 'Amendment fallback' },
      collaborators: [{ id: 'default-edit', user: { id: 'user-default' } }],
      content: [],
    });
    expect(fallback).toMatchObject({
      title: 'Amendment fallback',
      discussions: [],
      visibility: 'public',
      collaborators: [{ canEdit: true }],
    });
    expect(adaptDocumentToEntity(null)).toBeNull();
    expect(adaptDocumentToEntity(undefined)).toBeNull();
  });

  it('adapts complete and fallback group documents', () => {
    const complete = adaptGroupDocumentToEntity(
      baseDocument({
        owner: { id: 'owner', first_name: 'Owner' },
        collaborators: [
          { id: 'collab', canEdit: false, user: { id: 'user-2', last_name: 'Member' } },
          { id: 'missing', user: null },
        ],
      }),
      'group-direct',
      'Direct group'
    );
    expect(complete).toMatchObject({
      metadata: { entityType: 'groupDocument', groupId: 'group-direct', groupName: 'Direct group' },
      collaborators: [{ canEdit: false }],
    });

    const fallback = adaptGroupDocumentToEntity(
      {
        id: 'group-document-empty',
        title: '',
        amendment: { title: '', group_id: 'group-from-amendment' },
        collaborators: [{ id: 'default-edit', user: { id: 'user-default' } }],
        content: null,
      },
      ''
    );
    expect(fallback).toMatchObject({
      title: '',
      visibility: 'public',
      discussions: [],
      metadata: { groupId: 'group-from-amendment' },
      collaborators: [{ canEdit: true }],
    });
    expect(adaptGroupDocumentToEntity(null, 'group')).toBeNull();
    expect(adaptGroupDocumentToEntity(undefined, 'group')).toBeNull();
  });

  it('dispatches every entity type, optional group fallback, and runtime default', () => {
    expect(
      adaptToEditorEntity('amendment', {
        amendment: baseAmendment(),
        document: baseDocument(),
      })?.metadata.entityType
    ).toBe('amendment');
    expect(adaptToEditorEntity('blog', { id: 'blog' })?.metadata.entityType).toBe('blog');
    expect(adaptToEditorEntity('document', { id: 'document' })?.metadata.entityType).toBe(
      'document'
    );
    expect(
      adaptToEditorEntity('groupDocument', { id: 'group-document' }, { groupId: 'group' })?.metadata
        .groupId
    ).toBe('group');
    expect(
      adaptToEditorEntity('groupDocument', { id: 'group-document' }, undefined)?.metadata.groupId
    ).toBe('');
    expect(adaptToEditorEntity('runtime-unknown' as never, {})).toBeNull();
  });
});

describe('entity adapter user maps and access matrix A04', () => {
  const collaborator = (id: string | undefined, status: string, canEdit: boolean, name = '') => ({
    id: `link-${String(id)}`,
    user: { id, name, avatarUrl: '' },
    status,
    canEdit,
  });

  const entity = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'entity',
      title: '',
      content: [],
      discussions: [],
      editingMode: 'view',
      visibility: 'private',
      updatedAt: 1,
      owner: undefined,
      collaborators: [],
      metadata: { entityType: 'document' },
      ...overrides,
    }) as never;

  it('builds current, owner, collaborator, duplicate, and fallback users', () => {
    expect(buildEditorUsersMap(null)).toEqual({});
    expect(buildEditorUsersMap(entity())).toEqual({});
    const onlyCurrent = buildEditorUsersMap(null, {
      id: 'current',
      name: '',
      avatarUrl: '',
    });
    expect(onlyCurrent.current).toMatchObject({ name: 'Anonymous' });

    const users = buildEditorUsersMap(
      entity({
        owner: { id: 'owner', name: '', avatarUrl: '' },
        collaborators: [
          collaborator('collab', 'member', true),
          collaborator('owner', 'member', true, 'Duplicate owner'),
          collaborator(undefined, 'member', true),
          {
            ...collaborator('named', 'member', true, 'Named'),
            user: { id: 'named', name: 'Named', avatarUrl: 'named.png' },
          },
        ],
      }),
      { id: 'current', name: 'Current', avatarUrl: 'current.png' }
    );
    expect(users.current).toEqual({ id: 'current', name: 'Current', avatarUrl: 'current.png' });
    expect(users.owner.name).toBe('Owner');
    expect(users.collab.name).toBe('Collaborator');
    expect(users.named.avatarUrl).toBe('named.png');
    expect(users.owner.name).not.toBe('Duplicate owner');
  });

  it('checks public, authenticated, private owner, collaborator, and denied access', () => {
    expect(checkEntityAccess(null, 'user')).toBe(false);
    expect(checkEntityAccess(entity({ visibility: 'public' }))).toBe(true);
    expect(checkEntityAccess(entity({ visibility: 'authenticated' }), 'user')).toBe(true);
    expect(checkEntityAccess(entity({ visibility: 'authenticated' }))).toBe(false);
    expect(checkEntityAccess(entity({ owner: { id: 'owner' } }), 'owner')).toBe(true);
    expect(
      checkEntityAccess(
        entity({ collaborators: [collaborator('collab', 'member', false)] }),
        'collab'
      )
    ).toBe(true);
    expect(checkEntityAccess(entity(), 'other')).toBe(false);
  });

  it('checks owner and every collaborator edit-right alternative', () => {
    expect(checkIsOwnerOrCollaborator(null, 'user')).toBe(false);
    expect(checkIsOwnerOrCollaborator(entity(), undefined)).toBe(false);
    expect(checkIsOwnerOrCollaborator(entity({ owner: { id: 'owner' } }), 'owner')).toBe(true);
    for (const [status, canEdit, expected] of [
      ['owner', false, true],
      ['admin', false, true],
      ['member', true, true],
      ['member', false, false],
    ] as const) {
      expect(
        checkIsOwnerOrCollaborator(
          entity({ collaborators: [collaborator('target', status, canEdit)] }),
          'target'
        )
      ).toBe(expected);
    }
    expect(
      checkIsOwnerOrCollaborator(
        entity({ collaborators: [collaborator('someone-else', 'owner', true)] }),
        'target'
      )
    ).toBe(false);
  });
});

describe('entity adapter amendment matrix A04', () => {
  it('guards both required inputs and uses current-run and empty branch fallbacks', () => {
    expect(adaptAmendmentToEntity(null, baseDocument())).toBeNull();
    expect(adaptAmendmentToEntity(baseAmendment(), null)).toBeNull();
    const fromCurrentRun = adaptAmendmentToEntity(
      baseAmendment({
        current_process_run: { branches: [{ id: 'branch-current', created_at: 1 }] },
      }),
      baseDocument()
    );
    expect(fromCurrentRun?.metadata.processBranchId).toBeUndefined();
    const noBranches = adaptAmendmentToEntity(
      baseAmendment({ current_process_run: { branches: null } }),
      baseDocument()
    );
    expect(noBranches).not.toBeNull();
  });

  it('maps owners, document and role collaborators, status variants, rights, and authors', () => {
    const sharedUser = { id: 'shared', first_name: 'Shared', last_name: 'User' };
    const statuses = ['admin', 'member', 'collaborator', 'owner', 'viewer', 'unexpected'];
    const roleCollaborators = statuses.map((status, index) => ({
      id: `role-${index}`,
      status,
      active: true,
      user: index === 0 ? sharedUser : { id: `role-user-${index}` },
      role: {
        name: index === 0 ? undefined : `Role ${index}`,
        action_rights: [
          { id: `wrong-resource-${index}`, resource: 'blogs', action: 'vote' },
          { id: `wrong-action-${index}`, resource: 'amendments', action: 'view' },
          {
            id: `wrong-amendment-${index}`,
            resource: 'amendments',
            action: 'vote',
            amendment: { id: 'other' },
          },
          { id: `global-${index}`, resource: 'amendments', action: 'vote' },
          {
            id: `matching-${index}`,
            resource: 'amendments',
            action: 'vote',
            amendment: { id: 'amendment-1' },
          },
        ],
      },
    }));
    roleCollaborators.push({ id: 'missing-user', status: 'member', active: true } as never);
    roleCollaborators.push({
      id: 'inactive',
      status: 'member',
      active: false,
      user: { id: 'inactive' },
      role: { action_rights: null },
    } as never);

    const entity = adaptAmendmentToEntity(
      baseAmendment({
        roleCollaborators,
        change_requests: [
          { id: 'no-author' },
          { id: 'owner-author', user: { id: 'owner' } },
          { id: 'collab-author', user: sharedUser },
          { id: 'participant', user: { id: 'participant', email: 'participant@example.test' } },
        ],
      }),
      baseDocument({
        owner: { id: 'owner', first_name: '', last_name: '', email: 'owner@example.test' },
        collaborators: [
          { id: 'document-shared', user: sharedUser, canEdit: null },
          { id: 'document-no-user', user: null },
        ],
      }),
      'shared'
    );

    expect(entity?.owner?.name).toBe('owner@example.test');
    expect(entity?.collaborators).toHaveLength(7);
    expect(entity?.collaborators[0]).toMatchObject({ canEdit: true, status: 'admin' });
    expect(entity?.collaborators.map(item => item.status)).toEqual([
      'admin',
      'member',
      'collaborator',
      'owner',
      'viewer',
      'collaborator',
      'member',
    ]);
    expect(entity?.extraUsers).toEqual([
      expect.objectContaining({ id: 'participant', name: 'participant@example.test' }),
    ]);
  });

  it('enriches unmatched and every persisted change-request discussion fallback', () => {
    const discussions = [
      { id: 'unmatched', crId: 'none', status: 'original' },
      {
        id: 'by-id',
        changeRequestEntityId: 'accepted',
        crId: 'ignored',
        displayCrId: 'discussion-display',
        confirmationStatus: 'ready',
        status: 'discussion-status',
      },
      { id: 'by-title', crId: 'CR-APPROVED', status: 'discussion-status' },
      { id: 'rejected-discussion', changeRequestEntityId: 'rejected' },
      { id: 'declined-discussion', crId: 'CR-DECLINED' },
      { id: 'open-discussion', changeRequestEntityId: 'open', displayCrId: 'fallback-display' },
      { id: 'null-status-discussion', changeRequestEntityId: 'null-status', status: 'kept' },
    ];
    const changeRequests = [
      {
        id: 'accepted',
        title: null,
        status: 'accepted',
        branch_sequence_number: 4,
        votes_for: 2,
        votes_against: 1,
        votes_abstain: 3,
        voting_deadline: 100,
        resolution_method: 'majority',
        visibility_scope: 'internal',
        resolved_in_mode: 'vote',
        voting_status: 'completed',
        votes: [
          { id: 'vote-1', user_id: 'user-1', vote: 'accept' },
          { id: 'vote-2', user_id: 'user-2', vote: null },
        ],
      },
      { id: null, title: 'CR-APPROVED', status: 'approved', votes: null },
      { id: 'rejected', title: '', status: 'rejected' },
      { id: 'declined', title: 'CR-DECLINED', status: 'declined' },
      {
        id: 'open',
        title: 'CR-OPEN',
        status: 'pending_submission',
        votes_for: null,
        votes_against: null,
        votes_abstain: null,
      },
      { id: 'null-status', title: null, status: null },
    ];
    const entity = adaptAmendmentToEntity(
      baseAmendment({
        discussions,
        change_requests: changeRequests,
        internal_cr_voting_close_trigger: 'after_minutes',
        roleCollaborators: [
          {
            id: 'voter',
            active: true,
            status: 'member',
            user: { id: 'voter' },
            role: {
              action_rights: [
                { resource: 'amendments', action: 'vote', amendment: { id: 'amendment-1' } },
              ],
            },
          },
        ],
      }),
      baseDocument()
    );

    expect(entity?.discussions[0]).toBe(discussions[0]);
    expect(entity?.discussions[1]).toMatchObject({
      changeRequestStatus: 'accepted',
      status: 'accepted',
      confirmationStatus: 'confirmed',
      votesFor: 2,
      votesAgainst: 1,
      votesAbstain: 3,
      votedCollaboratorCount: 6,
      closeTrigger: 'after_minutes',
      eligibleVoterCount: 1,
      resolutionMethod: 'majority',
      visibilityScope: 'internal',
      resolvedInMode: 'vote',
      votingStatus: 'completed',
    });
    expect(entity?.discussions[1].votes).toEqual([
      { id: 'vote-1', voterId: 'user-1', vote: 'accept' },
      { id: 'vote-2', voterId: 'user-2', vote: '' },
    ]);
    expect(entity?.discussions[2].status).toBe('accepted');
    expect(entity?.discussions[3].status).toBe('rejected');
    expect(entity?.discussions[4].status).toBe('rejected');
    expect(entity?.discussions[5]).toMatchObject({
      confirmationStatus: 'pending',
      status: undefined,
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
      votingDeadline: null,
      resolutionMethod: null,
      visibilityScope: null,
      resolvedInMode: null,
      votingStatus: null,
      votes: [],
    });
    expect(entity?.discussions[6]).toMatchObject({
      changeRequestStatus: null,
      status: 'kept',
    });
  });

  it('covers branch sorting, first/non-first/no-branch scoping, and readonly modes', () => {
    const branches = [
      { id: 'same-b', created_at: 'invalid' },
      { id: 'same-a', created_at: undefined },
      { id: 'later', created_at: '2026-08-09T12:00:00Z' },
      { id: 'first', created_at: -1, discussions: [{ id: 'branch-discussion' }] },
    ];
    const amendment = baseAmendment({
      discussions: [{ id: 'main-discussion' }],
      change_requests: [
        { id: 'legacy', process_branch_id: null },
        { id: 'first-only', process_branch_id: 'first' },
        { id: 'later-only', process_branch_id: 'later' },
      ],
    });

    const first = adaptAmendmentToEntity(amendment, baseDocument(), 'user', {
      processBranch: branches[3],
      processBranches: branches,
    });
    expect(first?.discussions.map(item => item.id)).toEqual([
      'main-discussion',
      'branch-discussion',
    ]);
    expect(mocks.applyResolved).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.arrayContaining([
        expect.objectContaining({ id: 'legacy', process_branch_id: 'first' }),
        expect.objectContaining({ id: 'first-only' }),
      ])
    );

    const later = adaptAmendmentToEntity(amendment, baseDocument(), 'user', {
      processBranch: {
        ...branches[2],
        discussions: null,
        status: 'scheduled',
        resolution: 'merge_loser',
      },
      processBranches: branches,
    });
    expect(later?.discussions).toEqual([]);
    expect(later?.editingMode).toBe('view');
    expect(later?.canChangeMode).toBe(false);

    const main = adaptAmendmentToEntity(
      { ...amendment, discussions: null, change_requests: null },
      baseDocument({ editing_mode: 'rejected' }),
      'user',
      { processBranch: null, processBranches: [] }
    );
    expect(main?.discussions).toEqual([]);
    expect(main?.editingMode).toBe('view');

    for (const branch of [
      { id: 'rejected', status: 'rejected' },
      { id: 'withdrawn', status: 'withdrawn' },
      { id: 'completed', status: 'completed' },
      { id: 'resolution-rejected', status: 'scheduled', resolution: 'rejected' },
      { id: 'resolution-withdrawn', status: 'scheduled', resolution: 'withdrawn' },
      { id: 'editable', status: null, resolution: null, editing_mode: 'edit' },
    ]) {
      const adapted = adaptAmendmentToEntity(amendment, baseDocument(), 'user', {
        processBranch: branch,
        processBranches: [branch],
      });
      expect(adapted).not.toBeNull();
    }
  });

  it('covers dataset owner, member, guest, manage, view, and denied rights', () => {
    const cases = [
      { group: null, userId: 'user', expected: [false, false] },
      { group: { owner_id: 'owner' }, userId: undefined, expected: [false, false] },
      { group: { owner_id: 'owner' }, userId: 'owner', expected: [true, true] },
      {
        group: {
          memberships: [
            { user_id: 'other', status: 'active' },
            { user: { id: 'member' }, status: 'inactive' },
            { user: { id: 'member' }, status: 'member', membership_roles: null },
          ],
          guest_accesses: null,
        },
        userId: 'member',
        expected: [true, false],
      },
      {
        group: {
          memberships: [],
          guest_accesses: [{ user_id: 'guest-without-role', status: 'active', guest_roles: null }],
        },
        userId: 'guest-without-role',
        expected: [false, false],
      },
      {
        group: {
          memberships: null,
          guest_accesses: [
            { user_id: 'other', status: 'active' },
            { user: { id: 'guest' }, status: 'inactive' },
            {
              user: { id: 'guest' },
              status: 'active',
              guest_roles: [
                { role: { action_rights: [{ resource: 'groupDatasets', action: 'manage' }] } },
              ],
            },
          ],
        },
        userId: 'guest',
        expected: [true, true],
      },
      {
        group: {
          memberships: [],
          guest_accesses: [
            {
              user_id: 'viewer',
              status: 'active',
              guest_roles: [
                { role: { action_rights: [{ resource: 'groupDatasets', action: 'view' }] } },
                { role: null },
              ],
            },
          ],
        },
        userId: 'viewer',
        expected: [true, false],
      },
      {
        group: { memberships: [], guest_accesses: [] },
        userId: 'denied',
        expected: [false, false],
      },
    ] as const;

    for (const testCase of cases) {
      const adapted = adaptAmendmentToEntity(
        baseAmendment({ group: testCase.group }),
        baseDocument(),
        testCase.userId
      );
      expect([adapted?.metadata.canViewDatasets, adapted?.metadata.canManageDatasets]).toEqual(
        testCase.expected
      );
    }
  });

  it('covers amendment content, title, metadata, visibility, and date fallbacks', () => {
    const fallback = adaptAmendmentToEntity(
      baseAmendment({ title: '', group_id: null, group: null }),
      baseDocument({
        title: '',
        content: [],
        visibility: null,
        updated_at: 0,
        editing_mode: null,
        owner: null,
        collaborators: null,
      })
    );
    expect(fallback).toMatchObject({
      title: '',
      visibility: 'public',
      owner: undefined,
      collaborators: [],
      metadata: { groupId: undefined, groupName: undefined },
    });
    expect(fallback?.updatedAt).toEqual(expect.any(Number));

    const amendmentTitle = adaptAmendmentToEntity(
      baseAmendment({ title: 'Fallback amendment', group: { name: 'Group' } }),
      baseDocument({ title: '', content: contentMatrix, visibility: 'private', updated_at: 5 })
    );
    expect(amendmentTitle).toMatchObject({
      title: 'Fallback amendment',
      visibility: 'private',
      updatedAt: 5,
      metadata: { groupName: 'Group' },
    });
  });
});
