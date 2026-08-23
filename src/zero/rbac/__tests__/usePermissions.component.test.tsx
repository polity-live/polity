/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreatableGroupIds, usePermissionEvaluator, usePermissions } from '../usePermissions';

const mocks = vi.hoisted(() => ({
  authUser: undefined as { id: string } | undefined,
  checkPermission: vi.fn(),
  data: {} as Record<string, unknown>,
  hasActiveVotingRight: vi.fn(),
  hasPassiveVotingRight: vi.fn(),
  isAmendmentAuthor: vi.fn(),
  isAmendmentCollaborator: vi.fn(),
  isBlogger: vi.fn(),
  isEventParticipant: vi.fn(),
  isGroupMember: vi.fn(),
  isSelf: vi.fn(),
  resultTypes: {} as Record<string, string>,
  useQuery: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: unknown) => mocks.useQuery(query),
}));

vi.mock('../../queries', () => ({
  queries: {
    rbac: {
      viewerMemberships: () => 'memberships',
      viewerGuestAccesses: () => 'guestAccesses',
      viewerParticipations: () => 'participations',
      viewerBloggerRelations: () => 'bloggerRelations',
      viewerOwnedGroups: () => 'ownedGroups',
    },
  },
}));

vi.mock('../check', () => ({
  checkPermission: mocks.checkPermission,
  hasActiveVotingRight: mocks.hasActiveVotingRight,
  hasPassiveVotingRight: mocks.hasPassiveVotingRight,
  isAmendmentAuthor: mocks.isAmendmentAuthor,
  isAmendmentCollaborator: mocks.isAmendmentCollaborator,
  isBlogger: mocks.isBlogger,
  isEventParticipant: mocks.isEventParticipant,
  isGroupMember: mocks.isGroupMember,
  isSelf: mocks.isSelf,
}));

function completeData() {
  mocks.data = {
    memberships: [],
    guestAccesses: [],
    participations: [],
    bloggerRelations: [],
    ownedGroups: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authUser = undefined;
  mocks.data = {};
  mocks.resultTypes = {};
  mocks.checkPermission.mockReturnValue(true);
  mocks.isSelf.mockReturnValue(true);
  mocks.isGroupMember.mockReturnValue(true);
  mocks.isEventParticipant.mockReturnValue(true);
  mocks.isBlogger.mockReturnValue(true);
  mocks.isAmendmentCollaborator.mockReturnValue(true);
  mocks.isAmendmentAuthor.mockReturnValue(true);
  mocks.hasActiveVotingRight.mockReturnValue(true);
  mocks.hasPassiveVotingRight.mockReturnValue(true);
  mocks.useQuery.mockImplementation((query: unknown) => {
    const key = typeof query === 'string' ? query : undefined;
    return [
      key ? mocks.data[key] : undefined,
      { type: key ? (mocks.resultTypes[key] ?? 'complete') : 'complete' },
    ];
  });
});

