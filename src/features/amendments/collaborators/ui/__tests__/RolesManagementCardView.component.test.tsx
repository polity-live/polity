/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RolesManagementCardView } from '../RolesManagementCardView';

const role = {
  id: 'role-1',
  name: 'Collaborator',
  scope: 'amendment',
  assignment_mode: 'assigned',
  action_rights: [],
};

function renderView() {
  render(
    <RolesManagementCardView
      amendmentId="amendment-1"
      roles={[role]}
      onCreateRole={vi.fn()}
      onDeleteRole={vi.fn()}
      onToggleActionRight={vi.fn()}
      newRoleName=""
      setNewRoleName={vi.fn()}
      newRoleDescription=""
      setNewRoleDescription={vi.fn()}
      addRoleDialogOpen={false}
      setAddRoleDialogOpen={vi.fn()}
      handleAddRole={vi.fn()}
      handleRemoveRole={vi.fn()}
      handleToggleActionRight={vi.fn()}
    />
  );
}

describe('RolesManagementCardView', () => {
  afterEach(cleanup);

  it('shows only amendment-scoped action rights', () => {
    renderView();

    expect(screen.getByText('Manage Amendment', { selector: 'td' })).toBeTruthy();
    expect(screen.getByText('View Amendment', { selector: 'td' })).toBeTruthy();
    expect(screen.queryByText(/Manage Payments/i)).toBeNull();
    expect(screen.queryByText(/Manage Events/i)).toBeNull();
    expect(screen.queryByText(/Manage Blogs/i)).toBeNull();
    expect(screen.queryByText(/Manage Members/i)).toBeNull();
  });

  it('opens, cancels, creates, and removes roles through stable actions', () => {
    const setAddRoleDialogOpen = vi.fn();
    const handleAddRole = vi.fn();
    const handleRemoveRole = vi.fn();
    const { container } = render(
      <RolesManagementCardView
        amendmentId="amendment-1"
        roles={[role]}
        onCreateRole={vi.fn()}
        onDeleteRole={vi.fn()}
        onToggleActionRight={vi.fn()}
        newRoleName="Editor"
        setNewRoleName={vi.fn()}
        newRoleDescription="Can edit"
        setNewRoleDescription={vi.fn()}
        addRoleDialogOpen
        setAddRoleDialogOpen={setAddRoleDialogOpen}
        handleAddRole={handleAddRole}
        handleRemoveRole={handleRemoveRole}
        handleToggleActionRight={vi.fn()}
      />
    );

    expect(
      container.querySelector('[data-action-id="amendments.roles.open.create-dialog"]')
    ).toBeTruthy();
    fireEvent.click(document.querySelector('[data-action-id="amendments.roles.cancel.create"]')!);
    fireEvent.click(document.querySelector('[data-action-id="amendments.roles.submit.create"]')!);
    fireEvent.click(container.querySelector('[data-action-id="amendments.roles.remove.current"]')!);
    expect(setAddRoleDialogOpen).toHaveBeenCalledWith(false);
    expect(handleAddRole).toHaveBeenCalledOnce();
    expect(handleRemoveRole).toHaveBeenCalledWith('role-1');
  });

  it('renders unnamed external roles without descriptions, rights, or remove actions', () => {
    const { container } = render(
      <RolesManagementCardView
        amendmentId="amendment-1"
        roles={
          [
            {
              ...role,
              id: 'external',
              name: null,
              description: null,
              action_rights: null,
              scope: 'group',
            },
          ] as any
        }
        onCreateRole={vi.fn()}
        onDeleteRole={vi.fn()}
        onToggleActionRight={vi.fn()}
        newRoleName=""
        setNewRoleName={vi.fn()}
        newRoleDescription=""
        setNewRoleDescription={vi.fn()}
        addRoleDialogOpen={false}
        setAddRoleDialogOpen={vi.fn()}
        handleAddRole={vi.fn()}
        handleRemoveRole={vi.fn()}
        handleToggleActionRight={vi.fn()}
      />
    );
    expect(screen.getAllByText('Role').length).toBeGreaterThan(1);
    expect(screen.getByText('No description')).toBeTruthy();
    expect(
      container.querySelector('[data-action-id="amendments.roles.remove.current"]')
    ).toBeNull();
  });
});
