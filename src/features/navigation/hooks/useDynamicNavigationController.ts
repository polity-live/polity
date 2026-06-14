import { useScreenStore } from '@/features/shared/global-state/screen.store.tsx';
import type { ScreenType } from '@/features/navigation/types/navigation.types.tsx';

export function useDynamicNavigationController(screenType: ScreenType) {
  const isMobile = useScreenStore(state => state.isMobileScreen);

  return {
    isMobileDevice: screenType === 'mobile' || (screenType === 'automatic' && isMobile),
  };
}
