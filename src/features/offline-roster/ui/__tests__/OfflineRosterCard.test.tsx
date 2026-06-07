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
});
