/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  it('shows only amendment-scoped action rights', () => {
    renderView();

    expect(screen.getByText('Manage Amendment', { selector: 'td' })).toBeTruthy();
    expect(screen.getByText('View Amendment', { selector: 'td' })).toBeTruthy();
    expect(screen.queryByText(/Manage Payments/i)).toBeNull();
    expect(screen.queryByText(/Manage Events/i)).toBeNull();
    expect(screen.queryByText(/Manage Blogs/i)).toBeNull();
    expect(screen.queryByText(/Manage Members/i)).toBeNull();
  });
});
