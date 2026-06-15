/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActiveMembersTable } from '../ActiveMembersTable';
import { MembershipsByRoleTables } from '../MembershipsByRoleTables';
import { PendingInvitationsTable } from '../PendingInvitationsTable';
import { PendingRequestsTable } from '../PendingRequestsTable';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
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
  });

  it('renders pending request headers outside the table card surface', () => {
    render(<PendingRequestsTable requests={[member]} onApprove={vi.fn()} onReject={vi.fn()} />);

    expectStandaloneTableSurface();
  });

  it('renders pending invitation headers outside the table card surface', () => {
    render(<PendingInvitationsTable invitations={[member]} onWithdraw={vi.fn()} />);

    expectStandaloneTableSurface();
  });
});
