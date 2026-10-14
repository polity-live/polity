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
import { useEffect, type ReactNode } from 'react';
import AuthenticatedShell from '../authenticated-shell';
import { Route as SearchFileRoute } from '@/routes/_authed/search';
import { createSearchDocumentPageArgs } from '@/zero/preloads/search-context';
import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';

const mocks = vi.hoisted(() => ({
  currentUser: { id: 'viewer' },
  shellRender: vi.fn(),
  demand: vi.fn(),
  navItems: [],
  queryRead: vi.fn(),
  listeners: new Set<() => void>(),
  effects: [] as unknown[],
  preference: {
    id: 'preference',
    created_at: 1,
    updated_at: 2,
    theme: 'system',
    language: 'en',
    navigation_view: 'asButtonList',
    display_currency: 'EUR',
    appearance_theme_id: null as string | null,
  },
  settings: { delivery_settings: { inAppNotifications: true } },
  theme: { theme: 'system', setTheme: vi.fn(), setAppearanceTheme: vi.fn() },
  language: { language: 'en', setLanguage: vi.fn() },
  navigation: {
    navigationType: 'combined',
    navigationView: 'asButtonList',
    setNavigationView: vi.fn(),
  },
  currency: { setDisplayCurrency: vi.fn() },
  zero: {
    clientID: 'sync-audit',
    mutate: vi.fn((_request: unknown) => ({
      server: Promise.resolve({ type: 'success' as const }),
    })),
    preload: vi.fn(),
  },
}));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => mocks.zero }));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.currentUser }),
}));
vi.mock('@/zero/observed-query', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useQuery: (request?: { query: { queryName: string }; args: unknown }) => {
      const name = request?.query.queryName;
      mocks.queryRead(name, request?.args);
      const data = useSyncExternalStore(
        listener => {
          mocks.listeners.add(listener);
          return () => mocks.listeners.delete(listener);
        },
        () =>
          name === 'preferences.byUser'
            ? mocks.preference
            : name === 'notifications.settings'
              ? mocks.settings
              : undefined
      );
      return [data, { type: 'complete' }];
    },
  };
});
vi.mock('@/features/shared/global-state/theme.store', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useThemeStore: (select: (state: typeof mocks.theme) => unknown) =>
      useSyncExternalStore(
        listener => {
          mocks.listeners.add(listener);
          return () => mocks.listeners.delete(listener);
        },
        () => select(mocks.theme)
      ),
  };
});
vi.mock('@/features/shared/global-state/language.store', () => ({
  useLanguageStore: (select?: (state: typeof mocks.language) => unknown) =>
    select ? select(mocks.language) : mocks.language,
}));
vi.mock('@/features/shared/global-state/currency.store', () => ({
  useDisplayCurrencyStore: (select: (state: typeof mocks.currency) => unknown) =>
    select(mocks.currency),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: vi.fn() },
  setInAppNotificationsEnabled: (enabled: boolean) => mocks.effects.push(['toast', enabled]),
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => {
    mocks.shellRender();
    return { currentUser: mocks.currentUser, isLoading: false };
  },
}));
vi.mock('@/zero/preloads', async () => {
  const { useGlobalZeroPreloads } = await import('@/zero/preloads/global');
  const { useEffect } = await import('react');
  return {
    PrioritizedPreloadProvider: ({ children }: { children: ReactNode }) => children,
    InternalLinkIntentPreloader: () => null,
    useGlobalZeroPreloads,
    usePrimaryRouteIdlePreloads: (enabled: boolean) => {
      useEffect(() => {
        mocks.effects.push(['idle-demand', enabled]);
      }, [enabled]);
    },
    useVisiblePreloadRoutes: vi.fn(),
    useSearchPreloads: mocks.demand,
  };
});
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
  useNavigationStore: (select?: (state: typeof mocks.navigation) => unknown) =>
    select ? select(mocks.navigation) : mocks.navigation,
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: () => ({ handlers: {} }),
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
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
  mocks.preference = { ...mocks.preference, appearance_theme_id: null };
  mocks.settings = { delivery_settings: { inAppNotifications: true } };
  mocks.theme = { ...mocks.theme, theme: 'system' };
  mocks.effects.length = 0;
  mocks.theme.setAppearanceTheme.mockImplementation(theme =>
    mocks.effects.push(['theme', theme.id])
  );
  mocks.theme.setTheme.mockImplementation(theme => mocks.effects.push(['store-theme', theme]));
  mocks.language.setLanguage.mockImplementation(language =>
    mocks.effects.push(['store-language', language])
  );
  mocks.navigation.setNavigationView.mockImplementation(view =>
    mocks.effects.push(['store-navigation', view])
  );
  mocks.currency.setDisplayCurrency.mockImplementation(currency =>
    mocks.effects.push(['store-currency', currency])
  );
  mocks.zero.preload.mockImplementation(
    (request: { query: { queryName: string }; args: unknown }, options: unknown) => {
      mocks.effects.push(['preload', request.query.queryName, request.args, options]);
      return { cleanup: vi.fn(), complete: Promise.resolve() };
    }
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function mountedRouter() {
  function SearchContent() {
    useEffect(() => {
      mocks.effects.push(['content-effect']);
    }, []);
    return <div>Search content</div>;
  }
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
    component: SearchContent,
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
  const initialEffects = [...mocks.effects];
  mocks.queryRead.mockClear();
  mocks.effects.length = 0;
  return { router, history, initialEffects };
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

it('retains global sync effects and live updates without rereading them on warmed navigation', async () => {
  const { router, history, initialEffects } = await mountedRouter();
  expect(initialEffects).toEqual([
    ['content-effect'],
    ['store-currency', 'EUR'],
    ['store-theme', 'system'],
    ['store-language', 'en'],
    ['store-navigation', 'asButtonList'],
    ['theme', BUILTIN_THEMES[0].id],
    ['toast', true],
    ['preload', 'users.current', {}, { ttl: 'none' }],
    ['preload', 'notifications.settings', {}, { ttl: 'none' }],
    ['preload', 'notifications.pushSubscriptions', {}, { ttl: 'none' }],
    ['preload', 'messages.unreadSummary', {}, { ttl: 'none' }],
    ['idle-demand', true],
  ]);
  await act(async () => {
    history.back();
    await router.load();
  });
  expect(mocks.queryRead).not.toHaveBeenCalled();
  expect(mocks.effects).toEqual([['content-effect']]);
  mocks.effects.length = 0;
  await act(async () => {
    mocks.preference = { ...mocks.preference, appearance_theme_id: BUILTIN_THEMES[1].id };
    mocks.settings = { delivery_settings: { inAppNotifications: false } };
    for (const listener of mocks.listeners) listener();
  });
  expect(mocks.effects).toEqual([
    ['theme', BUILTIN_THEMES[1].id],
    ['toast', false],
  ]);
  expect(mocks.shellRender).toHaveBeenCalledTimes(1);
  expect(mocks.zero.mutate).not.toHaveBeenCalled();
  await act(async () => {
    mocks.theme = { ...mocks.theme, theme: 'dark' };
    for (const listener of mocks.listeners) listener();
  });
  expect(mocks.zero.mutate.mock.lastCall?.[0]).toMatchObject({
    args: { id: 'preference', theme: 'dark' },
  });
});
