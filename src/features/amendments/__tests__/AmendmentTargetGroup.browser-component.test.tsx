import { act, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AmendmentWikiView } from '../AmendmentWikiView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/features/shared/hooks/useEntityActivity', () => ({
  canViewEntityActivity: () => false,
}));
vi.mock('@/features/shared/ui/action-buttons', () => ({
  MembershipButton: () => null,
  SubscribeButton: () => null,
}));
vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: () => null,
}));
vi.mock('@/features/amendments/ui/SupporterStatusBadge', () => ({
  SupporterStatusBadge: () => null,
}));
vi.mock('@/features/shared/ui/voting', () => ({ VoteButtons: () => null }));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
  VisibilityBadge: () => null,
  EditingModeBadge: () => null,
  getEditingModeOption: (mode: string) => ({ value: mode }),
}));
vi.mock('@/features/shared/ui/navigation/FavoriteButton', () => ({ FavoriteButton: () => null }));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({ ShareButton: () => null }));
vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: () => null,
  InfoTabs: () => null,
  WikiParticipationDirectory: () => null,
  getWikiParticipationName: (user: any) => user?.name ?? 'Collaborator',
  isVisibleWikiParticipationStatus: (status: string) => status !== 'hidden',
  normalizeWikiParticipationRole: () => null,
}));
vi.mock('@/features/shared/ui/wiki/ActivityLog', () => ({ ActivityLog: () => null }));
vi.mock('@/features/shared/ui/timeline/CivicMotionTimeline', () => ({
  CivicMotionTimeline: () => null,
}));
vi.mock('@/features/amendments/ui/TargetSelectionDialog', () => ({
  TargetSelectionDialog: () => null,
}));
vi.mock('@/zero/queries', () => ({
  queries: { amendments: { collaboratorPage: () => ({}), collaboratorById: () => ({}) } },
}));

function Wiki() {
  return (
    <AmendmentWikiView
      {...({
        amendmentId: 'amendment-id',
        t: (key: string) => key,
        user: null,
        amendment: {
          id: 'amendment-id',
          title: 'Native amendment',
          preamble: 'Amendment details',
          editing_mode: 'view',
          change_requests: [],
          amendment_hashtags: [],
        },
        collaboration: { collaboratorCount: 0 },
        roles: [],
        collaborators: [],
        supporterDirectoryItems: [],
        clones: [],
        clonedFrom: null,
        targetCollaborator: null,
        targetGroup: { id: 'group-id', name: 'Public target group', image_url: null },
        subscriberCount: 0,
        supportingGroupCount: 0,
        totalSupportingMembers: 0,
        upvotes: 0,
        downvotes: 0,
        normalizedVoteValue: 0,
        cloneDialogOpen: false,
        setCloneDialogOpen: vi.fn(),
        isCloning: false,
        handleClone: vi.fn(),
        handleConfirmClone: vi.fn(),
        supporterDirectorySection: null,
      } as any)}
    />
  );
}

async function fixture(loader: () => Promise<void>) {
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({ getParentRoute: () => root, path: '/', component: Wiki });
  const group = createRoute({
    getParentRoute: () => root,
    path: '/group/$id',
    loader,
    pendingComponent: () => <p role="status">Loading target group</p>,
    errorComponent: () => <p role="alert">Target group unavailable</p>,
    component: () => <p>Target group opened</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, group]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

it('opens the public target group deep link through native keyboard focus and shows its actual route loading state', async () => {
  let resolve: () => void = () => {
    throw new Error('Missing group loader');
  };
  const router = await fixture(
    () =>
      new Promise<void>(done => {
        resolve = done;
      })
  );
  const link = screen.getByRole('link', { name: /Public target group/ });
  expect(link.getAttribute('data-action-id')).toBe('amendments.target-group.open.link');
  expect(link.getAttribute('href')).toBe('/group/group-id');
  link.focus();
  expect(document.activeElement).toBe(link);
  await userEvent.keyboard('{Enter}');
  await screen.findByRole('status');
  await act(async () => resolve());
  await screen.findByText('Target group opened');
  expect(router.state.location.pathname).toBe('/group/group-id');
});

it('shows a failed target group route after native pointer navigation without rendering a successful group page', async () => {
  const router = await fixture(async () => {
    throw new Error('Group access denied');
  });
  await userEvent.click(screen.getByRole('link', { name: /Public target group/ }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Target group opened')).toBeNull();
  await waitFor(() => expect(router.state.location.pathname).toBe('/group/group-id'));
});
