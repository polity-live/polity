import { AsButtonNavigation } from '@/features/navigation/as-button-navigation.tsx';
import { AsButtonListNavigation } from '@/features/navigation/as-button-list-navigation.tsx';
import { AsLabeledButtonListNavigation } from '@/features/navigation/as-labeled-button-list-navigation.tsx';
import type {
  NavigationItem,
  NavigationType,
  NavigationView,
  ScreenType,
} from '@/features/navigation/types/navigation.types.tsx';

interface DynamicNavigationViewProps {
  navigationView: NavigationView;
  navigationType: NavigationType;
  navigationItems: NavigationItem[];
  isMobileDevice: boolean;
  screenType: ScreenType;
}

export function DynamicNavigationView({
  navigationView,
  navigationType,
  navigationItems,
  isMobileDevice,
  screenType,
}: DynamicNavigationViewProps) {
  if (navigationView === 'asButton') {
    return (
      <AsButtonNavigation
        navigationItems={navigationItems}
        navigationView={navigationView}
        navigationType={navigationType}
        isMobile={isMobileDevice}
        screenType={screenType}
      />
    );
  }

  if (navigationView === 'asButtonList') {
    return (
      <AsButtonListNavigation
        navigationItems={navigationItems}
        navigationView={navigationView}
        navigationType={navigationType}
        isMobile={isMobileDevice}
        screenType={screenType}
      />
    );
  }

  if (navigationView === 'asLabeledButtonList') {
    return (
      <AsLabeledButtonListNavigation
        navigationItems={navigationItems}
        navigationView={navigationView}
        navigationType={navigationType}
        isMobile={isMobileDevice}
        screenType={screenType}
      />
    );
  }

  return null;
}