describe('usePermissions', () => {
  it('returns safe anonymous defaults without invoking the permission engine', () => {
    const { result } = renderHook(() => usePermissions({ amendment: { id: 'amendment-one' } }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.userId).toBeUndefined();
    expect(result.current.can('view', 'groups')).toBe(false);
    expect(result.current.canView('groups')).toBe(false);
    expect(result.current.canManage('groups')).toBe(false);
    expect(result.current.canCreate('groups')).toBe(false);
    expect(result.current.canUpdate('groups')).toBe(false);
    expect(result.current.canDelete('groups')).toBe(false);
    expect(result.current.isMember()).toBe(false);
    expect(result.current.isParticipant()).toBe(false);
    expect(result.current.isABlogger()).toBe(false);
    expect(result.current.isCollaborator()).toBe(false);
    expect(result.current.isAuthor()).toBe(false);
    expect(result.current.canVote()).toBe(false);
    expect(result.current.canBeCandidate()).toBe(false);
    expect(result.current.isMe('someone')).toBe(true);
    expect(mocks.isSelf).toHaveBeenCalledWith('someone', undefined);
    expect(mocks.checkPermission).not.toHaveBeenCalled();
    expect(mocks.useQuery).toHaveBeenCalledTimes(5);
    expect(mocks.useQuery).toHaveBeenCalledWith(undefined);
  });

  it('maps active permission relations and exposes every scoped helper', () => {
    mocks.authUser = { id: 'user-one' };
    mocks.data = {
      memberships: [
        {
          id: 'membership-active',
          group_id: 'group-one',
          status: 'active',
          membership_roles: [
            { role: null },
            { role: { id: null } },
            {
              role: {
                id: 'role-fallback',
                name: null,
                description: null,
                scope: null,
                action_rights: undefined,
              },
            },
            {
              role: {
                id: 'role-full',
                name: 'Coordinator',
                description: 'Coordinates work',
                scope: 'event',
                group_id: 'group-one',
                event_id: 'event-one',
                amendment_id: 'amendment-one',
                blog_id: 'blog-one',
                action_rights: [
                  {
                    id: 42,
                    resource: 'events',
                    action: 'create',
                    group_id: 'group-one',
                    event_id: 'event-one',
                    amendment_id: 'amendment-one',
                    blog_id: 'blog-one',
                  },
                  { id: null, resource: null, action: null },
                ],
              },
            },
          ],
        },
        { id: 'membership-member', group_id: 'group-two', status: 'member' },
        { id: 'membership-admin', group_id: 'group-three', status: 'admin' },
        { id: 'membership-pending', group_id: 'group-four', status: 'pending' },
      ],
      guestAccesses: [
        {
          id: 'guest-active',
          group_id: 'group-guest',
          status: 'active',
          guest_roles: [
            {
              role: {
                id: 'guest-role',
                name: 'Guest',
                scope: null,
                action_rights: [],
              },
            },
          ],
        },
        { id: 'guest-revoked', group_id: 'group-revoked', status: 'revoked' },
      ],
      participations: [
        {
          id: 'participant-active',
          event_id: 'event-one',
          status: 'active',
          participant_roles: [
            {
              role: {
                id: 'event-role',
                name: 'Organizer',
                scope: 'event',
                event_id: 'event-one',
                action_rights: [
                  {
                    id: 'event-right',
                    resource: 'events',
                    action: 'manage',
                    event_id: 'event-one',
                  },
                ],
              },
            },
          ],
        },
        { id: 'participant-confirmed', event_id: 'event-two', status: 'confirmed' },
        { id: 'participant-member', event_id: 'event-three', status: 'member' },
        { id: 'participant-admin', event_id: 'event-four', status: 'admin' },
        { id: 'participant-invited', event_id: 'event-five', status: 'invited' },
      ],
      bloggerRelations: [
        {
          id: 'blogger-with-role',
          blog_id: 'blog-one',
          role: {
            id: 'blog-role',
            name: 'Writer',
            description: 'Writes posts',
            scope: 'blog',
            group_id: 'group-one',
            event_id: 'event-one',
            amendment_id: 'amendment-one',
            blog_id: 'blog-one',
            action_rights: [],
          },
          status: 'writer',
        },
        {
          id: 'blogger-with-unscoped-role',
          blog_id: 'blog-two',
          role: {
            id: 'unscoped-blog-role',
            name: 'Member',
            description: null,
            scope: 'blog',
            action_rights: [],
          },
          status: 'member',
        },
        { id: 'blogger-without-role', blog_id: 'blog-three', role: null },
      ],
      ownedGroups: [{ id: 'group-owned' }],
    };
    const amendment = { id: 'amendment-one' };
    const { result } = renderHook(() =>
      usePermissions({
        groupId: 'group-one',
        eventId: 'event-one',
        blogId: 'blog-one',
        amendment,
      })
    );

    expect(result.current.can('view', 'groups')).toBe(true);
    expect(result.current.canView('groups')).toBe(true);
    expect(result.current.canManage('groups')).toBe(true);
    expect(result.current.canCreate('events')).toBe(true);
    expect(result.current.canUpdate('blogs')).toBe(true);
    expect(result.current.canDelete('todos')).toBe(true);
    expect(result.current.isMe('user-one')).toBe(true);
    expect(result.current.isMember()).toBe(true);
    expect(result.current.isParticipant()).toBe(true);
    expect(result.current.isABlogger()).toBe(true);
    expect(result.current.isCollaborator()).toBe(true);
    expect(result.current.isAuthor()).toBe(true);
    expect(result.current.canVote()).toBe(true);
    expect(result.current.canBeCandidate()).toBe(true);

    const permissionData = mocks.checkPermission.mock.calls[0][0];
    expect(permissionData).toEqual(
      expect.objectContaining({
        userId: 'user-one',
        ownedGroupIds: ['group-owned'],
      })
    );
    expect(permissionData.memberships).toHaveLength(3);
    expect(permissionData.memberships[0]).toEqual(
      expect.objectContaining({
        id: 'membership-active',
        group: { id: 'group-one' },
        status: 'active',
      })
    );
    expect(permissionData.memberships[0].roles).toEqual([
      {
        id: 'role-fallback',
        name: '',
        description: undefined,
        scope: 'group',
        group: undefined,
        event: undefined,
        amendment: undefined,
        blog: undefined,
        actionRights: [],
      },
      {
        id: 'role-full',
        name: 'Coordinator',
        description: 'Coordinates work',
        scope: 'event',
        group: { id: 'group-one' },
        event: { id: 'event-one' },
        amendment: { id: 'amendment-one' },
        blog: { id: 'blog-one' },
        actionRights: [
          {
            id: '42',
            resource: 'events',
            action: 'create',
            group: { id: 'group-one' },
            event: { id: 'event-one' },
            amendment: { id: 'amendment-one' },
            blog: { id: 'blog-one' },
          },
          {
            id: '',
            resource: '',
            action: '',
            group: undefined,
            event: undefined,
            amendment: undefined,
            blog: undefined,
          },
        ],
      },
    ]);
    expect(permissionData.guestAccesses).toEqual([
      expect.objectContaining({ id: 'guest-active', group: { id: 'group-guest' } }),
    ]);
    expect(permissionData.participations).toHaveLength(4);
    expect(permissionData.participations[0].roles).toEqual([
      expect.objectContaining({
        id: 'event-role',
        scope: 'event',
        event: { id: 'event-one' },
        actionRights: [
          expect.objectContaining({
            id: 'event-right',
            event: { id: 'event-one' },
          }),
        ],
      }),
    ]);
    expect(permissionData.bloggerRelations).toEqual([
      expect.objectContaining({
        id: 'blogger-with-role',
        status: 'writer',
        role: expect.objectContaining({
          id: 'blog-role',
          scope: 'blog',
          group: { id: 'group-one' },
          event: { id: 'event-one' },
          amendment: { id: 'amendment-one' },
          blog: { id: 'blog-one' },
        }),
      }),
      expect.objectContaining({
        id: 'blogger-with-unscoped-role',
        status: 'member',
        role: expect.objectContaining({
          id: 'unscoped-blog-role',
          group: undefined,
          event: undefined,
          amendment: undefined,
          blog: undefined,
        }),
      }),
      {
        id: 'blogger-without-role',
        blog: { id: 'blog-three' },
        role: undefined,
        status: undefined,
      },
    ]);
    expect(mocks.checkPermission.mock.calls[0][1]).toEqual({
      groupId: 'group-one',
      eventId: 'event-one',
      blogId: 'blog-one',
      amendment,
    });
  });

  it('does not invoke scoped relation helpers when their context is absent', () => {
    mocks.authUser = { id: 'user-one' };
    completeData();
    const { result } = renderHook(() => usePermissions({}));

    expect(result.current.isMember()).toBe(false);
    expect(result.current.isParticipant()).toBe(false);
    expect(result.current.isABlogger()).toBe(false);
    expect(result.current.isCollaborator()).toBe(false);
    expect(result.current.isAuthor()).toBe(false);
    expect(result.current.canVote()).toBe(false);
    expect(result.current.canBeCandidate()).toBe(false);
    expect(mocks.isGroupMember).not.toHaveBeenCalled();
    expect(mocks.isEventParticipant).not.toHaveBeenCalled();
    expect(mocks.isBlogger).not.toHaveBeenCalled();
    expect(mocks.isAmendmentCollaborator).not.toHaveBeenCalled();
    expect(mocks.isAmendmentAuthor).not.toHaveBeenCalled();
  });
});

describe('usePermissionEvaluator', () => {
  it.each(['memberships', 'guestAccesses', 'participations', 'bloggerRelations', 'ownedGroups'])(
    'blocks evaluation while %s is loading',
    loadingKey => {
      mocks.authUser = { id: 'user-one' };
      completeData();
      mocks.resultTypes[loadingKey] = 'unknown';
      const { result } = renderHook(() => usePermissionEvaluator());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.can({ groupId: 'group-one' }, 'view', 'groups')).toBe(false);
      expect(mocks.checkPermission).not.toHaveBeenCalled();
    }
  );

  it('evaluates arbitrary scopes from one mapped permission snapshot', () => {
    mocks.authUser = { id: 'user-one' };
    completeData();
    const { result } = renderHook(() => usePermissionEvaluator());
    const scope = { eventId: 'event-one' };

    expect(result.current.can(scope, 'manage', 'events')).toBe(true);
    expect(mocks.checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-one' }),
      scope,
      'manage',
      'events'
    );
  });

  it('returns false for anonymous evaluators', () => {
    const { result } = renderHook(() => usePermissionEvaluator());

    expect(result.current.can({}, 'view', 'groups')).toBe(false);
    expect(mocks.checkPermission).not.toHaveBeenCalled();
  });
});

