import { memo } from 'react';
import { useDynamicNavigationController } from '@/features/navigation/hooks/useDynamicNavigationController';
import { DynamicNavigationView } from './DynamicNavigationView';
import type {
  NavigationItem,
  NavigationView,
  NavigationType,
  ScreenType,
} from '@/features/navigation/types/navigation.types.tsx';

export const DynamicNavigation = memo(function DynamicNavigation({
  navigationView,
  navigationType,
  screenType,
  navigationItems,
}: {
  navigationView: NavigationView;
  navigationType: NavigationType;
  screenType: ScreenType;
  navigationItems: NavigationItem[];
}) {
  const { isMobileDevice } = useDynamicNavigationController(screenType);

  return (
    <DynamicNavigationView
      navigationItems={navigationItems}
      navigationType={navigationType}
      navigationView={navigationView}
      isMobileDevice={isMobileDevice}
      screenType={screenType}
    />
  );
});
