/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as null | { id: string },
  overview: {} as Record<string, any>,
  zeroMutate: vi.fn((value: unknown) => ({ client: value })),
  joinGroup: vi.fn((value: unknown) => ({ operation: 'join', value })),
  requestGuestAccess: vi.fn((value: unknown) => ({ operation: 'request-guest', value })),
  leaveGroup: vi.fn((value: unknown) => ({ operation: 'leave', value })),
  revokeGuestAccess: vi.fn((value: unknown) => ({ operation: 'revoke-guest', value })),
  acceptInvitation: vi.fn((value: unknown) => ({ operation: 'accept', value })),
  acceptGuestInvitation: vi.fn((value: unknown) => ({ operation: 'accept-guest', value })),
  waitForClientApply: vi.fn(async (value: unknown) => value),
  trackServerFinalization: vi.fn(),
  reportTutorial: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  viewerArg: vi.fn(),
  conflictArg: vi.fn(),
  joinConflict: {
    blocking: false,
    isLoading: false,
    response: { blocking: false, summary: '', conflicts: [] },
  } as Record<string, any>,
  acceptConflict: {
    blocking: false,
    isLoading: false,
    response: { blocking: false, summary: '', conflicts: [] },
  } as Record<string, any>,
}));

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.zeroMutate }) }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useViewerMembershipOverview: (groupId: unknown) => {
    mocks.viewerArg(groupId);
    return mocks.overview;
  },
}));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    groups: {
      joinGroup: mocks.joinGroup,
      requestGuestAccess: mocks.requestGuestAccess,
      leaveGroup: mocks.leaveGroup,
      revokeGuestAccess: mocks.revokeGuestAccess,
      acceptInvitation: mocks.acceptInvitation,
      acceptGuestInvitation: mocks.acceptGuestInvitation,
    },
  },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  trackServerFinalization: mocks.trackServerFinalization,
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('../useGroupConflictPreflight', () => ({
  useGroupConflictPreflight: (input: Record<string, unknown> | null) => {
    mocks.conflictArg(input);
    return input?.membership_id ? mocks.acceptConflict : mocks.joinConflict;
  },
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: mocks.reportTutorial,
}));
vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: (error: unknown) =>
    `localized:${error instanceof Error ? error.message : error}`,
}));

import {
  isActiveMembershipStatus,
  isAdminRole,
  isGuestOnlySiblingMembershipMode,
  isMemberRole,
  normalizeMembershipStatus,
  useGroupMembership,
} from '../useGroupMembership';

function membership(
  id: string,
  status: string | null,
  roleName?: string | null,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    status,
    role: roleName === undefined ? undefined : { name: roleName },
    ...extra,
  };
}

function guest(id: string, status: string | null) {
  return { id, status };
}