describe('useCreatableGroupIds', () => {
  it('returns an empty set for anonymous users', () => {
    const { result } = renderHook(() => useCreatableGroupIds('events'));

    expect([...result.current.creatableGroupIds]).toEqual([]);
  });

  it('handles unavailable authenticated relation snapshots', () => {
    mocks.authUser = { id: 'user-one' };
    const { result } = renderHook(() => useCreatableGroupIds('events'));

    expect([...result.current.creatableGroupIds]).toEqual([]);
    expect(mocks.checkPermission).not.toHaveBeenCalled();
  });

  it('deduplicates relation groups and checks create permission for each candidate', () => {
    mocks.authUser = { id: 'user-one' };
    mocks.data = {
      memberships: [
        { id: 'membership-one', group_id: 'group-one', status: 'active' },
        { id: 'membership-duplicate', group_id: 'group-one', status: 'member' },
        { id: 'membership-empty', group_id: '', status: 'admin' },
      ],
      guestAccesses: [
        { id: 'guest-one', group_id: 'group-denied', status: 'active' },
        { id: 'guest-empty', group_id: '', status: 'active' },
      ],
      participations: [],
      bloggerRelations: [],
      ownedGroups: [{ id: 'group-owned' }, { id: 'group-one' }],
    };
    mocks.checkPermission.mockImplementation(
      (_data: unknown, scope: { groupId?: string }) => scope.groupId !== 'group-denied'
    );
    const { result } = renderHook(() => useCreatableGroupIds('events'));

    expect([...result.current.creatableGroupIds].sort()).toEqual(['group-one', 'group-owned']);
    expect(mocks.checkPermission).toHaveBeenCalledTimes(3);
    for (const call of mocks.checkPermission.mock.calls) {
      expect(call[2]).toBe('create');
      expect(call[3]).toBe('events');
    }
  });
});
