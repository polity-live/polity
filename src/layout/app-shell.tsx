import { type CSSProperties, type ReactNode, useMemo } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Toaster } from '@/features/shared/ui/ui/sonner.tsx';
import { DynamicNavigation } from '@/features/navigation/dynamic-navigation.tsx';
import { NavigationCommandDialog } from '@/features/navigation/command-dialog.tsx';
import {
  useScreenResponsiveDetector,
  useScreenStore,
} from '@/features/shared/global-state/screen.store.tsx';
import { useNavigationStore } from '@/features/navigation/state/navigation.store.tsx';
import { useThemeInitializer } from '@/features/shared/global-state/theme.store.tsx';
import { I18nSyncProvider } from '@/i18n/i18n-sync-provider.tsx';
import { PwaInstallProvider } from '@/features/pwa/hooks/usePwaInstallPrompt.ts';
import { AlphaWarningDialog } from '@/features/shared/ui/AlphaWarningDialog.tsx';
import type {
  NavigationItem,
  NavigationType,
  NavigationView,
} from '@/features/navigation/types/navigation.types.tsx';
import { useNavigation } from '@/features/navigation/state/useNavigation.tsx';
import { useAuth } from '@/providers/auth-provider.tsx';
import { useZeroReady } from '@/providers/zero-provider.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import {
  createDocsSecondaryNavItems,
  createLandingSecondaryNavItems,
  createNavItemsUnauthenticated,
} from '@/features/navigation/nav-items/nav-items-unauthenticated.tsx';
import { usePreferenceSync } from '@/zero/preferences/usePreferenceSync.ts';
import { useNotificationDispatch } from '@/features/notifications/hooks/useNotificationDispatch.ts';
import { useBrowserNotifications } from '@/features/notifications/hooks/useBrowserNotifications.ts';
import { useToastSettingsSync } from '@/features/notifications/hooks/useToastSettingsSync.ts';
import { MotionPage } from '@/features/shared/motion';
import {
  PrioritizedPreloadProvider,
  useGlobalZeroPreloads,
  usePrimaryRouteIdlePreloads,
  useVisiblePreloadRoutes,
} from '@/zero/preloads';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation.ts';
import { isItemActive } from '@/features/navigation/nav-items/nav-helpers.ts';
import {
  APP_SHELL_PAGE_FRAME_CLASS,
  getAuthenticatedPageFrame,
  getUnauthenticatedPageFrame,
  isLandingPath,
  type AppShellPageFrame,
} from './app-shell-layout';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <PwaInstallProvider />
      <AppShellInner>{children}</AppShellInner>
    </>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  useThemeInitializer({ defaultTheme: 'system', storageKey: 'theme' });
  useScreenResponsiveDetector();

  const { user } = useAuth();
  const zeroReady = useZeroReady();

  if (user && zeroReady) {
    return (
      <PrioritizedPreloadProvider>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </PrioritizedPreloadProvider>
    );
  }

  return <UnauthenticatedShell>{children}</UnauthenticatedShell>;
}

function UnauthenticatedShell({ children }: { children: ReactNode }) {
  const { screenType, isMobileScreen } = useScreenStore();
  const { navigationType, navigationView } = useNavigationStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { t } = useTranslation();

  const navigationItems = useMemo(() => createNavItemsUnauthenticated(navigate, t), [navigate, t]);
  const secondaryNavItems = useMemo(() => {
    if (isLandingPath(pathname)) {
      return createLandingSecondaryNavItems(navigate, t);
    }

    if (pathname.startsWith('/docs')) {
      return createDocsSecondaryNavItems(navigate, t);
    }

    return null;
  }, [navigate, pathname, t]);
  const isMobile = screenType === 'mobile' || (screenType === 'automatic' && isMobileScreen);
  const isSecondaryNavVisible =
    Boolean(secondaryNavItems) && ['secondary', 'combined'].includes(navigationType);
  const shellOffsets = getMobileShellOffsets({
    isMobile,
    navigationView,
    isSecondaryNavVisible,
  });
  const mainStyle = getMainStyleWithShellOffsets(shellOffsets);
  const pageFrame = getUnauthenticatedPageFrame(pathname);

  return (
    <I18nSyncProvider>
      <div className="bg-background min-h-screen">
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
          style={mainStyle}
          className={`transition-[margin,transform,opacity] duration-[var(--motion-duration-slow)] ease-[var(--motion-ease-soft)] ${getMarginClasses(
            {
              isMobile,
              navigationView,
              navigationType,
              secondaryNavItems,
            }
          )}`}
        >
          <PageFrame frame={pageFrame}>
            <MotionPage>{children}</MotionPage>
          </PageFrame>
        </main>

        <NavigationCommandDialog
          primaryNavItems={navigationItems}
          secondaryNavItems={secondaryNavItems}
        />

        <Toaster richColors position="top-right" />
        <AlphaWarningDialog />
      </div>
    </I18nSyncProvider>
  );
}

