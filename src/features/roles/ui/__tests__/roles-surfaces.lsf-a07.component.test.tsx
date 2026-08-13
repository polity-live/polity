/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dialogs: [] as Record<string, any>[],
  detailsProps: undefined as Record<string, any> | undefined,
  permissionsProps: undefined as Record<string, any> | undefined,
  historyProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/groups/ui/AddRoleDialog', () => ({
  AddRoleDialog: (props: Record<string, any>) => {
    mocks.dialogs.push(props);
    return <div>{props['data-action-id']}</div>;
  },
}));
vi.mock('@/features/groups/ui/RoleDetailsTable', () => ({
  RoleDetailsTable: (props: Record<string, any>) => {
    mocks.detailsProps = props;
    return <section>{props.addRoleButton as ReactNode}</section>;
  },
}));
vi.mock('@/features/groups/ui/RolesPermissionsTable', () => ({
  RolesPermissionsTable: (props: Record<string, any>) => {
    mocks.permissionsProps = props;
    return <div>permissions</div>;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  SectionSkeleton: () => <div>role-skeleton</div>,
}));
vi.mock('@/features/shared/ui/participation', () => ({
  HolderHistoryDialog: (props: Record<string, any>) => {
    mocks.historyProps = props;
    return <div>holder-history</div>;
  },
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupRoles: () => ({ roles: [] }),
}));

import { EventRolesView } from '../EventRolesView';
import { RoleHolderHistoryDialog } from '../RoleHolderHistoryDialog';

beforeEach(() => {
  mocks.dialogs = [];
  mocks.detailsProps = undefined;
  mocks.permissionsProps = undefined;
  mocks.historyProps = undefined;
});
afterEach(cleanup);

describe('A07 role surface execution contracts', () => {
  it('executes every EventRolesView adapter callback', () => {
    const setAddRoleOpen = vi.fn();
    const setNewRoleForm = vi.fn(updater =>
      typeof updater === 'function' ? updater({ retained: true }) : updater
    );
    const setEditRoleOpen = vi.fn();
    const setEditRoleForm = vi.fn(updater =>
      typeof updater === 'function' ? updater({ retained: true }) : updater
    );
    const addRole = vi.fn();
    const removeRole = vi.fn();
    const createElectionForRole = vi.fn();
    const togglePermission = vi.fn();
    const reorderRoles = vi.fn();
    const saveEditedRole = vi.fn();

    render(
      <EventRolesView
        event={{ event_type: 'conference' }}
        eventId="event-1"
        roles={[{ id: 'role-1' }]}
        accessRoles={[{ id: 'role-1' }]}
        isLoading={false}
        addRoleOpen
        setAddRoleOpen={setAddRoleOpen}
        newRoleForm={{ name: '' }}
        setNewRoleForm={setNewRoleForm}
        editRoleOpen
        setEditRoleOpen={setEditRoleOpen}
        editRoleForm={{ name: 'Chair' }}
        setEditRoleForm={setEditRoleForm}
        editingRole={{ id: 'role-1', name: 'Chair' }}
        addRole={addRole}
        openEditRole={vi.fn()}
        saveEditedRole={saveEditedRole}
        removeRole={removeRole}
        togglePermission={togglePermission}
        reorderRoles={reorderRoles}
        createElectionForRole={createElectionForRole}
        getPermissionDisabledReason={vi.fn()}
      />
    );

    expect(mocks.dialogs).toHaveLength(2);
    mocks.detailsProps?.onDelete('role-1');
    mocks.detailsProps?.onCreateElection('role-1');
    mocks.dialogs[0].onOpenChange(false);
    mocks.dialogs[0].onFormChange({ name: 'Speaker' });
    mocks.dialogs[0].onSubmit();
    mocks.permissionsProps?.onTogglePermission('role-1', 'event', 'edit', true);
    mocks.permissionsProps?.onReorderRoles(['role-1']);
    mocks.dialogs[1].onOpenChange(false);
    mocks.dialogs[1].onFormChange({ name: 'Treasurer' });
    mocks.dialogs[1].onSubmit();

    expect(removeRole).toHaveBeenCalledWith({ id: 'role-1' });
    expect(createElectionForRole).toHaveBeenCalledWith('role-1');
    expect(setAddRoleOpen).toHaveBeenCalledWith(false);
    expect(setNewRoleForm).toHaveBeenCalled();
    expect(addRole).toHaveBeenCalled();
    expect(togglePermission).toHaveBeenCalledWith('role-1', 'event', 'edit', true);
    expect(reorderRoles).toHaveBeenCalledWith(['role-1']);
    expect(setEditRoleOpen).toHaveBeenCalledWith(false);
    expect(setEditRoleForm).toHaveBeenCalled();
    expect(saveEditedRole).toHaveBeenCalled();
  });

  it('renders the loading state and forwards holder-history props', () => {
    const view = render(<EventRolesView {...({ isLoading: true } as any)} />);
    expect(screen.getByText('role-skeleton')).toBeTruthy();
    view.rerender(
      <RoleHolderHistoryDialog
        open
        onOpenChange={vi.fn()}
        role={{ id: 'role-1', name: 'Chair' } as never}
      />
    );
    expect(mocks.historyProps).toMatchObject({ open: true, role: { id: 'role-1' } });
  });
});
