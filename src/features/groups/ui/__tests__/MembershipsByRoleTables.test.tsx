/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActiveMembersTable } from '../ActiveMembersTable';
import { GuestsTable } from '../GuestsTable';
import { MembershipsByRoleTables } from '../MembershipsByRoleTables';
import { PendingInvitationsTable } from '../PendingInvitationsTable';
import { PendingRequestsTable } from '../PendingRequestsTable';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    const href = to && params?.id ? to.replace('$id', params.id) : to;

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

afterEach(() => {
  cleanup();
});

const member = {
  id: 'membership-1',
  user: {
    id: 'user-1',
    first_name: 'Ada',
    last_name: 'Lovelace',
    handle: 'ada',
  },
  roles: [{ id: 'role-1', name: 'Chair' }],
  role: { id: 'role-1', name: 'Chair' },
  created_at: Date.now(),
};

function expectStandaloneTableSurface() {
  const surface = document.querySelector('[data-slot="data-table-surface"]');

  expect(surface).toBeTruthy();
  expect(surface?.getAttribute('data-surface')).toBe('standalone');
  expect(surface?.className).toContain('bg-card');
  expect(surface?.className).toContain('rounded-md');
  expect(surface?.className).toContain('shadow-[var(--shadow-panel)]');
}

function expectNoRoleSectionAccentSurfaces(container: HTMLElement) {
  expect(container.innerHTML).not.toContain('border-l');
  expect(container.innerHTML).not.toContain('bg-gradient');
  expect(container.innerHTML).not.toContain('from-');
  expect(container.innerHTML).not.toContain('headerAccent');
}

function expectIconOnlyButton(label: string) {
  const button = screen.getByRole('button', { name: label });

  expect(button.textContent).toBe('');

  return button;
}

