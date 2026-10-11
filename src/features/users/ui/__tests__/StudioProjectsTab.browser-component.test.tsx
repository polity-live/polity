import { useSyncExternalStore } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { StudioProjectsTab } from '../StudioProjectsTab';

const io = vi.hoisted(() => ({
  projects: [] as any[],
  result: { type: 'complete' } as any,
  revision: 0,
  listeners: new Set<() => void>(),
  query: vi.fn(),
}));
vi.mock('@rocicorp/zero/react', async importOriginal => ({
  ...(await importOriginal<typeof import('@rocicorp/zero/react')>()),
  useQuery: (query: unknown) => {
    io.query(query);
    useSyncExternalStore(
      listener => {
        io.listeners.add(listener);
        return () => {
          io.listeners.delete(listener);
        };
      },
      () => io.revision
    );
    return [io.projects, io.result];
  },
}));
vi.mock('@/zero/queries', () => ({ queries: { studio: { byOwner: (input: unknown) => input } } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  io.result = { type: 'complete' };
  io.projects = [];
  io.revision = 0;
});

async function fixture(groupId: string | null = null) {
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <StudioProjectsTab userId="profile-owner" />,
  });
  const personal = createRoute({
    getParentRoute: () => root,
    path: '/studio/$projectId',
    component: () => <p>Personal project opened</p>,
  });
  const group = createRoute({
    getParentRoute: () => root,
    path: '/group/$id/studio/$projectId',
    component: () => <p>Group project opened</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, personal, group]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  io.projects = [
    {
      id: 'project-id',
      title: 'Profile project',
      kind: 'single',
      visibility: 'public',
      group_id: groupId,
    },
  ];
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

function publish() {
  io.revision++;
  io.listeners.forEach(listener => listener());
}

it('hides project navigation while loading and after a query failure even with cached projects', async () => {
  io.result = { type: 'unknown' };
  await fixture();
  expect(screen.getByRole('status').textContent).toBe('features.studio.loading');
  expect(screen.queryByRole('link')).toBeNull();
  await act(async () => {
    io.result = { type: 'complete' };
    publish();
  });
  expect(screen.getByRole('link').getAttribute('href')).toBe('/studio/project-id');
  expect(io.query).toHaveBeenCalledWith({ ownerId: 'profile-owner' });
  await act(async () => {
    io.result = { type: 'error', error: { type: 'app', message: 'Access denied' } };
    publish();
  });
  expect(screen.getByRole('alert').textContent).toBe('features.studio.projectsUnavailable');
  expect(screen.queryByRole('link')).toBeNull();
});

it('renders the empty state when the owner has no visible Studio projects', async () => {
  await fixture();
  await act(async () => {
    io.projects = [];
    publish();
  });
  expect(screen.getByText('features.studio.empty')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
});

it('opens the personal Studio deep link through real native keyboard navigation', async () => {
  const router = await fixture();
  const link = screen.getByRole('link');
  expect(link.getAttribute('data-action-id')).toBe('users.studio-project.open.link');
  expect(link.getAttribute('href')).toBe('/studio/project-id');
  link.focus();
  expect(document.activeElement).toBe(link);
  await userEvent.keyboard('{Enter}');
  await screen.findByText('Personal project opened');
  expect(router.state.location.pathname).toBe('/studio/project-id');
});

it('opens the group Studio deep link through real native pointer navigation', async () => {
  const router = await fixture('group-id');
  const link = screen.getByRole('link');
  expect(link.getAttribute('href')).toBe('/group/group-id/studio/project-id');
  await userEvent.click(link);
  await screen.findByText('Group project opened');
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/group/group-id/studio/project-id')
  );
});
