import { lazy, Suspense, type ReactNode, useEffect, useMemo } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Toaster } from '@/features/shared/ui/ui/sonner.tsx';
import { DynamicNavigation } from '@/features/navigation/dynamic-navigation.tsx';
import {
  useScreenResponsiveDetector,
  useScreenStore,
} from '@/features/shared/global-state/screen.store.tsx';
import { useNavigationStore } from '@/features/navigation/state/navigation.store.tsx';
import { SecondaryNavigationVisibleContext } from '@/features/navigation/state/navigation-layout-context';
import { useThemeInitializer } from '@/features/shared/global-state/theme.store.tsx';
import { I18nSyncProvider } from '@/i18n/i18n-sync-provider.tsx';
import { PwaInstallProvider } from '@/features/pwa/hooks/usePwaInstallPrompt.ts';
import { ForegroundPushToastListener } from '@/features/pwa/ui/ForegroundPushToastListener';
import { AlphaWarningDialog } from '@/features/shared/ui/AlphaWarningDialog.tsx';
import { useAuth } from '@/providers/auth-provider.tsx';
import { useZeroReady } from '@/providers/zero-ready-context.ts';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import {
  createEntitySecondaryNavItemsUnauthenticated,
  createLandingSecondaryNavItems,
  createNavItemsUnauthenticated,
} from '@/features/navigation/nav-items/nav-items-unauthenticated.tsx';
import { MotionPage } from '@/features/shared/motion';
import { RouteLinkIntentPreloader } from '@/zero/preloads/route-link-intent-preloader';
import {
  getAppShellResponsiveClasses,
  getUnauthenticatedPageFrame,
  isLandingPath,
  isCityDesignCanvasPath,
} from './app-shell-layout';
import { PageFrame } from './page-frame';

export const loadAuthenticatedShell = () => import('./authenticated-shell');
const AuthenticatedShell = lazy(loadAuthenticatedShell);
const NavigationCommandDialog = lazy(() =>
  import('@/features/navigation/command-dialog.tsx').then(module => ({
    default: module.NavigationCommandDialog,
  }))
);

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <PwaInstallProvider />
      <ForegroundPushToastListener />
      <AppShellInner>{children}</AppShellInner>
      <Toaster richColors position="top-right" />
    </>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  useThemeInitializer({ defaultTheme: 'system', storageKey: 'theme' });
  useScreenResponsiveDetector();
  const { user } = useAuth();
  const zeroReady = useZeroReady();

  useEffect(() => {
    // Load the authenticated frame while its Zero connection is being prepared.
    // Rendering and query activation still wait for the normal readiness gate.
    if (user) void loadAuthenticatedShell().catch(() => undefined);
  }, [user?.id]);

  if (user && zeroReady) {
    return (
      <Suspense fallback={<div className="bg-background min-h-screen" aria-busy="true" />}>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </Suspense>
    );
  }

  return (
    <>
      <RouteLinkIntentPreloader />
      <UnauthenticatedShell showCommandDialog={zeroReady}>{children}</UnauthenticatedShell>
    </>
  );
}

function UnauthenticatedShell({
  children,
  showCommandDialog,
}: {
  children: ReactNode;
  showCommandDialog: boolean;
}) {
  const screenType = useScreenStore(state => state.screenType);
  const { navigationType, navigationView } = useNavigationStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const { t } = useTranslation();
  const navigationItems = useMemo(() => createNavItemsUnauthenticated(navigate, t), [navigate, t]);
  const secondaryNavItems = useMemo(() => {
    if (isLandingPath(pathname)) return createLandingSecondaryNavItems(navigate, t);
    return createEntitySecondaryNavItemsUnauthenticated(pathname, navigate, t);
  }, [navigate, pathname, t]);
  const isSecondaryNavVisible =
    Boolean(secondaryNavItems) && ['secondary', 'combined'].includes(navigationType);
  const secondaryNavCount = secondaryNavItems?.length ?? 0;
  const pageFrame = getUnauthenticatedPageFrame(pathname);

  return (
    <I18nSyncProvider>
      <SecondaryNavigationVisibleContext.Provider
        value={isSecondaryNavVisible && secondaryNavCount > 0}
      >
        <div
          className={`bg-background min-h-screen ${isCityDesignCanvasPath(pathname) ? 'flow-root' : ''}`}
        >
          {['primary', 'combined'].includes(navigationType) && (
            <DynamicNavigation
              navigationType="primary"
              navigationView={navigationView}
              navigationItems={navigationItems}
              screenType={screenType}
            />
          )}
          {secondaryNavItems && ['secondary', 'combined'].includes(navigationType) && (
            <DynamicNavigation
              navigationType="secondary"
              navigationView={navigationView}
              navigationItems={secondaryNavItems}
              screenType={screenType}
            />
          )}
          <main
            className={`transition-[margin,transform,opacity] duration-[var(--motion-duration-slow)] ease-[var(--motion-ease-soft)] ${getAppShellResponsiveClasses(
              { screenType, navigationView, isSecondaryNavVisible }
            )}`}
          >
            <PageFrame frame={pageFrame}>
              <MotionPage>{children}</MotionPage>
            </PageFrame>
          </main>
          {showCommandDialog && (
            <Suspense fallback={null}>
              <NavigationCommandDialog
                primaryNavItems={navigationItems}
                secondaryNavItems={secondaryNavItems}
              />
            </Suspense>
          )}
          <AlphaWarningDialog />
        </div>
      </SecondaryNavigationVisibleContext.Provider>
    </I18nSyncProvider>
  );
}
