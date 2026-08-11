/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as any,
  group: null as any,
  groupLoading: false,
  membership: {} as any,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupWikiData: () => ({ group: mocks.group, isLoading: mocks.groupLoading }),
}));
vi.mock('../useSubscribeGroup', () => ({
  useSubscribeGroup: () => ({
    isSubscribed: false,
    subscriberCount: 5,
    isLoading: false,
    toggleSubscribe: vi.fn(),
  }),
}));
vi.mock('../useGroupMembership', () => ({ useGroupMembership: () => mocks.membership }));
vi.mock('@/features/auth/logic/checkEntityAccess', () => ({
  checkEntityAccess: (_visibility: any, authenticated: boolean, member: boolean) =>
    authenticated || member,
}));
vi.mock('@/features/groups/logic/groupTypeFlags', () => ({
  getGroupTypeFlags: (group: any) => ({
    isBase: group?.group_type === 'base',
    isHierarchical: group?.group_type === 'hierarchical',
    isSibling: group?.group_type === 'sibling',
  }),
}));

import { useGroupWikiPage } from '../useGroupWikiPage';

beforeEach(() => {
  mocks.user = null;
  mocks.group = null;
  mocks.groupLoading = false;
  mocks.membership = {
    status: null,
    isMember: false,
    hasRequested: false,
    isInvited: false,
    canRequestJoin: true,
    canAcceptInvitation: false,
    requestJoinDisabledReason: null,
    requestJoinConflictResponse: null,
    acceptInvitationConflictResponse: null,
    memberCount: 7,
    isLoading: false,
    requestJoin: vi.fn(),
    leaveGroup: vi.fn(),
    acceptInvitation: vi.fn(),
  };
});
afterEach(cleanup);

describe('useGroupWikiPage', () => {
  it('falls back from stored counts to membership and empty counts', () => {
    let hook = renderHook(() => useGroupWikiPage('g'));
    expect(hook.result.current).toMatchObject({
      memberCount: 7,
      eventsCount: 0,
      amendmentsCount: 0,
      isAuthenticated: false,
      isOpenSibling: false,
    });
    hook.unmount();
    mocks.membership.memberCount = null;
    mocks.group = {
      group_type: 'base',
      memberships: [{ status: 'active' }, { status: 'requested' }],
    };
    hook = renderHook(() => useGroupWikiPage('g'));
    expect(hook.result.current.memberCount).toBe(1);
  });

  it('prefers stored counts and derives open sibling and authenticated access flags', () => {
    mocks.user = { id: 'u' };
    mocks.group = {
      group_type: 'sibling',
      primary_sibling_membership_mode: 'none',
      member_count: 9,
      event_count: 8,
      amendment_count: 6,
    };
    const { result } = renderHook(() => useGroupWikiPage('g'));
    expect(result.current).toMatchObject({
      memberCount: 9,
      eventsCount: 8,
      amendmentsCount: 6,
      isAuthenticated: true,
      canAccess: true,
      isSibling: true,
      isOpenSibling: true,
    });
  });

  it('keeps a sibling closed for non-none membership modes', () => {
    mocks.group = { group_type: 'sibling', primary_sibling_membership_mode: 'all' };
    expect(renderHook(() => useGroupWikiPage('g')).result.current.isOpenSibling).toBe(false);
  });
});
