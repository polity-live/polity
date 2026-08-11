/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoleDetailsTable } from '../RoleDetailsTable';

const translations: Record<string, string> = {
  'generated.inline.0728_create_election_678ef240': 'Create election',
  'generated.inline.0726_view_history_8bc3b1ed': 'View history',
  'generated.inline.0727_assign_24449284': 'Assign',
  'generated.inline.0729_edit_5301648d': 'Edit',
  'generated.inline.0537_delete_f6fdbe48': 'Delete',
  'generated.inline.0091_role_c3f104d1': 'Role',
  'generated.inline.0718_visibility_7d9ff4f0': 'Visibility',
  'generated.inline.0621_assignment_e55df441': 'Assignment',
  'generated.inline.0719_defaults_428819bf': 'Defaults',
  'generated.inline.0721_manage_bf58d17e': 'Manage',
  'generated.inline.0109_elected_27d35d1d': 'Elected',
  'generated.inline.0725_no_default_0cd213a3': 'No default',
  'generated.inline.0717_role_details_99faf6f7': 'Role details',
  'generated.inline.0107_review_role_visibility_assignment_mode_defaul_332a8a56':
    'Review group roles',
  'generated.inline.0106_review_event_role_visibility_assignment_mode__9d3e73c1':
    'Review event roles',
  'generated.inline.0016_rights_1407cb23': 'Rights',
  'components.membershipTables.rights': 'Rights',
  'generated.inline.0719_term_revote_17ae9b60': 'Term',
};

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, paramsOrFallback?: string | Record<string, unknown>) =>
    (typeof paramsOrFallback === 'string' ? paramsOrFallback : undefined) ??
    translations[key] ??
    key,
}));

afterEach(() => {
  cleanup();
});

describe('RoleDetailsTable', () => {
  const electedRole = {
    id: 'chairperson',
    title: 'Chairperson',
    description: null,
    visibility: 'public',
    assignment_mode: 'elected',
    action_rights: [],
    elections: [],
  };

  it('opens the role-renewal assignment flow for elected group roles', () => {
    const onCreateElection = vi.fn();
    const onOpenElectionAssignment = vi.fn();

    render(
      <RoleDetailsTable
        roles={[electedRole]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateElection={onCreateElection}
        onOpenElectionAssignment={onOpenElectionAssignment}
      />
    );

    const election = screen.getByRole('button', { name: 'Create election' });
    expect(election.getAttribute('data-action-id')).toBe('groups.roles.create.election');
    fireEvent.click(election);

    expect(onOpenElectionAssignment).toHaveBeenCalledWith('chairperson');
    expect(onCreateElection).not.toHaveBeenCalled();
  });

  it('keeps the direct election action for elected event roles', () => {
    const onCreateElection = vi.fn();
    const onOpenElectionAssignment = vi.fn();

    render(
      <RoleDetailsTable
        roles={[electedRole]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateElection={onCreateElection}
        onOpenElectionAssignment={onOpenElectionAssignment}
        scope="event"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create election' }));

    expect(onCreateElection).toHaveBeenCalledWith('chairperson');
    expect(onOpenElectionAssignment).not.toHaveBeenCalled();
  });

  it('dispatches assigned-role management through stable actions', () => {
    const assignedRole = { ...electedRole, assignment_mode: 'assigned' };
    const onViewHistory = vi.fn();
    const onAssignHolder = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { container, rerender } = render(
      <RoleDetailsTable
        roles={[assignedRole]}
        onViewHistory={onViewHistory}
        onAssignHolder={onAssignHolder}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    for (const actionId of [
      'groups.roles.view.history',
      'groups.roles.assign.holder',
      'groups.roles.edit.definition',
      'groups.roles.delete.definition',
    ]) {
      const action = container.querySelector<HTMLElement>(`[data-action-id="${actionId}"]`)!;
      action.focus();
      expect(document.activeElement).toBe(action);
      fireEvent.click(action);
    }

    expect(onViewHistory).toHaveBeenCalledWith(assignedRole);
    expect(onAssignHolder).toHaveBeenCalledWith(assignedRole);
    expect(onEdit).toHaveBeenCalledWith(assignedRole);
    expect(onDelete).toHaveBeenCalledWith('chairperson');

    rerender(
      <RoleDetailsTable
        roles={[{ ...assignedRole, currentHolder: { source: 'membership' } }]}
        onViewHistory={onViewHistory}
        onAssignHolder={onAssignHolder}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    expect(
      container
        .querySelector('[data-action-id="groups.roles.assign.holder"]')
        ?.hasAttribute('disabled')
    ).toBe(true);
  });
});
