/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventRoles } from '../useEventRoles';

const mocks = vi.hoisted(() => ({
  rolesData: {
    event: { id: 'event-1', title: 'Assembly' },
    roles: [] as any[],
    isLoading: false,
  },
  accessRoles: [] as any[],
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  assignActionRight: vi.fn(),
  removeActionRight: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({
    createRole: mocks.createRole,
    updateRole: mocks.updateRole,
    deleteRole: mocks.deleteRole,
  }),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useEventRolesData: () => mocks.rolesData,
  useEventAccessRoles: () => ({ roles: mocks.accessRoles }),
}));

vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({
    assignActionRight: mocks.assignActionRight,
    removeActionRight: mocks.removeActionRight,
  }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: mocks.toast }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rolesData.roles = [];
  mocks.rolesData.isLoading = false;
  mocks.accessRoles = [];
  mocks.createRole.mockResolvedValue(undefined);
  mocks.updateRole.mockResolvedValue(undefined);
  mocks.deleteRole.mockResolvedValue(undefined);
  mocks.assignActionRight.mockResolvedValue(undefined);
  mocks.removeActionRight.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useEventRoles', () => {
  it('validates, resets, and creates an event role with deterministic scope and ordering', async () => {
    mocks.rolesData.roles = [{ id: 'existing-role' }];
    const { result } = renderHook(() => useEventRoles('event-1'));

    await act(async () => result.current.actions.add());
    expect(mocks.toast.error).toHaveBeenCalledWith(
      'generated.inline.1023_role_title_is_required_887ec72a'
    );

    act(() => {
      result.current.form.setTitle(' Facilitator ');
      result.current.form.setDescription(' Moderates ');
      result.current.form.setCapacity('0');
    });
    await act(async () => result.current.actions.add());
    expect(mocks.toast.error).toHaveBeenLastCalledWith(
      'generated.inline.1024_capacity_must_be_at_least_1_5849bcc5'
    );

    act(() => {
      result.current.dialogs.add.setOpen(true);
      result.current.form.setCapacity('3');
      result.current.form.setCreateElection(true);
    });
    await act(async () => result.current.actions.add());

    expect(mocks.createRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Facilitator',
        description: 'Moderates',
        event_id: 'event-1',
        assignment_mode: 'assigned',
        visibility: 'public',
        is_recurring: false,
        sort_order: 1,
      })
    );
    expect(result.current.dialogs.add.open).toBe(false);
    expect(result.current.form).toMatchObject({
      title: '',
      description: '',
      capacity: '1',
      createElection: false,
    });
  });

  it('opens, validates, updates, and deletes roles while reporting optimistic and failed mutations', async () => {
    const role: any = { id: 'role-1', title: 'Chair', description: 'Leads' };
    mocks.rolesData.roles = [role];
    const { result } = renderHook(() => useEventRoles('event-1'));

    act(() => result.current.actions.openEdit(role));
    expect(result.current.dialogs.edit.open).toBe(true);
    expect(result.current.form).toMatchObject({ title: 'Chair', description: 'Leads' });

    act(() => result.current.form.setCapacity('invalid'));
    await act(async () => result.current.actions.edit());
    expect(mocks.updateRole).not.toHaveBeenCalled();

    act(() => {
      result.current.form.setCapacity('2');
      result.current.form.setTitle(' Chairperson ');
    });
    await act(async () => result.current.actions.edit());
    expect(mocks.updateRole).toHaveBeenCalledWith({
      id: 'role-1',
      name: 'Chairperson',
      description: 'Leads',
    });
    expect(mocks.toast.success).toHaveBeenCalledWith(
      'generated.inline.0588_role_updated_successfully_87ea8999'
    );

    await act(async () => result.current.actions.delete('role-1'));
    expect(mocks.deleteRole).toHaveBeenCalledWith({ id: 'role-1' });

    mocks.deleteRole.mockRejectedValueOnce(new Error('delete failed'));
    await act(async () => result.current.actions.delete('role-1'));
    expect(mocks.toast.error).toHaveBeenLastCalledWith(
      'generated.inline.0238_failed_to_delete_role_please_try_again_fe4624de'
    );
  });

  it('adds and removes exact permissions and serially persists role ordering with failure feedback', async () => {
    mocks.accessRoles = [
      {
        id: 'role-1',
        action_rights: [{ id: 'right-1', resource: 'event', action: 'manage' }],
      },
    ];
    const { result } = renderHook(() => useEventRoles('event-1'));

    await act(async () =>
      result.current.actions.togglePermission('role-1', 'event', 'manage', true)
    );
    expect(mocks.removeActionRight).toHaveBeenCalledWith({ id: 'right-1' });

    await act(async () =>
      result.current.actions.togglePermission('role-1', 'agenda', 'edit', false)
    );
    expect(mocks.assignActionRight).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'agenda',
        action: 'edit',
        role_id: 'role-1',
        event_id: 'event-1',
        group_id: null,
      })
    );

    await act(async () => result.current.actions.reorderRoles(['role-b', 'role-a']));
    expect(mocks.updateRole.mock.calls.slice(-2)).toEqual([
      [{ id: 'role-b', sort_order: 0 }],
      [{ id: 'role-a', sort_order: 1 }],
    ]);
    expect(mocks.toast.success).toHaveBeenCalledWith(
      'generated.inline.0475_role_order_updated_4d399d91'
    );

    mocks.assignActionRight.mockRejectedValueOnce(new Error('permission failed'));
    await act(async () =>
      result.current.actions.togglePermission('role-1', 'agenda', 'edit', false)
    );
    expect(mocks.toast.error).toHaveBeenLastCalledWith(
      'generated.inline.0465_failed_to_update_permission_please_try_again_c9f90034'
    );
  });

  it('handles missing edit state, absent permission records, and empty role copy', async () => {
    mocks.accessRoles = [{ id: 'role-1', action_rights: [] }];
    const { result } = renderHook(() => useEventRoles('event-1'));
    await act(async () => result.current.actions.edit());
    expect(mocks.toast.error).toHaveBeenCalled();
    await act(async () =>
      result.current.actions.togglePermission('role-1', 'event', 'manage', true)
    );
    expect(mocks.removeActionRight).not.toHaveBeenCalled();
    act(() =>
      result.current.actions.openEdit({ id: 'empty-role', title: null, description: null } as any)
    );
    expect(result.current.form.title).toBe('');
    expect(result.current.form.description).toBe('');
  });
});