function isEntitySecondarySwipeRoute(pathname: string): boolean {
  return /^\/(?:group|user|amendment|event|blog)\/[^/]+/.test(pathname);
}

function isAgendaKeyboardNavigationRoute(pathname: string): boolean {
  return /^\/event\/[^/]+\/agenda(?:\/|$)/.test(pathname);
}

function findActiveNavigationItemIndex(
  navigationItems: NavigationItem[],
  currentRoute: string,
  isPrimary: boolean
): number {
  const activeIndex = navigationItems.findIndex(item =>
    isItemActive(item, currentRoute, isPrimary)
  );

  if (activeIndex !== -1) {
    return activeIndex;
  }

  let bestIndex = -1;
  let bestLength = -1;

  navigationItems.forEach((item, index) => {
    if (!item.href) {
      return;
    }

    const isNestedMatch = currentRoute === item.href || currentRoute.startsWith(`${item.href}/`);
    if (isNestedMatch && item.href.length > bestLength) {
      bestIndex = index;
      bestLength = item.href.length;
    }
  });

  return bestIndex;
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  usePreferenceSync();
  useNotificationDispatch();
  useBrowserNotifications();
  useToastSettingsSync();
  useGlobalZeroPreloads();
  usePrimaryRouteIdlePreloads();
  const navigate = useNavigate();
  const { screenType, isMobileScreen } = useScreenStore();
  const { navigationType, navigationView } = useNavigationStore();
  const { primaryNavItems, secondaryNavItems } = useNavigation();
  useVisiblePreloadRoutes(
    (secondaryNavItems ?? []).flatMap(item => (item.href ? [item.href] : []))
  );
  const pathname = useRouterState({ select: s => s.location.pathname });

  const isMobile = screenType === 'mobile' || (screenType === 'automatic' && isMobileScreen);
  const isFullscreenOnboarding = pathname === '/';
  const pageFrame = getAuthenticatedPageFrame(pathname);
  const isSecondaryNavVisible =
    Boolean(secondaryNavItems) && ['secondary', 'combined'].includes(navigationType);
  const shellOffsets = getMobileShellOffsets({
    isMobile,
    navigationView,
    isSecondaryNavVisible,
  });
  const mainStyle = getMainStyleWithShellOffsets(shellOffsets);
  const secondaryItems = secondaryNavItems ?? [];
  const activeSecondaryIndex = findActiveNavigationItemIndex(secondaryItems, pathname, false);
  const isSecondarySwipeEnabled =
    isSecondaryNavVisible &&
    isEntitySecondarySwipeRoute(pathname) &&
    secondaryItems.length > 1 &&
    activeSecondaryIndex !== -1;
  const goToSecondaryItem = (offset: number) => {
    const target = secondaryItems[activeSecondaryIndex + offset];
    if (!target) {
      return;
    }

    if (target.onClick) {
      target.onClick();
      return;
    }

    if (target.href) {
      navigate({ to: target.href } as never);
    }
  };
  const { handlers: secondarySwipeHandlers } = useSwipeNavigation({
    enabled: isSecondarySwipeEnabled,
    canSwipePrev: activeSecondaryIndex > 0,
    canSwipeNext: activeSecondaryIndex >= 0 && activeSecondaryIndex < secondaryItems.length - 1,
    onSwipePrev: () => goToSecondaryItem(-1),
    onSwipeNext: () => goToSecondaryItem(1),
    keyboardMode: isAgendaKeyboardNavigationRoute(pathname) ? 'off' : 'global',
  });

  if (isFullscreenOnboarding) {
    return (
      <I18nSyncProvider>
        <div className="bg-background min-h-screen">
          <main className="min-h-screen">
            <MotionPage>{children}</MotionPage>
          </main>

          <Toaster richColors position="top-right" />
          <AlphaWarningDialog />
        </div>
      </I18nSyncProvider>
    );
  }

  return (
    <I18nSyncProvider>
      <div className="bg-background min-h-screen">
        {['primary', 'combined'].includes(navigationType) && (
          <DynamicNavigation
            navigationType="primary"
            navigationView={navigationView}
            navigationItems={primaryNavItems}
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
          style={mainStyle}
          className={`transition-[margin,transform,opacity] duration-[var(--motion-duration-slow)] ease-[var(--motion-ease-soft)] ${getMarginClasses(
            {
              isMobile,
              navigationView,
              navigationType,
              secondaryNavItems,
            }
          )}`}
          {...secondarySwipeHandlers}
        >
          <PageFrame frame={pageFrame}>
            <MotionPage>{children}</MotionPage>
          </PageFrame>
        </main>

        <NavigationCommandDialog
          primaryNavItems={primaryNavItems}
          secondaryNavItems={secondaryNavItems}
        />

        <Toaster richColors position="top-right" />
        <AlphaWarningDialog />
      </div>
    </I18nSyncProvider>
  );
}

function PageFrame({ children, frame }: { children: ReactNode; frame: AppShellPageFrame }) {
  if (frame === 'bare') {
    return <>{children}</>;
  }

  return <div className={APP_SHELL_PAGE_FRAME_CLASS[frame]}>{children}</div>;
}

function getMarginClasses({
  isMobile,
  navigationView,
  navigationType,
  secondaryNavItems,
}: {
  isMobile: boolean;
  navigationView: NavigationView;
  navigationType: NavigationType;
  secondaryNavItems: NavigationItem[] | null;
}) {
  const isSecondaryNavVisible =
    secondaryNavItems &&
    secondaryNavItems.length > 0 &&
    ['secondary', 'combined'].includes(navigationType);

  const marginLeft = getMarginLeftForPrimaryDesktop({ isMobile, navigationView });
  const marginRight = getMarginRightForSecondaryDesktop({
    isMobile,
    state: navigationView,
    isSecondaryNavVisible,
  });
  const marginTop = getMarginTopForSecondaryMobile({
    isMobile,
    navigationView,
    isSecondaryNavVisible,
  });
  const marginBottom = getMarginBottomForPrimaryMobile({ isMobile, navigationView });

  return [marginLeft, marginRight, marginTop, marginBottom].filter(Boolean).join(' ');
}

function getMarginLeftForPrimaryDesktop({
  isMobile,
  navigationView,
}: {
  isMobile: boolean;
  navigationView: NavigationView;
}): string {
  if (isMobile) return '';
  if (navigationView === 'asButton') return '';
  if (navigationView === 'asButtonList') return 'ml-16';
  if (navigationView === 'asLabeledButtonList') return 'ml-64';
  return '';
}

function getMarginRightForSecondaryDesktop({
  isMobile,
  state,
  isSecondaryNavVisible,
}: {
  isMobile: boolean;
  state: NavigationView;
  isSecondaryNavVisible: boolean | null;
}): string {
  if (isMobile) return '';
  if (state === 'asButton') return '';
  if (state === 'asButtonList' && isSecondaryNavVisible) return 'mr-16';
  if (state === 'asLabeledButtonList' && isSecondaryNavVisible) return 'mr-64';
  return '';
}

function getMarginTopForSecondaryMobile({
  isMobile,
  navigationView,
  isSecondaryNavVisible,
}: {
  isMobile: boolean;
  navigationView: NavigationView;
  isSecondaryNavVisible: boolean | null;
}): string {
  if (!isMobile || !isSecondaryNavVisible) return '';
  if (navigationView === 'asButtonList') return 'mt-16';
  if (navigationView === 'asLabeledButtonList') return 'mt-20';
  return '';
}

function getMarginBottomForPrimaryMobile({
  isMobile,
  navigationView,
}: {
  isMobile: boolean;
  navigationView: NavigationView;
}): string {
  if (!isMobile) return '';
  if (navigationView === 'asButtonList') return 'mb-16';
  if (navigationView === 'asLabeledButtonList') return 'mb-20';
  return '';
}

function getMobileShellOffsets({
  isMobile,
  navigationView,
  isSecondaryNavVisible,
}: {
  isMobile: boolean;
  navigationView: NavigationView;
  isSecondaryNavVisible: boolean;
}): {
  topRem: number;
  bottomRem: number;
} {
  if (!isMobile) {
    return { topRem: 0, bottomRem: 0 };
  }

  const navHeightRem =
    navigationView === 'asLabeledButtonList' ? 5 : navigationView === 'asButtonList' ? 4 : 0;

  return {
    topRem: isSecondaryNavVisible ? navHeightRem : 0,
    bottomRem: navHeightRem,
  };
}

function getMainStyleWithShellOffsets({
  topRem,
  bottomRem,
}: {
  topRem: number;
  bottomRem: number;
}): CSSProperties {
  return {
    '--app-shell-mobile-top-offset': `${topRem}rem`,
    '--app-shell-mobile-bottom-offset': `${bottomRem}rem`,
  } as CSSProperties;
}