function projected(overrides: Record<string, unknown> = {}) {
  return {
    group: { id: 'group-1', group_type: 'base' },
    memberships: [],
    guestAccesses: [],
    connectedGroupMemberships: [],
    memberCount: 3,
    isLoading: false,
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.overview = {
    group: { id: 'group-1', group_type: 'base', signed_up_member_count: 7 },
    memberships: [],
    guestAccesses: [],
    connectedGroupMemberships: [],
    isLoading: false,
  };
  mocks.joinConflict = {
    blocking: false,
    isLoading: false,
    response: { blocking: false, summary: '', conflicts: [] },
  };
  mocks.acceptConflict = {
    blocking: false,
    isLoading: false,
    response: { blocking: false, summary: '', conflicts: [] },
  };
  mocks.waitForClientApply.mockImplementation(async value => value);
  mocks.trackServerFinalization.mockImplementation(() => undefined);
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

describe('membership status helpers', () => {
  it('classifies sibling modes, roles, active states, and normalized statuses', () => {
    expect(
      ['all_members', 'role_members', 'selected_source_groups'].map(
        isGuestOnlySiblingMembershipMode
      )
    ).toEqual([true, true, true]);
    expect(isGuestOnlySiblingMembershipMode('none')).toBe(false);
    expect(isGuestOnlySiblingMembershipMode(null)).toBe(false);

    expect(isAdminRole('Admin')).toBe(true);
    expect(isAdminRole('Board Member')).toBe(true);
    expect(isAdminRole('Member')).toBe(false);
    expect(isMemberRole('Member')).toBe(true);
    expect(isMemberRole('Admin')).toBe(true);
    expect(isMemberRole(null)).toBe(false);

    expect(['active', 'member', 'admin'].map(isActiveMembershipStatus)).toEqual([true, true, true]);
    expect(isActiveMembershipStatus('requested')).toBe(false);
    expect(isActiveMembershipStatus(undefined)).toBe(false);

    expect(normalizeMembershipStatus('requested', null)).toBe('requested');
    expect(normalizeMembershipStatus('invited', null)).toBe('invited');
    expect(normalizeMembershipStatus('admin', null)).toBe('admin');
    expect(normalizeMembershipStatus('unknown', 'Board Member')).toBe('admin');
    expect(normalizeMembershipStatus('active', null)).toBe('member');
    expect(normalizeMembershipStatus('member', null)).toBe('member');
    expect(normalizeMembershipStatus('unknown', 'Member')).toBe('member');
    expect(normalizeMembershipStatus(null, null)).toBeNull();
  });
});

describe('useGroupMembership state selection', () => {
  it('uses queried data and exposes loading and anonymous defaults', () => {
    mocks.user = null;
    mocks.overview.isLoading = true;
    mocks.overview.group = null;
    mocks.overview.memberships = null;
    mocks.overview.guestAccesses = null;
    mocks.overview.connectedGroupMemberships = null;
    const current = renderHook(() => useGroupMembership('group-1')).result.current;
    expect(mocks.viewerArg).toHaveBeenCalledWith('group-1');
    expect(current).toMatchObject({
      membership: null,
      status: null,
      memberCount: 0,
      canRequestJoin: false,
      canAcceptInvitation: false,
      isLoading: true,
    });
    expect(mocks.conflictArg).toHaveBeenCalledWith(null);
  });

  it('prioritizes admin, member, invited, requested, then the original membership', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cases = [
      {
        rows: [membership('requested', 'requested'), membership('admin', 'other', 'Admin')],
        selected: 'admin',
      },
      {
        rows: [membership('requested', 'requested'), membership('member', 'active')],
        selected: 'member',
      },
      {
        rows: [membership('unknown', 'unknown'), membership('invited', 'invited')],
        selected: 'invited',
      },
      {
        rows: [membership('unknown', 'unknown'), membership('requested', 'requested')],
        selected: 'requested',
      },
      {
        rows: [membership('first', 'unknown'), membership('second', 'unknown')],
        selected: 'first',
      },
    ];

    for (const item of cases) {
      const current = renderHook(() =>
        useGroupMembership('group-1', projected({ memberships: item.rows }))
      ).result.current;
      expect(current.membership?.id).toBe(item.selected);
    }
    expect(warn).toHaveBeenCalledTimes(cases.length);
    expect(mocks.viewerArg).toHaveBeenCalledWith(undefined);
  });

  it('normalizes guest statuses and membership booleans', () => {
    const cases = [
      { status: 'requested', expected: 'requested' },
      { status: 'invited', expected: 'invited' },
      { status: 'active', expected: 'member' },
      { status: 'unknown', expected: null },
    ];
    for (const item of cases) {
      const current = renderHook(() =>
        useGroupMembership('group-1', projected({ guestAccesses: [guest('guest-1', item.status)] }))
      ).result.current;
      expect(current.status).toBe(item.expected);
    }

    expect(
      renderHook(() =>
        useGroupMembership('group-1', projected({ memberships: [membership('admin', 'admin')] }))
      ).result.current
    ).toMatchObject({ isMember: true, isAdmin: true, hasRequested: false, isInvited: false });
  });

  it('enforces hierarchical and sibling join eligibility rules', () => {
    expect(
      renderHook(() =>
        useGroupMembership('group-1', projected({ group: { group_type: 'hierarchical' } }))
      ).result.current.requestJoinDisabledReason
    ).toContain('hierarchicalMembershipDisabled');

    expect(
      renderHook(() =>
        useGroupMembership(
          'group-1',
          projected({ group: { group_type: 'sibling', primary_sibling_membership_mode: 'legacy' } })
        )
      ).result.current.requestJoinDisabledReason
    ).toContain('automaticSiblingMembershipDisabled');

    const disconnected = renderHook(() =>
      useGroupMembership(
        'group-1',
        projected({
          group: {
            group_type: 'sibling',
            primary_sibling_membership_mode: 'none',
            connected_group_id: 'partner',
          },
        })
      )
    ).result.current;
    expect(disconnected.requestJoinDisabledReason).toContain(
      'openSiblingMembershipRequiresConnectedGroupMember'
    );

    for (const activeStatus of ['active', 'member', 'admin']) {
      const connected = renderHook(() =>
        useGroupMembership(
          'group-1',
          projected({
            group: {
              group_type: 'sibling',
              primary_sibling_membership_mode: 'none',
              connected_group_id: 'partner',
            },
            connectedGroupMemberships: [{ status: 'inactive' }, { status: activeStatus }],
          })
        )
      ).result.current;
      expect(connected.canRequestJoin).toBe(true);
    }
  });

  it('uses each conflict summary fallback and exposes blocking responses', () => {
    const conflict = { summary: 'Conflict detail' };
    const cases = [
      { summary: 'Response summary', conflicts: [], expected: 'Response summary' },
      { summary: null, conflicts: [conflict], expected: 'Conflict detail' },
      { summary: null, conflicts: [], expected: 'Diese Anfrage ist aktuell blockiert.' },
    ];
    for (const item of cases) {
      mocks.joinConflict = {
        blocking: true,
        isLoading: false,
        response: { blocking: true, summary: item.summary, conflicts: item.conflicts },
      };
      const current = renderHook(() => useGroupMembership('group-1', projected())).result.current;
      expect(current.requestJoinDisabledReason).toBe(item.expected);
      expect(current.requestJoinConflictResponse).toBe(mocks.joinConflict.response);
    }

    mocks.acceptConflict = {
      blocking: true,
      isLoading: true,
      response: { blocking: true, summary: 'Accept blocked', conflicts: [] },
    };
    const invited = renderHook(() =>
      useGroupMembership('group-1', projected({ memberships: [membership('invite', 'invited')] }))
    ).result.current;
    expect(invited.canAcceptInvitation).toBe(false);
    expect(invited.acceptInvitationConflictResponse).toBe(mocks.acceptConflict.response);
    expect(invited.isLoading).toBe(true);
  });

  it('allows guest-flow invitations despite membership conflicts', () => {
    mocks.acceptConflict.blocking = true;
    const current = renderHook(() =>
      useGroupMembership(
        'group-1',
        projected({
          group: { group_type: 'sibling', primary_sibling_membership_mode: 'all_members' },
          guestAccesses: [guest('guest-1', 'invited')],
        })
      )
    ).result.current;
    expect(current.canAcceptInvitation).toBe(true);
    expect(current.isLoading).toBe(false);

    expect(
      renderHook(() =>
        useGroupMembership('group-1', projected({ group: { group_type: 'sibling' } }))
      ).result.current.status
    ).toBeNull();
  });
});

describe('useGroupMembership actions', () => {
  it('guards ineligible join, leave, and accept actions', async () => {
    mocks.user = null;
    const empty = renderHook(() => useGroupMembership('group-1', projected())).result.current;
    await act(() => empty.requestJoin());
    await act(() => empty.leaveGroup());
    await act(() => empty.acceptInvitation());

    const memberState = renderHook(() =>
      useGroupMembership('group-1', projected({ memberships: [membership('member-1', 'active')] }))
    ).result.current;
    await act(() => memberState.requestJoin());

    const guestState = renderHook(() =>
      useGroupMembership('group-1', projected({ guestAccesses: [guest('guest-1', 'active')] }))
    ).result.current;
    await act(() => guestState.requestJoin());
    await act(() => guestState.acceptInvitation());

    const tutorialRequest = renderHook(() =>
      useGroupMembership(
        'group-1',
        projected({
          group: { group_type: 'base', tutorial_run_id: 'tutorial-1' },
          memberships: [membership('request-1', 'requested')],
        })
      )
    ).result.current;
    await act(() => tutorialRequest.leaveGroup());
    expect(mocks.zeroMutate).not.toHaveBeenCalled();
  });

  it('requests a normal membership and handles server-finalization errors', async () => {
    mocks.trackServerFinalization.mockImplementation((_result, options) =>
      options.onError(new Error('server'))
    );
    const { result } = renderHook(() => useGroupMembership('group-1', projected()));
    await act(() => result.current.requestJoin());

    expect(mocks.joinGroup).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', group_id: 'group-1', status: 'requested' })
    );
    expect(mocks.reportTutorial).toHaveBeenCalledWith({
      type: 'action',
      event: 'group-membership.requested',
    });
    expect(mocks.toastError).toHaveBeenCalledWith('features.groups.toasts.joinFailed', {
      description: 'localized:server',
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('features.auth.success.membershipRequestSent');
    expect(result.current.isLoading).toBe(false);
  });

  it('requests guest access for automatic sibling membership', async () => {
    const { result } = renderHook(() =>
      useGroupMembership(
        'group-1',
        projected({
          group: { group_type: 'sibling', primary_sibling_membership_mode: 'role_members' },
        })
      )
    );
    await act(() => result.current.requestJoin());
    expect(mocks.requestGuestAccess).toHaveBeenCalledOnce();
    expect(mocks.joinGroup).not.toHaveBeenCalled();
  });

  it('reports a client-side join failure', async () => {
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('client'));
    const { result } = renderHook(() => useGroupMembership('group-1', projected()));
    await act(() => result.current.requestJoin());
    expect(mocks.toastError).toHaveBeenCalledWith('features.groups.toasts.joinFailed', {
      description: 'localized:client',
    });
  });

  it('leaves a membership and distinguishes withdrawal from ordinary leave', async () => {
    mocks.trackServerFinalization.mockImplementation((_result, options) =>
      options.onError(new Error('server-leave'))
    );
    const requested = renderHook(() =>
      useGroupMembership(
        'group-1',
        projected({ memberships: [membership('request-1', 'requested')] })
      )
    ).result.current;
    await act(() => requested.leaveGroup());
    expect(mocks.leaveGroup).toHaveBeenCalledWith({ id: 'request-1' });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'generated.inline.0554_request_successfully_withdrawn_d63ad8e3'
    );

    const active = renderHook(() =>
      useGroupMembership('group-1', projected({ memberships: [membership('member-1', 'active')] }))
    ).result.current;
    await act(() => active.leaveGroup());
    expect(mocks.toastSuccess).toHaveBeenCalledWith('features.groups.toasts.left');
  });

  it('revokes guest access and reports client-side leave failures', async () => {
    const guestState = renderHook(() =>
      useGroupMembership('group-1', projected({ guestAccesses: [guest('guest-1', 'active')] }))
    ).result.current;
    await act(() => guestState.leaveGroup());
    expect(mocks.revokeGuestAccess).toHaveBeenCalledWith({ id: 'guest-1' });

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('leave-client'));
    const memberState = renderHook(() =>
      useGroupMembership('group-1', projected({ memberships: [membership('member-1', 'active')] }))
    ).result.current;
    await act(() => memberState.leaveGroup());
    expect(mocks.toastError).toHaveBeenCalledWith('features.groups.toasts.leaveFailed', {
      description: 'localized:leave-client',
    });
  });

  it('accepts a membership invitation and exercises finalization callbacks', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.trackServerFinalization.mockImplementation((_result, options) => {
      options.onSuccess();
      options.onError(new Error('server-accept'));
    });
    const { result } = renderHook(() =>
      useGroupMembership('group-1', projected({ memberships: [membership('invite-1', 'invited')] }))
    );
    await act(() => result.current.acceptInvitation());
    expect(mocks.acceptInvitation).toHaveBeenCalledWith({ id: 'invite-1' });
    expect(info).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('features.groups.toasts.invitationAccepted');
  });

  it('accepts a guest invitation and reports client-side failures', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.trackServerFinalization.mockImplementation((_result, options) => {
      options.onSuccess();
      options.onError(new Error('guest-server'));
    });
    const guestState = renderHook(() =>
      useGroupMembership(
        'group-1',
        projected({
          group: {
            group_type: 'sibling',
            primary_sibling_membership_mode: 'selected_source_groups',
          },
          guestAccesses: [guest('guest-1', 'invited')],
        })
      )
    ).result.current;
    await act(() => guestState.acceptInvitation());
    expect(mocks.acceptGuestInvitation).toHaveBeenCalledWith({ id: 'guest-1' });

    mocks.trackServerFinalization.mockImplementation(() => undefined);
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('accept-client'));
    const failingGuestState = renderHook(() =>
      useGroupMembership(
        'group-1',
        projected({
          group: { group_type: 'sibling', primary_sibling_membership_mode: 'all_members' },
          guestAccesses: [guest('guest-2', 'invited')],
        })
      )
    ).result.current;
    await act(() => failingGuestState.acceptInvitation());
    expect(error).toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('features.groups.toasts.acceptInvitationFailed', {
      description: 'localized:accept-client',
    });
  });
});
