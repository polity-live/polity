/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuthenticatedShell from '../authenticated-shell';

const mocks = vi.hoisted(() => ({
  pathname: '/group/group-1/members',
  activeId: undefined as string | undefined,
  screenType: 'desktop',
  navigationType: 'combined',
  navigationView: 'expanded',
  primary: [{ id: 'home', href: '/timeline', label: 'Home' }] as any[],
  secondary: [] as any[] | undefined,
  navigate: vi.fn(),
  previousClick: vi.fn(),
  swipeOptions: null as any,
  visibleRoutes: vi.fn(),
  dynamicNavigation: vi.fn(),
  sync: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useRouterState: ({ select }: any) => select({ location: { pathname: mocks.pathname } }),
}));
vi.mock('@/features/navigation/dynamic-navigation.tsx', () => ({
  DynamicNavigation: (props: any) => {
    mocks.dynamicNavigation(props);
    return <nav data-kind={props.navigationType}>{props.navigationType}</nav>;
  },
}));
vi.mock('@/features/navigation/command-dialog.tsx', () => ({
  NavigationCommandDialog: () => <div>command-dialog</div>,
}));
vi.mock('@/features/shared/global-state/screen.store.tsx', () => ({
  useScreenStore: (selector: any) => selector({ screenType: mocks.screenType }),
}));
vi.mock('@/features/navigation/state/navigation.store.tsx', () => ({
  useNavigationStore: () => ({
    navigationType: mocks.navigationType,
    navigationView: mocks.navigationView,
  }),
}));
vi.mock('@/features/navigation/state/useNavigation.tsx', () => ({
  useNavigation: () => ({
    primaryNavItems: mocks.primary,
    secondaryNavItems: mocks.secondary,
  }),
}));
vi.mock('@/features/navigation/nav-items/nav-helpers.ts', () => ({
  isItemActive: (item: any) => item.id === mocks.activeId,
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation.ts', () => ({
  useSwipeNavigation: (options: any) => {
    mocks.swipeOptions = options;
    return { handlers: { 'data-swipe-enabled': String(options.enabled) } };
  },
}));
vi.mock('@/zero/preloads', () => ({
  InternalLinkIntentPreloader: () => <div>intent-preloader</div>,
  PrioritizedPreloadProvider: ({ children }: any) => <>{children}</>,
  useGlobalZeroPreloads: mocks.sync,
  usePrimaryRouteIdlePreloads: mocks.sync,
  useVisiblePreloadRoutes: mocks.visibleRoutes,
}));
vi.mock('@/zero/preferences/usePreferenceSync.ts', () => ({ usePreferenceSync: mocks.sync }));
vi.mock('@/zero/appearance-themes/hooks', () => ({ useAppearanceThemeSync: mocks.sync }));
vi.mock('@/features/notifications/hooks/useToastSettingsSync.ts', () => ({
  useToastSettingsSync: mocks.sync,
}));
vi.mock('@/i18n/i18n-sync-provider.tsx', () => ({
  I18nSyncProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/AlphaWarningDialog.tsx', () => ({
  AlphaWarningDialog: () => <div>alpha-warning</div>,
}));
vi.mock('@/features/shared/motion', () => ({ MotionPage: ({ children }: any) => <>{children}</> }));
vi.mock('@/features/app-tutorial/AppTutorialSessionGate', () => ({
  AppTutorialSessionGate: ({ pathname }: any) => <div>tutorial:{pathname}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/group/group-1/members';
  mocks.activeId = undefined;
  mocks.screenType = 'desktop';
  mocks.navigationType = 'combined';
  mocks.navigationView = 'expanded';
  mocks.secondary = [
    { id: 'overview', href: '/group/group-1', label: 'Overview', onClick: mocks.previousClick },
    { id: 'members', href: '/group/group-1/members', label: 'Members' },
    { id: 'settings', href: '/group/group-1/settings', label: 'Settings' },
  ];
});

afterEach(cleanup);

describe('AuthenticatedShell', () => {
  it('renders onboarding fullscreen while keeping sync, preload, warning, and tutorial contracts active', () => {
    mocks.pathname = '/onboarding';
    mocks.secondary = undefined;
    render(
      <AuthenticatedShell>
        <p>Welcome</p>
      </AuthenticatedShell>
    );
    expect(screen.getByText('Welcome')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(mocks.swipeOptions.enabled).toBe(false);
    expect(mocks.visibleRoutes).toHaveBeenCalledWith([]);
    expect(screen.getByText('tutorial:/onboarding')).toBeTruthy();
  });

  it('renders both navigation surfaces and moves between isolated entity tabs by callback or route', () => {
    const { container } = render(
      <AuthenticatedShell>
        <p>Group members</p>
      </AuthenticatedShell>
    );
    expect(screen.getAllByRole('navigation')).toHaveLength(2);
    expect(mocks.dynamicNavigation).toHaveBeenCalledTimes(2);
    expect(mocks.visibleRoutes).toHaveBeenCalledWith([
      '/group/group-1',
      '/group/group-1/members',
      '/group/group-1/settings',
    ]);
    expect(mocks.swipeOptions).toMatchObject({
      enabled: true,
      canSwipePrev: true,
      canSwipeNext: true,
      keyboardMode: 'global',
    });
    expect(container.querySelector('main')?.getAttribute('data-swipe-enabled')).toBe('true');
    act(() => mocks.swipeOptions.onSwipePrev());
    expect(mocks.previousClick).toHaveBeenCalledOnce();
    act(() => mocks.swipeOptions.onSwipeNext());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/group/group-1/settings' });
  });

  it('disables global keyboard swiping on agenda routes while retaining nested fallback matching', () => {
    mocks.pathname = '/event/event-1/agenda/item-2';
    mocks.navigationType = 'secondary';
    mocks.secondary = [
      { id: 'agenda', href: '/event/event-1/agenda', label: 'Agenda' },
      { id: 'item', href: '/event/event-1/agenda/item-2', label: 'Item' },
      { id: 'event-root', href: '/event', label: 'Event root' },
    ];
    render(<AuthenticatedShell>Agenda</AuthenticatedShell>);
    expect(mocks.swipeOptions).toMatchObject({ enabled: true, keyboardMode: 'off' });
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('uses the direct active item and skips secondary entries without routes', () => {
    mocks.secondary = [
      { id: 'without-route', label: 'No route' },
      { id: 'members', href: '/group/group-1/members', label: 'Members' },
      { id: 'inert', label: 'Inert' },
    ];
    const view = render(<AuthenticatedShell>Fallback active</AuthenticatedShell>);
    expect(mocks.visibleRoutes).toHaveBeenCalledWith(['/group/group-1/members']);
    mocks.activeId = 'members';
    view.rerender(<AuthenticatedShell>Direct active</AuthenticatedShell>);
    expect(mocks.swipeOptions).toMatchObject({ enabled: true, canSwipePrev: true });
    act(() => mocks.swipeOptions.onSwipeNext());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