describe('MembershipsByRoleTables', () => {
  it('keeps members without assigned roles visible in a dedicated no-role table', () => {
    render(
      <MembershipsByRoleTables
        roles={[
          {
            id: 'role-1',
            name: 'Chair',
            description: 'Chairs the group.',
          },
        ]}
        members={[
          {
            id: 'membership-1',
            user: {
              id: 'user-1',
              first_name: 'Ada',
              last_name: 'Lovelace',
              handle: 'ada',
            },
            roles: [{ id: 'role-1', name: 'Chair' }],
            role: { id: 'role-1', name: 'Chair' },
            created_at: Date.now(),
          },
          {
            id: 'membership-2',
            user: {
              id: 'user-2',
              first_name: 'Grace',
              last_name: 'Hopper',
              handle: 'grace',
            },
            roles: [],
            role: null,
            created_at: Date.now(),
          },
        ]}
        onOpenRightsDialog={vi.fn()}
        onRemoveRole={vi.fn()}
        onSecondaryAction={vi.fn()}
      />
    );

    expect(screen.getByText('Chair')).toBeTruthy();
    expect(screen.getAllByText('No user role').length).toBeGreaterThan(0);
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
  });

  it('can hide role tables that have no members', () => {
    render(
      <MembershipsByRoleTables
        roles={[
          { id: 'role-1', name: 'Chair', description: 'Chairs the group.' },
          { id: 'role-2', name: 'Treasurer', description: 'Tracks finances.' },
        ]}
        members={[member]}
        onOpenRightsDialog={vi.fn()}
        onRemoveRole={vi.fn()}
        hideEmptyRoleSections
      />
    );

    expect(screen.getByText('Chair')).toBeTruthy();
    expect(screen.queryByText('Treasurer')).toBeNull();
    expect(screen.queryByText('Tracks finances.')).toBeNull();
  });

  it('renders role headers outside the table card surface', () => {
    const { container } = render(
      <MembershipsByRoleTables
        roles={[{ id: 'role-1', name: 'Chair', description: 'Chairs the group.' }]}
        members={[member]}
        onOpenRightsDialog={vi.fn()}
        onRemoveRole={vi.fn()}
      />
    );

    expectStandaloneTableSurface();
    expectNoRoleSectionAccentSurfaces(container);
    expectIconOnlyButton('components.membershipTables.rights');
    expectIconOnlyButton('components.membershipTables.remove');
  });

  it('renders active member headers outside the table card surface', () => {
    render(
      <ActiveMembersTable
        members={[member]}
        sort={{ field: 'user', direction: 'asc' }}
        onSortChange={vi.fn()}
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expectStandaloneTableSurface();
    expectIconOnlyButton('components.membershipTables.rights');
    expectIconOnlyButton('components.membershipTables.manageRoles');
    expectIconOnlyButton('components.membershipTables.remove');
  });

  it('keeps disabled derived role removal accessible as an icon action', () => {
    render(
      <MembershipsByRoleTables
        roles={[{ id: 'role-1', name: 'Chair', description: 'Chairs the group.' }]}
        members={[{ ...member, source: 'derived' }]}
        onOpenRightsDialog={vi.fn()}
        onRemoveRole={vi.fn()}
      />
    );

    const removeButton = expectIconOnlyButton('components.membershipTables.remove');

    expect(removeButton.hasAttribute('disabled')).toBe(true);
  });

  it('shows the part group name in the active members provenance column', () => {
    render(
      <ActiveMembersTable
        members={[
          {
            ...member,
            partGroup: { id: 'part-group-id', name: 'Part Group Name' },
            baseGroup: { id: 'base-group-id', name: 'Base Group Name' },
          },
        ]}
        sort={{ field: 'user', direction: 'asc' }}
        onSortChange={vi.fn()}
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
        onRemove={vi.fn()}
        showProvenanceColumns
      />
    );

    expect(screen.getByText('Part Group Name')).toBeTruthy();
    expect(screen.getByText('Base Group Name')).toBeTruthy();
  });

  it('can show only the base group provenance column in the active members table', () => {
    render(
      <ActiveMembersTable
        members={[
          {
            ...member,
            partGroup: { id: 'part-group-id', name: 'Part Group Name' },
            baseGroup: { id: 'base-group-id', name: 'Base Group Name' },
          },
        ]}
        sort={{ field: 'user', direction: 'asc' }}
        onSortChange={vi.fn()}
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
        onRemove={vi.fn()}
        showBaseGroupColumn
      />
    );

    expect(screen.getByText('Base Group Name')).toBeTruthy();
    expect(screen.queryByText('Part Group Name')).toBeNull();
  });

  it('shows the base group column in by-role tables', () => {
    render(
      <MembershipsByRoleTables
        roles={[{ id: 'role-1', name: 'Chair', description: 'Chairs the group.' }]}
        members={[
          {
            ...member,
            baseGroup: { id: 'base-group-id', name: 'Base Group Name' },
          },
        ]}
        onOpenRightsDialog={vi.fn()}
        onRemoveRole={vi.fn()}
        showBaseGroupColumn
      />
    );

    expect(screen.getByText('Base Group Name')).toBeTruthy();
    expect(screen.getByText('Base Group Name').closest('a')?.getAttribute('href')).toBe(
      '/group/base-group-id'
    );
  });

  it('renders delegate representation badges in the active members table', () => {
    render(
      <ActiveMembersTable
        members={[
          {
            ...member,
            delegateRepresentedGroups: [
              { id: 'group-b1', name: 'B1', seatCount: 1 },
              { id: 'group-b2', name: 'B2', seatCount: 2 },
            ],
          },
        ]}
        sort={{ field: 'user', direction: 'asc' }}
        onSortChange={vi.fn()}
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
        onRemove={vi.fn()}
        showDelegateRepresentationColumn
      />
    );

    expect(screen.getByText('components.tableColumns.delegateRepresents')).toBeTruthy();
    expect(screen.getByText('B1')).toBeTruthy();
    expect(screen.getByText('B2 (2)')).toBeTruthy();
    expect(screen.getByText('B1').closest('a')?.getAttribute('href')).toBe('/group/group-b1');
  });

  it('renders delegate representation badges in each role table', () => {
    render(
      <MembershipsByRoleTables
        roles={[{ id: 'role-1', name: 'Chair', description: 'Chairs the group.' }]}
        members={[
          {
            ...member,
            delegateRepresentedGroups: [
              { id: 'group-b1', name: 'B1', seatCount: 1 },
              { id: 'group-b2', name: 'B2', seatCount: 2 },
            ],
          },
        ]}
        onOpenRightsDialog={vi.fn()}
        onRemoveRole={vi.fn()}
        showDelegateRepresentationColumn
      />
    );

    expect(screen.getByText('components.tableColumns.delegateRepresents')).toBeTruthy();
    expect(screen.getByText('B1')).toBeTruthy();
    expect(screen.getByText('B2 (2)')).toBeTruthy();
    expect(screen.getByText('B2 (2)').closest('a')?.getAttribute('href')).toBe('/group/group-b2');
  });

  it('renders pending request headers outside the table card surface', () => {
    render(<PendingRequestsTable requests={[member]} onApprove={vi.fn()} onReject={vi.fn()} />);

    expectStandaloneTableSurface();
    expectIconOnlyButton('Accept');
    expectIconOnlyButton('Remove');
  });

  it('renders pending invitation headers outside the table card surface', () => {
    render(<PendingInvitationsTable invitations={[member]} onWithdraw={vi.fn()} />);

    expectStandaloneTableSurface();
    expectIconOnlyButton('generated.inline.0105_withdraw_invitation_0beb2d10');
  });

  it('shows the base group column in pending requests', () => {
    render(
      <PendingRequestsTable
        requests={[
          {
            ...member,
            baseGroup: { id: 'base-group-id', name: 'Base Group Name' },
          },
        ]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        showBaseGroupColumn
      />
    );

    expect(screen.getByText('Base Group Name')).toBeTruthy();
    expect(screen.getByText('Base Group Name').closest('a')?.getAttribute('href')).toBe(
      '/group/base-group-id'
    );
  });

  it('shows the base group column in pending invitations', () => {
    render(
      <PendingInvitationsTable
        invitations={[
          {
            ...member,
            baseGroup: { id: 'base-group-id', name: 'Base Group Name' },
          },
        ]}
        onWithdraw={vi.fn()}
        showBaseGroupColumn
      />
    );

    expect(screen.getByText('Base Group Name')).toBeTruthy();
    expect(screen.getByText('Base Group Name').closest('a')?.getAttribute('href')).toBe(
      '/group/base-group-id'
    );
  });

  it('shows the base group column in guests', () => {
    render(
      <GuestsTable
        guests={[
          {
            id: 'guest-1',
            status: 'active',
            user: {
              id: 'user-1',
              first_name: 'Ada',
              last_name: 'Lovelace',
              email: 'ada@example.org',
            },
            roles: [{ id: 'role-1', name: 'Guest' }],
            baseGroup: { id: 'base-group-id', name: 'Base Group Name' },
          },
        ]}
        showBaseGroupColumn
      />
    );

    expect(screen.getByText('Base Group Name')).toBeTruthy();
    expect(screen.getByText('Base Group Name').closest('a')?.getAttribute('href')).toBe(
      '/group/base-group-id'
    );
  });
});
