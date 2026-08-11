/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventRolesView } from '../EventRolesView';

const mocks = vi.hoisted(() => ({ dialogs: [] as any[] }));
vi.mock('@/features/groups/ui/AddRoleDialog', () => ({
  AddRoleDialog: (props: any) => {
    mocks.dialogs.push(props);
    return (
      <button data-action-id={props['data-action-id']} onClick={props.onSubmit}>
        dialog
      </button>
    );
  },
}));
vi.mock('@/features/groups/ui/RoleDetailsTable', () => ({
  RoleDetailsTable: ({ addRoleButton }: any) => <div>{addRoleButton}</div>,
}));
vi.mock('@/features/groups/ui/RolesPermissionsTable', () => ({
  RolesPermissionsTable: () => <div>permissions</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

afterEach(cleanup);

describe('EventRolesView contracts', () => {
  it('wires independent add and edit role submissions to stable action IDs', () => {
    mocks.dialogs.length = 0;
    const addRole = vi.fn();
    const saveEditedRole = vi.fn();
    const { container } = render(
      <EventRolesView
        {...({
          event: { event_type: 'general_assembly' },
          roles: [],
          accessRoles: [],
          isLoading: false,
          addRoleOpen: true,
          setAddRoleOpen: vi.fn(),
          newRoleForm: {},
          setNewRoleForm: vi.fn(),
          editRoleOpen: true,
          setEditRoleOpen: vi.fn(),
          editRoleForm: {},
          setEditRoleForm: vi.fn(),
          editingRole: { name: 'Chair' },
          addRole,
          openEditRole: vi.fn(),
          saveEditedRole,
          removeRole: vi.fn(),
          togglePermission: vi.fn(),
          reorderRoles: vi.fn(),
          createElectionForRole: vi.fn(),
          getPermissionDisabledReason: vi.fn(),
        } as any)}
      />
    );
    expect(mocks.dialogs).toHaveLength(2);
    (
      container.querySelector('[data-action-id="roles.event-role.add.submit"]') as HTMLElement
    ).click();
    (
      container.querySelector('[data-action-id="roles.event-role.edit.submit"]') as HTMLElement
    ).click();
    expect(addRole).toHaveBeenCalledOnce();
    expect(saveEditedRole).toHaveBeenCalledOnce();

    mocks.dialogs[0].onOpenChange(true);
    mocks.dialogs[0].onOpenChange(false);
    expect(mocks.dialogs[0].eventType).toBe('general_assembly');
  });

  it('uses null event and role fallbacks for an empty editor', () => {
    mocks.dialogs.length = 0;
    render(
      <EventRolesView
        {...({
          event: null,
          roles: [],
          accessRoles: [],
          isLoading: false,
          addRoleOpen: false,
          setAddRoleOpen: vi.fn(),
          newRoleForm: {},
          setNewRoleForm: vi.fn(),
          editRoleOpen: false,
          setEditRoleOpen: vi.fn(),
          editRoleForm: {},
          setEditRoleForm: vi.fn(),
          editingRole: null,
          addRole: vi.fn(),
          openEditRole: vi.fn(),
          saveEditedRole: vi.fn(),
          removeRole: vi.fn(),
          togglePermission: vi.fn(),
          reorderRoles: vi.fn(),
          createElectionForRole: vi.fn(),
          getPermissionDisabledReason: vi.fn(),
        } as any)}
      />
    );
    expect(mocks.dialogs.map(dialog => dialog.eventType)).toEqual([null, null]);
  });
});
