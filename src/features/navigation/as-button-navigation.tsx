import type { NavigationProps } from '@/features/navigation/types/navigation.types.tsx';
import { useAsButtonNavigationController } from './hooks/useAsButtonNavigationController';
import { AsButtonNavigationView } from './AsButtonNavigationView';

export function AsButtonNavigation({
  navigationItems,
  navigationView,
  navigationType,
  isMobile,
}: NavigationProps) {
  return (
    <AsButtonNavigationView
      navigationItems={navigationItems}
      navigationView={navigationView}
      navigationType={navigationType}
      isMobile={isMobile}
      {...useAsButtonNavigationController()}
    />
  );
}
