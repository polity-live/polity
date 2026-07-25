import type { NavigationView, ScreenType } from '@/features/navigation/types/navigation.types';

export type AppShellPageFrame = 'bare' | 'contained' | 'fullWidth' | 'messages' | 'uncontained';

const ENTITY_ROUTE_PATTERN = /^\/(?:group|user|event|amendment|blog)\/[^/]+(?:\/.*)?$/;

const UNCONTAINED_ENTITY_ROUTE_PATTERNS = [
  /^\/group\/[^/]+\/network$/,
  /^\/user\/[^/]+\/network$/,
  /^\/event\/[^/]+\/network$/,
];

export const APP_SHELL_PAGE_FRAME_CLASS: Record<Exclude<AppShellPageFrame, 'bare'>, string> = {
  contained: 'mx-auto max-w-7xl px-4 py-6 md:px-8',
  fullWidth: 'mx-auto px-4 py-6',
  messages:
    'mx-auto max-w-7xl px-4 pt-2 pb-6 [--app-shell-page-frame-y:2rem] md:px-8 md:py-6 md:[--app-shell-page-frame-y:3rem]',
  uncontained: 'p-2',
};

export function isLandingPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/features' ||
    pathname === '/solutions' ||
    pathname === '/imprint'
  );
}

export function getAuthenticatedPageFrame(pathname: string): AppShellPageFrame {
  if (pathname.startsWith('/docs')) {
    return 'bare';
  }

  if (isUncontainedEntityRoute(pathname)) {
    return 'uncontained';
  }

  if (pathname === '/messages') {
    return 'messages';
  }

  if (pathname === '/home' || pathname === '/search') {
    return 'fullWidth';
  }

  return 'contained';
}

export function getUnauthenticatedPageFrame(pathname: string): AppShellPageFrame {
  if (isUncontainedEntityRoute(pathname)) {
    return 'uncontained';
  }

  if (ENTITY_ROUTE_PATTERN.test(pathname)) {
    return 'contained';
  }

  return 'bare';
}

function isUncontainedEntityRoute(pathname: string): boolean {
  return UNCONTAINED_ENTITY_ROUTE_PATTERNS.some(pattern => pattern.test(pathname));
}

export function getAppShellResponsiveClasses({
  screenType,
  navigationView,
  isSecondaryNavVisible,
}: {
  screenType: ScreenType;
  navigationView: NavigationView;
  isSecondaryNavVisible: boolean;
}): string {
  if (navigationView === 'asButton') {
    return '[--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:0rem]';
  }

  if (screenType === 'desktop') {
    if (navigationView === 'asButtonList') {
      return isSecondaryNavVisible
        ? 'ml-16 mr-16 [--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:0rem]'
        : 'ml-16 [--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:0rem]';
    }
    return isSecondaryNavVisible
      ? 'ml-64 mr-64 [--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:0rem]'
      : 'ml-64 [--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:0rem]';
  }

  if (screenType === 'mobile') {
    if (navigationView === 'asButtonList') {
      return isSecondaryNavVisible
        ? 'mt-16 mb-16 [--app-shell-mobile-top-offset:4rem] [--app-shell-mobile-bottom-offset:4rem]'
        : 'mb-16 [--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:4rem]';
    }
    return isSecondaryNavVisible
      ? 'mt-20 mb-20 [--app-shell-mobile-top-offset:5rem] [--app-shell-mobile-bottom-offset:5rem]'
      : 'mb-20 [--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:5rem]';
  }

  if (navigationView === 'asButtonList') {
    return isSecondaryNavVisible
      ? 'mt-16 mb-16 md:mt-0 md:mb-0 md:ml-16 md:mr-16 [--app-shell-mobile-top-offset:4rem] [--app-shell-mobile-bottom-offset:4rem] md:[--app-shell-mobile-top-offset:0rem] md:[--app-shell-mobile-bottom-offset:0rem]'
      : 'mb-16 md:mb-0 md:ml-16 [--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:4rem] md:[--app-shell-mobile-bottom-offset:0rem]';
  }
  return isSecondaryNavVisible
    ? 'mt-20 mb-20 md:mt-0 md:mb-0 md:ml-64 md:mr-64 [--app-shell-mobile-top-offset:5rem] [--app-shell-mobile-bottom-offset:5rem] md:[--app-shell-mobile-top-offset:0rem] md:[--app-shell-mobile-bottom-offset:0rem]'
    : 'mb-20 md:mb-0 md:ml-64 [--app-shell-mobile-top-offset:0rem] [--app-shell-mobile-bottom-offset:5rem] md:[--app-shell-mobile-bottom-offset:0rem]';
}
