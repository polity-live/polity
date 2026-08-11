/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChangeRoleDialogView } from '../ChangeRoleDialogView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

afterEach(cleanup);

describe('ChangeRoleDialogView actions', () => {
  it('dispatches role selection, rights, cancel, and confirmation through stable actions', () => {
    const toggleRoleSelection = vi.fn();
    const setRightsOpen = vi.fn();
    const handleOpenChange = vi.fn();
    const handleConfirm = vi.fn();
    render(
      <ChangeRoleDialogView
        isOpen
        onOpenChange={vi.fn()}
        memberName="Ada"
        currentRoles={[]}
        roles={[]}
        onConfirm={vi.fn()}
        title="Change roles"
        emptyRolesLabel="No roles"
        noSelectedRolesLabel="No selected roles"
        emptyRightsLabel="No rights"
        cancelLabel="Cancel"
        submitLabel="Confirm"
        selectedRoleIds={[]}
        setSelectedRoleIds={vi.fn()}
        rightsOpen={false}
        setRightsOpen={setRightsOpen}
        sortedRoles={[{ id: 'role-1', name: 'Chair', description: 'Leads' }]}
        selectedRoles={[]}
        rightsSummary={[]}
        currentRoleNames=""
        selectedRoleNames=""
        rightsColumns={[]}
        handleConfirm={handleConfirm}
        handleOpenChange={handleOpenChange}
        toggleRoleSelection={toggleRoleSelection}
      />
    );

    const ids = [
      'groups.roles.change.toggle-role',
      'groups.roles.change.toggle-rights',
      'groups.roles.change.cancel',
      'groups.roles.change.confirm',
    ];
    for (const actionId of ids) {
      const action = document.querySelector<HTMLElement>(`[data-action-id="${actionId}"]`)!;
      action.focus();
      expect(document.activeElement).toBe(action);
      fireEvent.click(action);
    }

    expect(toggleRoleSelection).toHaveBeenCalledWith('role-1', true);
    expect(setRightsOpen).toHaveBeenCalledWith(true);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders empty and populated role/right variants', () => {
    const common = {
      isOpen: true,
      onOpenChange: vi.fn(),
      memberName: 'Ada',
      currentRoles: [],
      roles: [],
      onConfirm: vi.fn(),
      title: 'Change',
      emptyRolesLabel: 'No roles',
      noSelectedRolesLabel: 'Nothing',
      emptyRightsLabel: 'No rights',
      cancelLabel: 'Cancel',
      submitLabel: 'Save',
      selectedRoleIds: ['one'],
      setSelectedRoleIds: vi.fn(),
      rightsOpen: true,
      setRightsOpen: vi.fn(),
      rightsSummary: [{ key: 'right' }],
      rightsColumns: [],
      handleConfirm: vi.fn(),
      handleOpenChange: vi.fn(),
      toggleRoleSelection: vi.fn(),
    };
    const view = render(
      <ChangeRoleDialogView
        {...common}
        sortedRoles={[]}
        selectedRoles={[]}
        currentRoleNames="Member"
        selectedRoleNames=""
      />
    );
    expect(document.body.textContent).toContain('No roles');
    view.rerender(
      <ChangeRoleDialogView
        {...common}
        sortedRoles={[
          { id: 'one', name: 'One' },
          { id: 'two', name: 'Two', description: '' },
        ]}
        selectedRoles={[
          { id: 'one', name: '' },
          { id: 'two', name: 'Two' },
        ]}
        currentRoleNames="Member"
        selectedRoleNames="Two"
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="groups.roles.change.toggle-role"]')!);
    expect(common.toggleRoleSelection).toHaveBeenCalledWith('one', false);
  });
});
