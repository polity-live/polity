/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventRoleManagement } from '../useEventRoleManagement';

const mocks = vi.hoisted(() => ({
  event: { id: 'event-1', event_type: 'open' } as any,
  roles: [] as any[],
  accessRoles: [] as any[],
  isLoading: false,
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  assignActionRight: vi.fn(),
  removeActionRight: vi.fn(),
  createElection: vi.fn(),
  createAgendaItem: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  success: vi.fn(),
  error: vi.fn(),
  mutationOptions: [] as any[],
}));

vi.mock('@/zero/events/useEventState', () => ({
  useEventRolesData: () => ({ event: mocks.event, roles: mocks.roles, isLoading: mocks.isLoading }),
  useEventAccessRoles: () => ({ roles: mocks.accessRoles }),
}));
vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({
    createRole: mocks.createRole,
    updateRole: mocks.updateRole,
    deleteRole: mocks.deleteRole,
  }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({
    assignActionRight: mocks.assignActionRight,
    removeActionRight: mocks.removeActionRight,
  }),
}));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({ createElection: mocks.createElection }),
}));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ createAgendaItem: mocks.createAgendaItem }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/features/groups/logic/roleFormHelpers', () => ({
  emptyRoleEditorForm: () => ({
    name: '',
    description: '',
    assignee_kind: 'member',
    assignment_mode: 'assigned',
    visibility: 'public',
    default_request_role: false,
    default_invite_role: false,
  }),
  roleToEditorForm: (role: any) => ({
    name: role.name ?? '',
    description: role.description ?? '',
    assignee_kind: role.assignee_kind ?? 'member',
    assignment_mode: role.assignment_mode ?? 'assigned',
    visibility: role.visibility ?? 'public',
    default_request_role: Boolean(role.default_request_role),
    default_invite_role: Boolean(role.default_invite_role),
  }),
  roleEditorFormToMutationWithOptions: (form: any, options: any) => {
    mocks.mutationOptions.push(options);
    return {
      ...form,
      name: form.name.trim(),
      description: form.description.trim() || null,
    };
  },
}));

function role(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-1',
    name: 'Facilitator',
    title: 'Chair',
    description: 'Leads',
    assignee_kind: 'member',
    assignment_mode: 'assigned',
    visibility: 'public',
    action_rights: [],
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.event = { id: 'event-1', event_type: 'open' };
  mocks.roles = [];
  mocks.accessRoles = [];
  mocks.isLoading = false;
  mocks.mutationOptions = [];
  for (const operation of [
    mocks.createRole,
    mocks.updateRole,
    mocks.deleteRole,
    mocks.assignActionRight,
    mocks.removeActionRight,
    mocks.createElection,
    mocks.createAgendaItem,
  ]) {
    operation.mockResolvedValue(undefined);
  }
});

