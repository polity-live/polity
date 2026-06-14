import type { NavigationType, ScreenType } from '@/features/navigation/types/navigation.types.tsx';

import { useNavigationDemoController } from './useNavigationDemoController';
import { NavigationDemoView } from './NavigationDemoView';

export function NavigationDemo({
  onScreenTypeChange,
  onPriorityChange,
}: {
  onScreenTypeChange?: (screenType: ScreenType) => void;
  onPriorityChange?: (priority: NavigationType) => void;
}) {
  const viewProps = useNavigationDemoController({ onScreenTypeChange, onPriorityChange });

  return <NavigationDemoView {...viewProps} />;
}
