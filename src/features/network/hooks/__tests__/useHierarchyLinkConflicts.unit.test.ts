/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { canActivateMock, conflictIdsMock, isGroupLinkMock, primaryRoleMock, useQueryMock } =
  vi.hoisted(() => ({
    canActivateMock: vi.fn(),
    conflictIdsMock: vi.fn(),
    isGroupLinkMock: vi.fn(),
    primaryRoleMock: vi.fn((row: { primaryRole?: { name: string } | null }) => row.primaryRole),
    useQueryMock: vi.fn(),
  }));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: useQueryMock,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    groups: {
      directMemberships: vi.fn(() => 'direct-query'),
      membershipsWithRolesAndRights: vi.fn(
        ({ groupId }: { groupId: string }) => `partner-query:${groupId}`
      ),
    },
  },
}));

vi.mock('../../logic/hierarchyLinkHelpers', () => ({
  getHierarchyLinkConflictUserIds: conflictIdsMock,
  canActivateHierarchyLink: canActivateMock,
  isGroupLinkRelationship: isGroupLinkMock,
}));

vi.mock('@/features/shared/logic/membershipRoleHelpers', () => ({
  getPrimaryMembershipRole: primaryRoleMock,
}));

import { useHierarchyLinkConflicts } from '../useHierarchyLinkConflicts';

const relationship = { id: 'relationship' } as never;

describe('useHierarchyLinkConflicts', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    conflictIdsMock.mockReset().mockReturnValue(['user-a']);
    canActivateMock.mockReset().mockReturnValue(false);
    isGroupLinkMock.mockReset().mockReturnValue(true);
    primaryRoleMock.mockClear();
  });

  it('supports absent query data and a disabled partner query', () => {
    useQueryMock.mockReturnValueOnce([undefined]).mockReturnValueOnce([undefined]);
    const { result } = renderHook(() => useHierarchyLinkConflicts('current', [], undefined));

    expect(useQueryMock).toHaveBeenNthCalledWith(1, 'direct-query');
    expect(useQueryMock).toHaveBeenNthCalledWith(2, undefined);
    expect(result.current.resolveConflictUsers(['unknown'])).toEqual([
      {
        userId: 'unknown',
        displayName: 'unknown',
        avatarUrl: null,
        membershipIdInCurrentGroup: null,
      },
    ]);
    expect(result.current.resolvePartnerUsers()).toEqual([]);
  });

  it('resolves conflicts and active non-member partner roles with stable deduplication', () => {
    const directRows = [
      {
        id: 'current-a',
        group_id: 'current',
        user_id: 'user-a',
        source: 'direct',
        status: 'active',
        user: { first_name: 'Ada', last_name: 'Alpha', handle: 'ada', avatar: 'ada.png' },
      },
      {
        id: 'current-a-duplicate',
        group_id: 'current',
        user_id: 'user-a',
        source: 'direct',
        status: 'active',
        user: { first_name: 'Ignored', last_name: null, handle: null, avatar: null },
      },
      {
        id: 'other-b',
        group_id: 'other',
        user_id: 'user-b',
        source: 'direct',
        status: 'active',
        user: { first_name: null, last_name: null, handle: 'bee', avatar: null },
      },
    ];
    const partnerRows = [
      {
        id: 'member-only',
        group_id: 'partner',
        user_id: 'member-only',
        status: 'active',
        primaryRole: { name: 'Member' },
        user: { first_name: 'Member', last_name: null, handle: null, avatar: null },
      },
      {
        id: 'partner-admin',
        group_id: 'partner',
        user_id: 'admin',
        status: 'admin',
        primaryRole: null,
        user: { first_name: 'Zoe', last_name: 'Admin', handle: null, avatar: null },
      },
      {
        id: 'partner-board',
        group_id: 'partner',
        user_id: 'board',
        status: 'member',
        primaryRole: { name: 'Board Member' },
        user: { first_name: 'Bob', last_name: 'Board', handle: null, avatar: 'bob.png' },
      },
      {
        id: 'partner-custom',
        group_id: 'partner',
        user_id: 'custom',
        status: 'active',
        primaryRole: { name: 'Treasurer' },
        user: { first_name: null, last_name: null, handle: 'custom-handle', avatar: null },
      },
      {
        id: 'partner-role-active',
        group_id: 'partner',
        user_id: 'role-active',
        status: 'pending',
        primaryRole: { name: 'Admin' },
        user: { first_name: 'Amy', last_name: null, handle: null, avatar: null },
      },
      {
        id: 'partner-inactive',
        group_id: 'partner',
        user_id: 'inactive',
        status: 'pending',
        primaryRole: { name: 'Observer' },
        user: { first_name: 'Inactive', last_name: null, handle: null, avatar: null },
      },
      {
        id: 'partner-board-duplicate',
        group_id: 'partner',
        user_id: 'board',
        status: 'active',
        primaryRole: { name: 'Admin' },
        user: { first_name: 'Duplicate', last_name: null, handle: null, avatar: null },
      },
    ];
    useQueryMock.mockReturnValueOnce([directRows]).mockReturnValueOnce([partnerRows]);
    const relationships = [relationship];
    const { result } = renderHook(() =>
      useHierarchyLinkConflicts('current', relationships, 'partner')
    );

    expect(result.current.getConflictUserIds(relationship)).toEqual(['user-a']);
    expect(conflictIdsMock).toHaveBeenCalledWith(relationship, relationships, [
      { group_id: 'current', user_id: 'user-a', source: 'direct', status: 'active' },
      { group_id: 'current', user_id: 'user-a', source: 'direct', status: 'active' },
      { group_id: 'other', user_id: 'user-b', source: 'direct', status: 'active' },
    ]);
    expect(result.current.canActivateLink(relationship)).toBe(false);
    expect(result.current.isLinkCheckApplicable(relationship)).toBe(true);
    expect(result.current.resolveConflictUsers(['user-a', 'user-b', 'unknown'])).toEqual([
      {
        userId: 'user-a',
        displayName: 'Ada Alpha',
        avatarUrl: 'ada.png',
        membershipIdInCurrentGroup: 'current-a',
      },
      {
        userId: 'user-b',
        displayName: 'bee',
        avatarUrl: null,
        membershipIdInCurrentGroup: null,
      },
      {
        userId: 'unknown',
        displayName: 'unknown',
        avatarUrl: null,
        membershipIdInCurrentGroup: null,
      },
    ]);
    expect(result.current.resolvePartnerUsers().map(user => user.displayName)).toEqual([
      'Amy',
      'Bob Board',
      'custom-handle',
      'Zoe Admin',
    ]);

    act(() => {
      result.current.resolvePartnerUsers();
    });
  });
});
