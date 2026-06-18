/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function renderManageableRoster(overrides: Partial<Parameters<typeof OfflineRosterCard>[0]> = {}) {
  return render(
    <OfflineRosterCard
      title="All users"
      description="Roster"
      rows={[]}
      showManageButton
      manageButtonLabel="Manage offline users"
      manageDialogTitle="Manage roster"
      manageDialogDescription="Manage offline roster entries"
      {...overrides}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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

  it('can show only the base group provenance column', () => {
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
        showBaseGroupColumn
        manageDialogTitle="Manage"
        manageDialogDescription="Manage roster"
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
      />
    );

    expect(screen.getByText('Base Group Name')).toBeTruthy();
    expect(screen.queryByText('Part Group Name')).toBeNull();
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

  it('renders the manage dialog in the fullscreen centered shell', () => {
    renderManageableRoster();

    fireEvent.click(screen.getByRole('button', { name: 'Manage offline users' }));

    const dialogContent = document.querySelector('[data-slot="dialog-content"]');
    const centeredShell = document.querySelector(
      '[data-slot="offline-roster-manage-centered-shell"]'
    );
    const centeredCard = document.querySelector('[data-slot="offline-roster-manage-card"]');

    expect(dialogContent?.className).toContain('h-dvh');
    expect(dialogContent?.className).toContain('w-screen');
    expect(dialogContent?.className).toContain('rounded-none');
    expect(centeredShell?.className).toContain('min-h-dvh');
    expect(centeredShell?.className).toContain('max-w-5xl');
    expect(centeredShell?.className).toContain('justify-center');
    expect(centeredCard?.className).toContain('shadow-[var(--shadow-floating)]');
    expect(screen.getByText('Manage roster')).toBeTruthy();
    expect(screen.getByLabelText('Firstname')).toBeTruthy();
    expect(screen.getByLabelText('Lastname')).toBeTruthy();
    expect(screen.getByLabelText('Reason why not signed up')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hinzufuegen' })).toBeTruthy();
  });

  it('shows submit and success status before closing after a single offline user is added', async () => {
    let resolveCreate: (() => void) | undefined;
    const onCreate = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveCreate = resolve;
        })
    );

    renderManageableRoster({ onCreate });

    fireEvent.click(screen.getByRole('button', { name: 'Manage offline users' }));
    fireEvent.change(screen.getByLabelText('Firstname'), { target: { value: '  Ada ' } });
    fireEvent.change(screen.getByLabelText('Lastname'), { target: { value: ' Lovelace  ' } });
    fireEvent.change(screen.getByLabelText('Reason why not signed up'), {
      target: { value: ' No account yet ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufuegen' }));

    expect(onCreate).toHaveBeenCalledWith(
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        reasonNotSignedUp: 'No account yet',
      },
      expect.stringMatching(/^offline-roster-single-add:/)
    );
    expect(screen.getByText('Offline user is being added')).toBeTruthy();
    const submitSteps = document.querySelector('[data-slot="offline-roster-manage-submit-steps"]');

    expect(submitSteps?.children.length).toBe(3);
    expect(screen.getByText('Check details')).toBeTruthy();
    expect(screen.getByText('Sync memberships')).toBeTruthy();
    expect(screen.getByText('Update events & delegates')).toBeTruthy();
    expect(screen.getByText('Running')).toBeTruthy();
    expect((screen.getByLabelText('Firstname') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(
      true
    );

    await act(async () => {
      resolveCreate?.();
    });

    await waitFor(() => {
      expect(screen.getByText('Offline user added')).toBeTruthy();
    });
    expect(screen.getAllByText('Complete')).toHaveLength(3);
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull();

    await waitFor(() => {
      expect(screen.queryByText('Manage roster')).toBeNull();
    });
  });

  it('keeps the CSV tab usable with a scrollable preview inside the centered dialog', async () => {
    renderManageableRoster();

    fireEvent.click(screen.getByRole('button', { name: 'Manage offline users' }));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Csv upload' }), {
      button: 0,
      ctrlKey: false,
    });

    const dropZone = screen.getByText('Upload CSV').closest('div');
    const csvFile = {
      text: vi.fn().mockResolvedValue('firstname,lastname,reason\nGrace,Hopper,Manual import'),
    } as unknown as File;

    await act(async () => {
      fireEvent.drop(dropZone as Element, { dataTransfer: { files: [csvFile] } });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Grace')).toBeTruthy();
    });
    expect(screen.getByText('Hopper')).toBeTruthy();
    expect(screen.getByText('Manual import')).toBeTruthy();
    const preview = document.querySelector('[data-slot="offline-roster-csv-preview"]');

    expect(
      document.querySelector('[data-slot="offline-roster-manage-centered-shell"]')
    ).toBeTruthy();
    expect(preview?.className).toContain('h-[min(40vh,24rem)]');
  });
});
