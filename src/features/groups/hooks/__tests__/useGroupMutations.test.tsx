/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: null as any,
  wait: vi.fn(async (value: any) => value),
  actions: {
    inviteMember: vi.fn((args: any) => args),
    inviteGuest: vi.fn((args: any) => args),
    revokeGuestAccess: vi.fn((args: any) => args),
    updateMembership: vi.fn((args: any) => args),
    syncMembershipRoles: vi.fn((args: any) => args),
    acceptGuestInvitation: vi.fn((args: any) => args),
    leaveGroup: vi.fn((args: any) => args),
    createRole: vi.fn((args: any) => args),
    deleteRole: vi.fn((args: any) => args),
    assignActionRight: vi.fn((args: any) => args),
  },
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({ useGroupActions: () => mocks.actions }));
vi.mock('@/zero/mutate-with-server-check', () => ({ waitForClientApply: mocks.wait }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { useGroupMutations } from '../useGroupMutations';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = null;
  mocks.wait.mockImplementation(async value => value);
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid' as any);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
});

describe('useGroupMutations', () => {
  it('validates invitation inputs and covers optional role and sender assignments', async () => {
    const { result } = renderHook(() => useGroupMutations('group'));
    await expect(result.current.inviteUsers([])).resolves.toMatchObject({ success: false });
    await expect(result.current.inviteGuests([], ['role'])).resolves.toMatchObject({
      success: false,
    });
    await expect(result.current.inviteGuests(['user'], [])).resolves.toMatchObject({
      success: false,
    });

    await act(() => result.current.inviteUsers(['u1'], []));
    expect(mocks.actions.inviteMember).toHaveBeenLastCalledWith(
      expect.objectContaining({ initial_role_id: null })
    );
    await act(() => result.current.inviteUsers(['u2'], ['', 'role', 'role'], 'sender'));
    expect(mocks.actions.syncMembershipRoles).toHaveBeenLastCalledWith(
      expect.objectContaining({ role_ids: ['role'], assigned_by_id: 'sender' })
    );
    await act(() => result.current.inviteUsers(['u3'], ['role']));
    expect(mocks.actions.syncMembershipRoles).toHaveBeenLastCalledWith(
      expect.objectContaining({ assigned_by_id: null })
    );

    await act(() => result.current.inviteGuests(['guest'], ['role']));
    expect(mocks.actions.inviteGuest).toHaveBeenLastCalledWith(
      expect.objectContaining({ invited_by_id: null })
    );
    await act(() => result.current.inviteGuests(['guest2'], ['role'], 'sender'));
    expect(mocks.actions.inviteGuest).toHaveBeenLastCalledWith(
      expect.objectContaining({ invited_by_id: 'sender' })
    );
  });

  it('runs every mutation successfully, including role aliases and rights', async () => {
    const { result } = renderHook(() => useGroupMutations('group'));
    await expect(result.current.approveGuestAccess('guest')).resolves.toMatchObject({
      success: true,
    });
    await expect(result.current.revokeGuest('guest')).resolves.toMatchObject({ success: true });
    await expect(result.current.rejectMembership('m', 'u')).resolves.toMatchObject({
      success: true,
    });
    await expect(result.current.removeMember('m', 'u')).resolves.toMatchObject({ success: true });
    await expect(result.current.changeMemberRole('m', '', 'u')).resolves.toMatchObject({
      success: true,
    });
    expect(mocks.actions.syncMembershipRoles).toHaveBeenLastCalledWith(
      expect.objectContaining({ role_ids: [], assigned_by_id: null })
    );
    await expect(
      result.current.changeMemberRole('m', 'role', 'u', 'sender')
    ).resolves.toMatchObject({ success: true });
    await expect(
      result.current.changeMemberRoles('m', ['a', 'b'], 'u', 'sender')
    ).resolves.toMatchObject({ success: true });
    await expect(result.current.createRole('Role', 'Desc', [])).resolves.toMatchObject({
      success: true,
      roleId: 'uuid',
    });
    await expect(
      result.current.createRole(
        'Role 2',
        'Desc',
        [{ resource: 'groups', action: 'view' }],
        undefined,
        undefined,
        undefined,
        3
      )
    ).resolves.toMatchObject({ success: true });
    expect(mocks.actions.assignActionRight).toHaveBeenCalled();
    await expect(result.current.deleteRole('role')).resolves.toMatchObject({ success: true });
    await expect(result.current.promoteToAdmin('m', 'u')).resolves.toMatchObject({ success: true });
    await expect(result.current.demoteToMember('m')).resolves.toMatchObject({ success: true });
  });

  it('logs assembly diagnostics for missing token, failed responses, success, and fetch errors', async () => {
    const hook = renderHook(() => useGroupMutations('group'));
    await act(() => hook.result.current.approveMembership('m1', 'u1'));
    expect(console.warn).toHaveBeenCalled();

    mocks.session = { access_token: 'token' };
    hook.rerender();
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 503 });
    await act(() => hook.result.current.approveMembership('m2', 'u2'));
    expect(console.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 503 })
    );
    await act(() => hook.result.current.approveMembership('m3', 'u3'));
    (fetch as any).mockRejectedValueOnce(new Error('network'));
    await act(() => hook.result.current.approveMembership('m4', 'u4'));
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ membershipId: 'm4' })
    );
  });

  it('returns a failure from every mutation catch path and restores loading', async () => {
    const { result } = renderHook(() => useGroupMutations('group'));
    const cases: [keyof typeof result.current, any[]][] = [
      ['inviteUsers', [['u'], []]],
      ['inviteGuests', [['u'], ['r']]],
      ['approveGuestAccess', ['g']],
      ['revokeGuest', ['g']],
      ['approveMembership', ['m', 'u']],
      ['rejectMembership', ['m', 'u']],
      ['removeMember', ['m', 'u']],
      ['changeMemberRoles', ['m', ['r'], 'u']],
      ['createRole', ['R', 'D', []]],
      ['deleteRole', ['r']],
      ['promoteToAdmin', ['m', 'u']],
      ['demoteToMember', ['m']],
    ];
    for (const [name, args] of cases) {
      mocks.wait.mockRejectedValueOnce(new Error(`${String(name)} failed`));
      let response: any;
      await act(async () => {
        response = await (result.current[name] as any)(...args);
      });
      expect(response.success).toBe(false);
      expect(result.current.isLoading).toBe(false);
    }
    expect(mocks.error).toHaveBeenCalledTimes(cases.length);
  });
});