describe('useEventRoleManagement coverage', () => {
  it('merges access rights with role fallbacks and resolves editing-role sources', () => {
    mocks.roles = [
      role({ id: 'access', action_rights: [{ id: 'local' }] }),
      role({ id: 'local', action_rights: [{ id: 'local-right' }] }),
      role({ id: 'empty', action_rights: null }),
    ];
    mocks.accessRoles = [
      role({ id: 'access', action_rights: [{ id: 'access-right' }] }),
      role({ id: 'access-only', action_rights: [] }),
      role({ id: 'access-empty', action_rights: null }),
    ];
    const { result } = renderHook(() => useEventRoleManagement('event-1'));
    expect(result.current.roles.map(item => item.action_rights)).toEqual([
      [{ id: 'access-right' }],
      [{ id: 'local-right' }],
      [],
    ]);
    act(() => result.current.openEditRole(result.current.roles[0]));
    expect(result.current.editingRole?.id).toBe('access');
    act(() => result.current.openEditRole(mocks.accessRoles[1]));
    expect(result.current.editingRole?.id).toBe('access-only');
    act(() => result.current.setEditRoleOpen(false));
  });

  it('validates and adds roles for missing, open, and assembly events', async () => {
    mocks.event = null;
    const missing = renderHook(() => useEventRoleManagement('event-1'));
    await act(async () => missing.result.current.addRole());
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('event_not_found');
    missing.unmount();

    mocks.event = { id: 'event-1', event_type: 'open' };
    const open = renderHook(() => useEventRoleManagement('event-1'));
    await act(async () => open.result.current.addRole());
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('role_name_is_required');
    act(() =>
      open.result.current.setNewRoleForm((previous: any) => ({
        ...previous,
        name: ' Facilitator ',
        description: ' Leads ',
      }))
    );
    act(() => open.result.current.setAddRoleOpen(true));
    await act(async () => open.result.current.addRole());
    expect(mocks.createRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Facilitator',
        description: 'Leads',
        sort_order: 0,
        event_id: 'event-1',
      })
    );
    expect(open.result.current.addRoleOpen).toBe(false);
    expect(mocks.mutationOptions.at(-1)).toMatchObject({
      allowGuestRequestDefault: false,
      allowGuestInviteDefault: false,
      includeRecurringFields: false,
    });
    open.unmount();

    for (const eventType of ['general_assembly', 'delegate_assembly']) {
      mocks.event = { id: 'event-1', event_type: eventType };
      const assembly = renderHook(() => useEventRoleManagement('event-1'));
      act(() =>
        assembly.result.current.setNewRoleForm((previous: any) => ({ ...previous, name: 'Guest' }))
      );
      await act(async () => assembly.result.current.addRole());
      expect(mocks.mutationOptions.at(-1)).toMatchObject({
        allowGuestRequestDefault: true,
        allowGuestInviteDefault: true,
      });
      assembly.unmount();
    }
  });

  it('guards, validates, and saves edited roles', async () => {
    mocks.roles = [role()];
    const { result } = renderHook(() => useEventRoleManagement('event-1'));
    await act(async () => result.current.saveEditedRole());
    expect(mocks.updateRole).not.toHaveBeenCalled();

    act(() => result.current.openEditRole(result.current.roles[0]));
    act(() => result.current.setEditRoleForm((previous: any) => ({ ...previous, name: '   ' })));
    await act(async () => result.current.saveEditedRole());
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('role_name_is_required');

    act(() =>
      result.current.setEditRoleForm((previous: any) => ({
        ...previous,
        name: ' Updated ',
        description: '',
      }))
    );
    await act(async () => result.current.saveEditedRole());
    expect(mocks.updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'role-1', name: 'Updated', description: null })
    );
    expect(result.current.editingRole).toBeNull();
    expect(result.current.editRoleOpen).toBe(false);
  });

  it('assigns, removes, and skips permissions and reorders roles', async () => {
    mocks.accessRoles = [
      role({
        id: 'role-1',
        action_rights: [{ id: 'right-1', resource: 'events', action: 'update' }],
      }),
      role({ id: 'no-right-id', action_rights: [{ resource: 'events', action: 'update' }] }),
    ];
    const { result } = renderHook(() => useEventRoleManagement('event-1'));
    await act(async () => result.current.togglePermission('role-1', 'events', 'update', true));
    expect(mocks.removeActionRight).toHaveBeenCalledWith({ id: 'right-1' });
    await act(async () => result.current.togglePermission('no-right-id', 'events', 'update', true));
    await act(async () => result.current.togglePermission('missing', 'events', 'update', true));
    expect(mocks.removeActionRight).toHaveBeenCalledTimes(1);
    await act(async () => result.current.togglePermission('role-1', 'events', 'delete', false));
    expect(mocks.assignActionRight).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'role-1', event_id: 'event-1' })
    );

    await act(async () => result.current.reorderRoles([]));
    await act(async () => result.current.reorderRoles(['role-2', 'role-1']));
    expect(mocks.updateRole).toHaveBeenCalledWith({ id: 'role-2', sort_order: 0 });
    expect(mocks.updateRole).toHaveBeenCalledWith({ id: 'role-1', sort_order: 1 });
    expect(mocks.success).toHaveBeenCalledTimes(2);
  });

  it('creates role elections with title, name, and translated fallbacks', async () => {
    mocks.roles = [
      role({ id: 'title', title: 'Chair', name: 'Ignored' }),
      role({ id: 'name', title: '', name: 'Secretary' }),
      role({ id: 'fallback', title: '', name: '' }),
    ];
    const { result } = renderHook(() => useEventRoleManagement('event-1'));
    await act(async () => result.current.createElectionForRole('missing'));
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('role_not_found');
    for (const id of ['title', 'name', 'fallback']) {
      await act(async () => result.current.createElectionForRole(id));
    }
    expect(mocks.createAgendaItem).toHaveBeenCalledTimes(3);
    expect(mocks.createElection).toHaveBeenCalledTimes(3);
    expect(mocks.createElection.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ role_id: 'fallback', agenda_item_id: expect.any(String) })
    );
  });

  it('removes roles and explains only guest event voting restrictions', async () => {
    const { result } = renderHook(() => useEventRoleManagement('event-1'));
    await act(async () => result.current.removeRole({ id: 'role-1' } as any));
    expect(mocks.deleteRole).toHaveBeenCalledWith({ id: 'role-1' });
    const guest = role({ assignee_kind: 'guest' });
    expect(result.current.getPermissionDisabledReason(guest, 'events', 'active_voting')).toContain(
      'guestVotingRightsDisabled'
    );
    expect(result.current.getPermissionDisabledReason(guest, 'events', 'passive_voting')).toContain(
      'guestVotingRightsDisabled'
    );
    expect(result.current.getPermissionDisabledReason(guest, 'events', 'update')).toBeNull();
    expect(
      result.current.getPermissionDisabledReason(guest, 'agendas', 'active_voting')
    ).toBeNull();
    expect(
      result.current.getPermissionDisabledReason(
        role({ assignee_kind: 'member' }),
        'events',
        'active_voting'
      )
    ).toBeNull();
  });
});
