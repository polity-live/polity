import type {
  NavigationType,
  NavigationView,
  ScreenType,
} from '@/features/navigation/types/navigation.types';

export function getMobileNavigationVisibilityClasses(screenType: ScreenType): string {
  if (screenType === 'mobile') return 'flex';
  if (screenType === 'desktop') return 'hidden';
  return 'flex md:hidden';
}

export function getDesktopNavigationVisibilityClasses(screenType: ScreenType): string {
  if (screenType === 'mobile') return 'hidden';
  if (screenType === 'desktop') return 'flex';
  return 'hidden md:flex';
}

export function getListNavigationContainerClasses({
  navigationType,
  navigationView,
  screenType,
}: {
  navigationType: NavigationType;
  navigationView: Extract<NavigationView, 'asButtonList' | 'asLabeledButtonList'>;
  screenType: ScreenType;
}): string {
  const isPrimary = navigationType === 'primary';
  const desktopWidth = navigationView === 'asButtonList' ? 'md:w-16' : 'md:w-64';
  const fixedDesktopWidth = navigationView === 'asButtonList' ? 'w-16' : 'w-64';

  if (screenType === 'mobile') {
    return isPrimary
      ? 'bg-background fixed right-0 bottom-0 left-0 z-40 flex items-center border-t py-2'
      : 'bg-background fixed top-0 right-0 left-0 z-40 flex items-center border-b py-2';
  }

  if (screenType === 'desktop') {
    return isPrimary
      ? `bg-background fixed top-0 bottom-0 left-0 z-40 flex ${fixedDesktopWidth} flex-col border-r`
      : `bg-background fixed top-0 right-0 bottom-0 z-40 flex ${fixedDesktopWidth} flex-col border-l`;
  }

  return isPrimary
    ? `bg-background fixed right-0 bottom-0 left-0 z-40 flex items-center border-t py-2 md:top-0 md:right-auto md:bottom-0 md:flex-col md:items-stretch md:border-t-0 md:border-r md:py-0 ${desktopWidth}`
    : `bg-background fixed top-0 right-0 left-0 z-40 flex items-center border-b py-2 md:bottom-0 md:left-auto md:flex-col md:items-stretch md:border-b-0 md:border-l md:py-0 ${desktopWidth}`;
}

export function getListNavigationContentClasses({
  navigationView,
  screenType,
}: {
  navigationView: Extract<NavigationView, 'asButtonList' | 'asLabeledButtonList'>;
  screenType: ScreenType;
}): string {
  if (screenType === 'mobile') return 'min-w-0 flex-1 overflow-hidden';
  if (screenType === 'desktop') {
    return navigationView === 'asButtonList'
      ? 'scrollbar-hide min-h-0 w-full flex-1 overflow-y-auto py-4'
      : 'scrollbar-hide min-h-0 w-full flex-1 overflow-y-auto p-4';
  }
  return navigationView === 'asButtonList'
    ? 'min-w-0 flex-1 overflow-hidden md:scrollbar-hide md:min-h-0 md:w-full md:overflow-y-auto md:py-4'
    : 'min-w-0 flex-1 overflow-hidden md:scrollbar-hide md:min-h-0 md:w-full md:overflow-y-auto md:p-4';
}
