/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OfflineRosterCard } from '../OfflineRosterCard';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

function expectIconOnlyButton(label: string) {
  const button = screen.getByRole('button', { name: label });

  expect(button.textContent).toBe('');

  return button;
}

describe('OfflineRosterCard', () => {
  it('renders the membership variant with a user column and role tags', () => {
    render(
      <OfflineRosterCard
        title="All users"
        description="Roster"
        rows={[
          {
            id: 'active-1',
            kind: 'active',
            user: {
              id: 'user-1',
              first_name: 'Ada',
              last_name: 'Lovelace',
              handle: 'ada',
            },
            firstName: 'Ada',
            lastName: 'Lovelace',
            isActiveUser: true,
            roles: [{ id: 'role-1', name: 'Chair' }],
            connectedUser: null,
            reasonNotSignedUp: null,
          },
        ]}
        tableVariant="membership"
        manageDialogTitle="Manage"
        manageDialogDescription="Manage roster"
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
      />
    );

    expect(screen.getByText('User')).toBeTruthy();
    expect(screen.getByText('Role')).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('@ada')).toBeTruthy();
    expect(screen.getByText('Chair')).toBeTruthy();
    expect(screen.queryByText('Firstname')).toBeNull();
  });

  it('shows the part group name in provenance columns', () => {
    render(
      <OfflineRosterCard
        title="All users"
        description="Roster"
        rows={[
          {
            id: 'active-1',
            kind: 'active',
            user: {
              id: 'user-1',
              first_name: 'Ada',
              last_name: 'Lovelace',
              handle: 'ada',
            },
            firstName: 'Ada',
            lastName: 'Lovelace',
            isActiveUser: true,
            roles: [{ id: 'role-1', name: 'Chair' }],
            connectedUser: null,
            reasonNotSignedUp: null,
            partGroup: { id: 'part-group-id', name: 'Part Group Name' },
            baseGroup: { id: 'base-group-id', name: 'Base Group Name' },
          },
        ]}
        tableVariant="membership"
        showProvenanceColumns
        manageDialogTitle="Manage"
        manageDialogDescription="Manage roster"
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
      />
    );

    expect(screen.getByText('Part Group Name')).toBeTruthy();
    expect(screen.getByText('Base Group Name')).toBeTruthy();
  });

  it('renders row actions as accessible icon-only buttons', () => {
    render(
      <OfflineRosterCard
        title="All users"
        description="Roster"
        rows={[
          {
            id: 'offline-1',
            kind: 'offline',
            firstName: 'Fabian',
            lastName: 'Hassebrock',
            isActiveUser: false,
            roles: [{ id: 'role-1', name: 'Member' }],
            connectedUser: null,
            reasonNotSignedUp: 'No account',
            canViewRights: true,
            canManageRoles: true,
            canConfirmParticipation: true,
            canWithdrawParticipation: true,
            canToggleChannel: true,
            canConnect: true,
            canEdit: true,
            canDelete: true,
            attendanceStatus: 'listed',
            participationChannel: 'offline',
          },
        ]}
        tableVariant="membership"
        manageDialogTitle="Manage"
        manageDialogDescription="Manage roster"
        connectedUserCandidates={[{ id: 'user-2', first_name: 'Grace', last_name: 'Hopper' }]}
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
        onSetParticipationStatus={vi.fn()}
        onToggleChannel={vi.fn()}
        onConnect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expectIconOnlyButton('Rights');
    expectIconOnlyButton('Manage Roles');
    expectIconOnlyButton('Confirm');
    expectIconOnlyButton('Withdraw confirmation');
    expectIconOnlyButton('Set Online');
    expectIconOnlyButton('Connect');
    expectIconOnlyButton('Edit');
    expectIconOnlyButton('Delete');
    expect(screen.queryByText('Rights')).toBeNull();
    expect(screen.queryByText('Manage Roles')).toBeNull();
    expect(screen.queryByText('Connect')).toBeNull();
  });
});
