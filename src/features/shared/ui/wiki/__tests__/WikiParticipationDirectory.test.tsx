/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isVisibleWikiParticipationStatus,
  WikiParticipationDirectory,
} from '../WikiParticipationDirectory';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
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

const roles = [
  { id: 'admin', name: 'Admin' },
  { id: 'moderator', name: 'Moderator' },
];

const items = [
  {
    id: 'ada',
    name: 'Ada Lovelace',
    handle: 'ada',
    roles: [roles[0]],
  },
  {
    id: 'grace',
    name: 'Grace Hopper',
    handle: 'grace',
    roles: [roles[1]],
  },
  {
    id: 'linus',
    name: 'Linus No Role',
    handle: 'linus',
    roles: [],
  },
];

describe('WikiParticipationDirectory', () => {
  it('treats accepted roster statuses as visible and hides pending statuses', () => {
    expect(isVisibleWikiParticipationStatus('active')).toBe(true);
    expect(isVisibleWikiParticipationStatus('member')).toBe(true);
    expect(isVisibleWikiParticipationStatus('admin')).toBe(true);
    expect(isVisibleWikiParticipationStatus('confirmed')).toBe(true);
    expect(isVisibleWikiParticipationStatus('collaborator')).toBe(true);
    expect(isVisibleWikiParticipationStatus('invited')).toBe(false);
    expect(isVisibleWikiParticipationStatus('requested')).toBe(false);
  });

  it('renders all accepted roster entries and omits pending rows', () => {
    const rosterItems = [
      { id: 'viewer', userId: 'user-1', name: 'Current Viewer', status: 'member' },
      { id: 'other', userId: 'user-2', name: 'Other Accepted Member', status: 'active' },
      {
        id: 'collaborator',
        userId: 'user-3',
        name: 'Accepted Collaborator',
        status: 'collaborator',
      },
      { id: 'invited', userId: 'user-4', name: 'Pending Invitation', status: 'invited' },
      { id: 'requested', userId: 'user-5', name: 'Pending Request', status: 'requested' },
    ].filter(item => isVisibleWikiParticipationStatus(item.status));

    render(<WikiParticipationDirectory title="Members" items={rosterItems} />);

    expect(screen.getByText('Current Viewer')).toBeTruthy();
    expect(screen.getByText('Other Accepted Member')).toBeTruthy();
    expect(screen.getByText('Accepted Collaborator')).toBeTruthy();
    expect(screen.queryByText('Pending Invitation')).toBeNull();
    expect(screen.queryByText('Pending Request')).toBeNull();
  });

  it('renders a leading card before the first participation card', () => {
    const { container } = render(
      <WikiParticipationDirectory
        title="Members"
        items={items}
        leadingCard={<div data-testid="leading-card">Roster summary</div>}
      />
    );

    const cardWrappers = container.querySelectorAll('.civic-load-card-reveal');

    expect(cardWrappers).toHaveLength(items.length + 1);
    expect(cardWrappers[0].textContent).toContain('Roster summary');
    expect(cardWrappers[1].textContent).toContain('Ada Lovelace');
  });

  it('filters cards by search query and role chips', () => {
    const { container } = render(
      <WikiParticipationDirectory
        entityType="group"
        title="Members"
        items={items}
        roles={roles}
        searchPlaceholder="Search members"
      />
    );

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    expect(screen.getByText('Linus No Role')).toBeTruthy();
    expect(container.querySelectorAll('.civic-load-card-reveal')).toHaveLength(3);
    expect(container.innerHTML).toContain('--entity-group-bg');
    expect(screen.queryByText('Roles')).toBeNull();

    const roleFilter = container.querySelector('[data-slot="participation-role-filter"]');
    expect(roleFilter?.firstElementChild?.textContent).toBe('All roles');

    fireEvent.change(screen.getByPlaceholderText('Search members'), {
      target: { value: 'grace' },
    });

    expect(screen.queryByText('Ada Lovelace')).toBeNull();
    expect(screen.getByText('Grace Hopper')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search members'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.queryByText('Grace Hopper')).toBeNull();
    expect(screen.queryByText('Linus No Role')).toBeNull();
  });
});
