/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const leaveGroupMock = vi.fn();
const useGroupConflictPreflightMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ leaveGroup: leaveGroupMock }),
}));

vi.mock('@/features/groups/hooks/useGroupConflictPreflight', () => ({
  useGroupConflictPreflight: (...args: unknown[]) => useGroupConflictPreflightMock(...args),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useHierarchyConflictDialogController } from '../useHierarchyConflictDialogController';

function relationship(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rel-1',
    connection_id: 'connection-1',
    grant_id: 'grant-1',
    with_right: 'informationRight',
    group_id: 'group-b',
    related_group_id: 'group-a',
    status: 'active',
    initiator_group_id: 'group-a',
    connection_type: 'hierarchy',
    parent_group_id: 'group-a',
    child_group_id: 'group-b',
    membership_mode: 'all_members',
    member_source_group_id: 'group-b',
    member_target_group_id: 'group-a',
    required_source_role_id: null,
    eligible_origin_group_ids: [],
    ...overrides,
  };
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    displayName: 'User One',
    membershipIdInCurrentGroup: 'membership-1',
    ...overrides,
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    groupName: 'Current',
    otherGroupName: 'Partner',
    relationships: [relationship()],
    affectedUsers: [],
    partnerUsers: [],
    canAccept: true,
    onAccept: vi.fn().mockResolvedValue(undefined),
    onReject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useHierarchyConflictDialogController', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    leaveGroupMock.mockReset();
    useGroupConflictPreflightMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    useGroupConflictPreflightMock.mockReturnValue({
      response: { conflicts: [] },
      blocking: false,
      isLoading: false,
    });
  });

  it('builds structured preflight input and derives conflict summaries', () => {
    const relationships = [
      relationship(),
      relationship({
        id: 'rel-2',
        grant_id: 'grant-2',
        with_right: 'amendmentRight',
        status: 'rejected',
        initiator_group_id: null,
      }),
      relationship({ id: 'rel-without-grant', grant_id: null }),
      relationship({ id: 'rel-without-right', with_right: null }),
    ];
    useGroupConflictPreflightMock.mockReturnValue({
      response: { conflicts: [{ id: 'conflict' }] },
      blocking: true,
      isLoading: false,
    });
    const { result } = renderHook(() =>
      useHierarchyConflictDialogController(
        props({
          relationships,
          affectedUsers: [user()],
          partnerUsers: [user({ userId: 'user-2' })],
        }) as never
      )
    );

    expect(result.current.relationshipPreflightInput).toMatchObject({
      kind: 'group_connection_upsert',
      connection_id: 'connection-1',
      group_a_id: 'group-a',
      group_b_id: 'group-b',
      grants: [
        expect.objectContaining({ id: 'grant-1', status: 'active' }),
        expect.objectContaining({ id: 'grant-2', status: 'rejected', initiator_group_id: null }),
      ],
      membership_rule: expect.objectContaining({ membership_mode: 'all_members' }),
    });
    expect(useGroupConflictPreflightMock).toHaveBeenCalledWith(
      result.current.relationshipPreflightInput,
      { enabled: true }
    );
    expect(result.current.rightsLabel).toBe('informationRight, amendmentRight, informationRight');
    expect(result.current.hasStructuredConflicts).toBe(true);
    expect(result.current.hasFallbackConflictUsers).toBe(true);
  });

  it('returns no preflight for closed, empty, or grantless relationship sets', () => {
    const { result, rerender } = renderHook(
      ({ dialogProps }) => useHierarchyConflictDialogController(dialogProps as never),
      { initialProps: { dialogProps: props({ open: false }) } }
    );
    expect(result.current.relationshipPreflightInput).toBeNull();
    expect(result.current.hasFallbackConflictUsers).toBe(false);

    rerender({ dialogProps: props({ relationships: [] }) });
    expect(result.current.relationshipPreflightInput).toBeNull();
    rerender({
      dialogProps: props({
        relationships: [relationship({ grant_id: null, with_right: null })],
        partnerUsers: [user()],
      }),
    });
    expect(result.current.relationshipPreflightInput).toBeNull();
    expect(result.current.hasFallbackConflictUsers).toBe(true);

    rerender({
      dialogProps: props({
        relationships: [relationship({ membership_mode: 'none' })],
      }),
    });
    expect(
      (result.current.relationshipPreflightInput as { membership_rule?: unknown } | null)
        ?.membership_rule
    ).toBeNull();
    rerender({
      dialogProps: props({
        relationships: [relationship({ member_source_group_id: null })],
      }),
    });
    expect(
      (result.current.relationshipPreflightInput as { membership_rule?: unknown } | null)
        ?.membership_rule
    ).toBeNull();
    rerender({
      dialogProps: props({
        relationships: [relationship({ member_target_group_id: null })],
      }),
    });
    expect(
      (result.current.relationshipPreflightInput as { membership_rule?: unknown } | null)
        ?.membership_rule
    ).toBeNull();
  });

  it('messages users and handles removal success, missing memberships, and failure', async () => {
    const onOpenChange = vi.fn();
    leaveGroupMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useHierarchyConflictDialogController(props({ onOpenChange }) as never)
    );

    act(() => result.current.handleMessage(user() as never));
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/messages',
      search: { userId: 'user-1', name: 'User One' },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    await act(async () =>
      result.current.handleRemoveFromGroup(user({ membershipIdInCurrentGroup: null }) as never)
    );
    expect(leaveGroupMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith('common.network.conflictUserNotInGroup');

    await act(async () => result.current.handleRemoveFromGroup(user() as never));
    expect(leaveGroupMock).toHaveBeenCalledWith({ id: 'membership-1' });
    expect(toastSuccessMock).toHaveBeenCalledWith('common.network.conflictUserRemoved');
    await act(async () =>
      result.current.handleRemoveFromGroup(
        user({ userId: 'user-2', membershipIdInCurrentGroup: 'membership-2' }) as never
      )
    );
    expect(toastErrorMock).toHaveBeenCalledWith('common.network.conflictUserRemoveFailed');
    expect(result.current.removingUserId).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('guards acceptance preflight and closes after successful accept or reject', async () => {
    const onOpenChange = vi.fn();
    const onAccept = vi.fn().mockResolvedValue(undefined);
    const onReject = vi.fn().mockResolvedValue(undefined);
    let preflight = { response: { conflicts: [] }, blocking: false, isLoading: false };
    useGroupConflictPreflightMock.mockImplementation(() => preflight);
    const { result, rerender } = renderHook(
      ({ dialogProps }) => useHierarchyConflictDialogController(dialogProps as never),
      {
        initialProps: {
          dialogProps: props({ canAccept: false, onOpenChange, onAccept, onReject }),
        },
      }
    );

    await act(async () => result.current.handleAccept());
    preflight = { ...preflight, blocking: true };
    rerender({ dialogProps: props({ canAccept: true, onOpenChange, onAccept, onReject }) });
    await act(async () => result.current.handleAccept());
    preflight = { ...preflight, blocking: false, isLoading: true };
    rerender({ dialogProps: props({ canAccept: true, onOpenChange, onAccept, onReject }) });
    await act(async () => result.current.handleAccept());
    expect(onAccept).not.toHaveBeenCalled();

    preflight = { ...preflight, isLoading: false };
    rerender({ dialogProps: props({ canAccept: true, onOpenChange, onAccept, onReject }) });
    await act(async () => result.current.handleAccept());
    await act(async () => result.current.handleReject());
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('resets submission state when accept and reject callbacks fail', async () => {
    const { result } = renderHook(() =>
      useHierarchyConflictDialogController(
        props({
          onAccept: vi.fn().mockRejectedValue(new Error('accept failed')),
          onReject: vi.fn().mockRejectedValue(new Error('reject failed')),
        }) as never
      )
    );
    await expect(result.current.handleAccept()).rejects.toThrow('accept failed');
    expect(result.current.isSubmitting).toBe(false);
    await expect(result.current.handleReject()).rejects.toThrow('reject failed');
    expect(result.current.isSubmitting).toBe(false);
  });
});
