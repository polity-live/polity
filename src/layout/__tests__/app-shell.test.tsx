/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dynamicNavigation: vi.fn(),
  entitySecondary: undefined as any[] | undefined,
  navigationType: 'combined',
  navigationView: 'expanded',
  pathname: '/',
  screenType: 'desktop',
  t: (key: string) => key,
  user: null as any,
  zeroReady: false,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: any) => select({ location: { pathname: mocks.pathname } }),
}));
vi.mock('@/features/shared/ui/ui/sonner.tsx', () => ({ Toaster: () => <div>toaster</div> }));
vi.mock('@/features/navigation/dynamic-navigation.tsx', () => ({
  DynamicNavigation: (props: any) => {
    mocks.dynamicNavigation(props);
    return <nav data-kind={props.navigationType}>{props.navigationType}</nav>;
  },
}));
vi.mock('@/features/shared/global-state/screen.store.tsx', () => ({
  useScreenResponsiveDetector: vi.fn(),
  useScreenStore: (selector: any) => selector({ screenType: mocks.screenType }),
}));
vi.mock('@/features/navigation/state/navigation.store.tsx', () => ({
  useNavigationStore: () => ({
    navigationType: mocks.navigationType,
    navigationView: mocks.navigationView,
  }),
}));
vi.mock('@/features/shared/global-state/theme.store.tsx', () => ({
  useThemeInitializer: vi.fn(),
}));
vi.mock('@/i18n/i18n-sync-provider.tsx', () => ({
  I18nSyncProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/pwa/hooks/usePwaInstallPrompt.ts', () => ({
  PwaInstallProvider: () => <div>pwa-provider</div>,
}));
vi.mock('@/features/pwa/ui/ForegroundPushToastListener', () => ({
  ForegroundPushToastListener: () => <div>push-listener</div>,
}));
vi.mock('@/features/shared/ui/AlphaWarningDialog.tsx', () => ({
  AlphaWarningDialog: () => <div>alpha-warning</div>,
}));
vi.mock('@/providers/auth-provider.tsx', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/providers/zero-ready-context.ts', () => ({ useZeroReady: () => mocks.zeroReady }));
vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: mocks.t }),
}));
vi.mock('@/features/navigation/nav-items/nav-items-unauthenticated.tsx', () => ({
  createEntitySecondaryNavItemsUnauthenticated: () => mocks.entitySecondary,
  createLandingSecondaryNavItems: () => [{ id: 'landing-secondary', label: 'Landing' }],
  createNavItemsUnauthenticated: () => [{ id: 'primary', label: 'Primary' }],
}));
vi.mock('@/features/shared/motion', () => ({ MotionPage: ({ children }: any) => <>{children}</> }));
vi.mock('@/zero/preloads/route-link-intent-preloader', () => ({
  RouteLinkIntentPreloader: () => <div>route-preloader</div>,
}));
vi.mock('../app-shell-layout', () => ({
  getAppShellResponsiveClasses: ({ isSecondaryNavVisible }: any) =>
    isSecondaryNavVisible ? 'with-secondary' : 'without-secondary',
  getUnauthenticatedPageFrame: (pathname: string) => `frame:${pathname}`,
  isLandingPath: (pathname: string) => pathname === '/',
}));
vi.mock('../page-frame', () => ({
  PageFrame: ({ children, frame }: any) => <div data-frame={frame}>{children}</div>,
}));
vi.mock('../authenticated-shell', () => ({
  default: ({ children }: any) => <div data-testid="authenticated-shell">{children}</div>,
}));
vi.mock('@/features/navigation/command-dialog.tsx', () => ({
  NavigationCommandDialog: ({ secondaryNavItems }: any) => (
    <div data-testid="command-dialog">{secondaryNavItems ? 'secondary' : 'none'}</div>
  ),
}));

import { AppShell } from '../app-shell';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.entitySecondary = undefined;
  mocks.navigationType = 'combined';
  mocks.navigationView = 'expanded';
  mocks.pathname = '/';
  mocks.user = null;
  mocks.zeroReady = false;
});

afterEach(cleanup);

describe('AppShell', () => {
  it('loads the authenticated shell only when both auth and Zero are ready', async () => {
    mocks.user = { id: 'user-1' };
    mocks.zeroReady = true;
    render(<AppShell>Authenticated content</AppShell>);
    expect(await screen.findByTestId('authenticated-shell')).toBeTruthy();
    expect(screen.getByText('Authenticated content')).toBeTruthy();
    expect(screen.getByText('pwa-provider')).toBeTruthy();
    expect(screen.getByText('push-listener')).toBeTruthy();
    expect(screen.getByText('toaster')).toBeTruthy();
  });

  it('renders landing navigation without the command dialog while Zero is unavailable', () => {
    render(<AppShell>Landing content</AppShell>);
    expect(screen.getAllByRole('navigation')).toHaveLength(2);
    expect(screen.queryByTestId('command-dialog')).toBeNull();
    expect(document.querySelector('main')?.className).toContain('with-secondary');
  });

  it('covers entity secondary, absent secondary, and each navigation visibility mode', async () => {
    mocks.zeroReady = true;
    mocks.pathname = '/group/group-1';
    mocks.entitySecondary = [{ id: 'entity-secondary', label: 'Entity' }];
    mocks.navigationType = 'secondary';
    const view = render(<AppShell>Entity content</AppShell>);
    await waitFor(() => expect(screen.getByTestId('command-dialog')).toBeTruthy());
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(document.querySelector('main')?.className).toContain('with-secondary');

    mocks.navigationType = 'primary';
    view.rerender(<AppShell>Primary only</AppShell>);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(document.querySelector('main')?.className).toContain('without-secondary');

    mocks.entitySecondary = undefined;
    mocks.navigationType = 'secondary';
    view.rerender(<AppShell>No navigation</AppShell>);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByTestId('command-dialog').textContent).toBe('none');
  });

  it('keeps an authenticated user on the public shell until Zero is ready', () => {
    mocks.user = { id: 'user-1' };
    render(<AppShell>Waiting for Zero</AppShell>);
    expect(screen.queryByTestId('authenticated-shell')).toBeNull();
    expect(screen.getByText('Waiting for Zero')).toBeTruthy();
  });
});
