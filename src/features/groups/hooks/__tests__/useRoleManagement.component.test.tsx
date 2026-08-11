/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  wait: vi.fn(async (v: any) => v),
  options: [] as any[],
  actions: {
    createRole: vi.fn((x: any) => x),
    updateRole: vi.fn((x: any) => x),
    deleteRole: vi.fn((x: any) => x),
    assignActionRight: vi.fn((x: any) => x),
    removeActionRight: vi.fn((x: any) => x),
  },
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({ useGroupActions: () => mocks.actions }));
vi.mock('@/zero/mutate-with-server-check', () => ({ waitForClientApply: mocks.wait }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('../../logic/roleFormHelpers', () => ({
  roleEditorFormToMutationWithOptions: (form: any, options: any) => {
    mocks.options.push(options);
    return {
      ...form,
      description: form.description ?? '',
      assignee_kind: 'user',
      assignment_mode: 'assigned',
      visibility: 'public',
      term_start_date: null,
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_rule: null,
      recurrence_interval: null,
      recurrence_days: null,
      recurrence_end_date: null,
      scheduled_revote_date: null,
      default_request_role: false,
      default_invite_role: false,
    };
  },
}));

import { useRoleManagement } from '../useRoleManagement';

const form = (name = 'Role') => ({ name, description: 'Description' }) as any;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.options = [];
  mocks.wait.mockImplementation(async v => v);
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid' as any);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useRoleManagement', () => {
  it('validates names and applies guest-only/default options', async () => {
    let hook = renderHook(() => useRoleManagement('g'));
    await expect(hook.result.current.addRole(form('   '))).resolves.toEqual({ success: false });
    await expect(hook.result.current.updateRole('r', form(''))).resolves.toEqual({
      success: false,
    });
    await expect(hook.result.current.addRole(form())).resolves.toMatchObject({
      success: true,
      roleId: 'uuid',
    });
    expect(mocks.options.at(-1)).toEqual({
      allowGuestRequestDefault: false,
      allowGuestInviteDefault: false,
    });
    hook.unmount();
    hook = renderHook(() => useRoleManagement('g', { guestOnlyMembershipFlow: true }));
    await hook.result.current.updateRole('r', form());
    expect(mocks.options.at(-1)).toEqual({
      allowGuestRequestDefault: true,
      allowGuestInviteDefault: true,
    });
  });

  it('reorders/removes roles and covers add, remove-found, and remove-missing permission branches', async () => {
    const { result } = renderHook(() => useRoleManagement('g'));
    await expect(result.current.reorderRoles([])).resolves.toMatchObject({ success: true });
    await result.current.reorderRoles(['b', 'a']);
    expect(mocks.actions.updateRole.mock.calls[0][0]).toEqual({ id: 'b', sort_order: 0 });
    await expect(result.current.removeRole('r')).resolves.toMatchObject({ success: true });
    await result.current.toggleActionRight('r', 'groups', 'view', true, [
      { id: 'right', resource: 'groups', action: 'view' },
    ]);
    expect(mocks.actions.removeActionRight).toHaveBeenCalledWith({ id: 'right' });
    await expect(
      result.current.toggleActionRight('r', 'groups', 'view', true, [])
    ).resolves.toMatchObject({ success: true });
    await result.current.toggleActionRight('r', 'groups', 'view', false, []);
    expect(mocks.actions.assignActionRight).toHaveBeenCalled();
  });

  it('returns each operation failure and clears loading', async () => {
    const { result } = renderHook(() => useRoleManagement('g'));
    const calls = [
      () => result.current.addRole(form()),
      () => result.current.updateRole('r', form()),
      () => result.current.reorderRoles(['r']),
      () => result.current.removeRole('r'),
      () => result.current.toggleActionRight('r', 'groups', 'view', false, []),
    ];
    for (const call of calls) {
      mocks.wait.mockRejectedValueOnce(new Error('failed'));
      await expect(call()).resolves.toMatchObject({ success: false });
    }
    expect(result.current.isLoading).toBe(false);
  });
});
