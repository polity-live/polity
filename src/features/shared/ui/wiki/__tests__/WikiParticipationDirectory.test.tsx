/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WikiParticipationDirectory } from '../WikiParticipationDirectory';

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
