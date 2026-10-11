// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ token: 'a'.repeat(43) }));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute:
    (path: string) => (options: { component: ComponentType; head: () => unknown }) => ({
      path,
      options,
      useParams: () => state,
    }),
}));
vi.mock('@/features/groups/ui/GroupInvitationPage', () => ({
  GroupInvitationPage: ({ token }: { token: string }) => (
    <main data-testid="invitation">{token}</main>
  ),
}));
import { Route } from '../invite/$token';

it('keeps invitation tokens out of referrers/search indexing and passes the exact route token to the invitation page', () => {
  const route = Route as unknown as { options: { component: ComponentType; head: () => unknown } };
  expect(route.options.head()).toEqual({
    meta: [
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  });
  const Page = route.options.component;
  render(<Page />);
  expect(screen.getByTestId('invitation').textContent).toBe(state.token);
});
