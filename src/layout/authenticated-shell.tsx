import type { ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { DynamicNavigation } from '@/features/navigation/dynamic-navigation.tsx';
import { NavigationCommandDialog } from '@/features/navigation/command-dialog.tsx';
import { useScreenStore } from '@/features/shared/global-state/screen.store.tsx';
import { useNavigationStore } from '@/features/navigation/state/navigation.store.tsx';
import { I18nSyncProvider } from '@/i18n/i18n-sync-provider.tsx';
import { AlphaWarningDialog } from '@/features/shared/ui/AlphaWarningDialog.tsx';
import type { NavigationItem } from '@/features/navigation/types/navigation.types.tsx';
import { useNavigation } from '@/features/navigation/state/useNavigation.tsx';
import { usePreferenceSync } from '@/zero/preferences/usePreferenceSync.ts';
import { useToastSettingsSync } from '@/features/notifications/hooks/useToastSettingsSync.ts';
import { MotionPage } from '@/features/shared/motion';
import {
  InternalLinkIntentPreloader,
  PrioritizedPreloadProvider,
  useGlobalZeroPreloads,
  usePrimaryRouteIdlePreloads,
  useVisiblePreloadRoutes,
} from '@/zero/preloads';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation.ts';
import { isItemActive } from '@/features/navigation/nav-items/nav-helpers.ts';
import { getAuthenticatedPageFrame, getAppShellResponsiveClasses } from './app-shell-layout';
import { PageFrame } from './page-frame';

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
  if (activeIndex !== -1) return activeIndex;

  let bestIndex = -1;
  let bestLength = -1;
  navigationItems.forEach((item, index) => {
    if (!item.href) return;
    const isNestedMatch = currentRoute === item.href || currentRoute.startsWith(`${item.href}/`);
    if (isNestedMatch && item.href.length > bestLength) {
      bestIndex = index;
      bestLength = item.href.length;
    }
  });
  return bestIndex;
}

export default function AuthenticatedShell({ children }: { children: ReactNode }) {
  usePreferenceSync();
  useToastSettingsSync();
  useGlobalZeroPreloads();
  usePrimaryRouteIdlePreloads();

  const navigate = useNavigate();
  const screenType = useScreenStore(state => state.screenType);
  const { navigationType, navigationView } = useNavigationStore();
  const { primaryNavItems, secondaryNavItems } = useNavigation();
  useVisiblePreloadRoutes(
    (secondaryNavItems ?? []).flatMap(item => (item.href ? [item.href] : []))
  );
  const pathname = useRouterState({ select: state => state.location.pathname });
  const isFullscreenOnboarding = pathname === '/';
  const pageFrame = getAuthenticatedPageFrame(pathname);
  const isSecondaryNavVisible =
    Boolean(secondaryNavItems) && ['secondary', 'combined'].includes(navigationType);
  const secondaryItems = secondaryNavItems ?? [];
  const activeSecondaryIndex = findActiveNavigationItemIndex(secondaryItems, pathname, false);
  const isSecondarySwipeEnabled =
    isSecondaryNavVisible &&
    isEntitySecondarySwipeRoute(pathname) &&
    secondaryItems.length > 1 &&
    activeSecondaryIndex !== -1;

  const goToSecondaryItem = (offset: number) => {
    const target = secondaryItems[activeSecondaryIndex + offset];
    if (target?.onClick) target.onClick();
    else if (target?.href) navigate({ to: target.href } as never);
  };

  const { handlers: secondarySwipeHandlers } = useSwipeNavigation({
    enabled: isSecondarySwipeEnabled,
    canSwipePrev: activeSecondaryIndex > 0,
    canSwipeNext: activeSecondaryIndex >= 0 && activeSecondaryIndex < secondaryItems.length - 1,
    onSwipePrev: () => goToSecondaryItem(-1),
    onSwipeNext: () => goToSecondaryItem(1),
    keyboardMode: isAgendaKeyboardNavigationRoute(pathname) ? 'off' : 'global',
  });

  const content = isFullscreenOnboarding ? (
    <div className="bg-background min-h-screen">
      <main className="min-h-screen">
        <MotionPage>{children}</MotionPage>
      </main>
      <AlphaWarningDialog />
    </div>
  ) : (
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
        className={`transition-[margin,transform,opacity] duration-[var(--motion-duration-slow)] ease-[var(--motion-ease-soft)] ${getAppShellResponsiveClasses(
          { screenType, navigationView, isSecondaryNavVisible }
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
      <AlphaWarningDialog />
    </div>
  );

  return (
    <PrioritizedPreloadProvider>
      <InternalLinkIntentPreloader />
      <I18nSyncProvider>{content}</I18nSyncProvider>
    </PrioritizedPreloadProvider>
  );
}
