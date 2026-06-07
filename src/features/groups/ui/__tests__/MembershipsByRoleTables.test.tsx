/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MembershipsByRoleTables } from '../MembershipsByRoleTables';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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
});
