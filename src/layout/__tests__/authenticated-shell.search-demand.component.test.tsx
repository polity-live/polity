/* @vitest-environment jsdom */
import { act, cleanup, render } from '@testing-library/react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import AuthenticatedShell from '../authenticated-shell';
import { Route as SearchFileRoute } from '@/routes/_authed/search';
import { createSearchDocumentPageArgs } from '@/zero/preloads/search-context';

const mocks = vi.hoisted(() => ({
  currentUser: { id: 'viewer' },
  shellRender: vi.fn(),
  demand: vi.fn(),
  navItems: [],
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => {
    mocks.shellRender();
    return { currentUser: mocks.currentUser, isLoading: false };
  },
}));
vi.mock('@/zero/preloads', () => ({
  PrioritizedPreloadProvider: ({ children }: { children: ReactNode }) => children,
  InternalLinkIntentPreloader: () => null,
  useGlobalZeroPreloads: vi.fn(),
  usePrimaryRouteIdlePreloads: vi.fn(),
  useVisiblePreloadRoutes: vi.fn(),
  useSearchPreloads: mocks.demand,
}));
vi.mock('@/features/search/SearchPage', () => ({ SearchPage: () => null }));
vi.mock('@/features/navigation/state/useNavigation', () => ({
  useNavigation: () => ({ primaryNavItems: mocks.navItems, secondaryNavItems: null }),
}));
vi.mock('@/features/navigation/dynamic-navigation', () => ({ DynamicNavigation: () => null }));
vi.mock('@/features/navigation/command-dialog', () => ({ NavigationCommandDialog: () => null }));
vi.mock('@/features/shared/global-state/screen.store', () => ({
  useScreenStore: (select: (state: { screenType: string }) => unknown) =>
    select({ screenType: 'desktop' }),
}));
vi.mock('@/features/navigation/state/navigation.store', () => ({
  useNavigationStore: () => ({ navigationType: 'combined', navigationView: 'asButtonList' }),
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: () => ({ handlers: {} }),
}));
vi.mock('@/zero/preferences/usePreferenceSync', () => ({ usePreferenceSync: vi.fn() }));
vi.mock('@/zero/appearance-themes/hooks', () => ({ useAppearanceThemeSync: vi.fn() }));
vi.mock('@/features/notifications/hooks/useToastSettingsSync', () => ({
  useToastSettingsSync: vi.fn(),
}));
vi.mock('@/i18n/i18n-sync-provider', () => ({
  I18nSyncProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/shared/ui/collections/CollectionPreferencesProvider', () => ({
  CollectionPreferencesProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/shared/ui/preview/WorkspacePreview', () => ({
  WorkspacePreviewProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/shared/motion', () => ({
  MotionPage: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/shared/ui/AlphaWarningDialog', () => ({ AlphaWarningDialog: () => null }));
vi.mock('@/features/app-tutorial/AppTutorialSessionGate', () => ({
  AppTutorialSessionGate: () => null,
}));
beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function mountedRouter() {
  const root = createRootRoute({
    component: () => (
      <AuthenticatedShell>
        <Outlet />
      </AuthenticatedShell>
    ),
  });
  const search = createRoute({
    getParentRoute: () => root,
    path: '/search',
    validateSearch: SearchFileRoute.options.validateSearch,
    component: () => <div>Search content</div>,
  });
  const group = createRoute({
    getParentRoute: () => root,
    path: '/group/$id',
    component: () => <div>Group content</div>,
  });
  const history = createMemoryHistory({
    initialEntries: ['/search?q=cached&types=group'],
  });
  const router = createRouter({ routeTree: root.addChildren([search, group]), history });
  await router.load();
  render(<RouterProvider router={router} />);
  await act(async () => {
    await router.navigate({ to: '/group/$id', params: { id: 'one' } });
  });
  mocks.shellRender.mockClear();
  mocks.demand.mockClear();
  return { router, history };
}

it('keeps the matched-search publication local while preserving warmed back demand arguments', async () => {
  const { router, history } = await mountedRouter();
  await act(async () => {
    history.back();
    await router.load();
  });
  expect(mocks.shellRender).toHaveBeenCalledTimes(1);
  expect(mocks.demand.mock.calls.map(([search, enabled]) => ({ search, enabled }))).toEqual([
    { search: {}, enabled: true },
    { search: { q: 'cached', types: 'group' }, enabled: true },
  ]);
  const args = createSearchDocumentPageArgs(mocks.demand.mock.lastCall![0]);
  expect(args).toMatchObject({ query: 'cached', types: ['group'], limit: 49 });
});

it('updates validated filters locally and disables demand when leaving search', async () => {
  const { router, history } = await mountedRouter();
  await act(async () => {
    history.back();
    await router.load();
  });
  mocks.shellRender.mockClear();
  mocks.demand.mockClear();
  await act(async () => {
    await router.navigate({
      to: '/search',
      search: { q: 'changed', types: 'event,group', topics: 'policy', sort: 'trending' },
    });
  });
  expect(mocks.shellRender).not.toHaveBeenCalled();
  expect(createSearchDocumentPageArgs(mocks.demand.mock.lastCall![0])).toMatchObject({
    query: 'changed',
    types: ['event', 'group'],
    topics: ['policy'],
    sort: 'trending',
  });
  await act(async () => {
    await router.navigate({ to: '/group/$id', params: { id: 'two' } });
  });
  expect(mocks.demand.mock.lastCall).toEqual([{}, false]);
  await act(async () => {
    history.back();
    await router.load();
  });
  expect(mocks.demand.mock.lastCall).toEqual([
    { q: 'changed', types: 'event,group', topics: 'policy', sort: 'trending' },
    true,
  ]);
});
