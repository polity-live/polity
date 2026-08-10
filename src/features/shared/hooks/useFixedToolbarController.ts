import { useNavigationStore } from '@/features/navigation/state/navigation.store.tsx';
import { useNavigation } from '@/features/navigation/state/useNavigation.tsx';
import { useIsMobileScreen } from '@/features/shared/hooks/useIsMobileScreen';
import { cn } from '@/features/shared/utils/utils.ts';

export function getFixedToolbarLayoutClasses({
  isMobileScreen,
  isSecondaryNavVisible,
  navigationView,
}: {
  isMobileScreen: boolean;
  isSecondaryNavVisible: boolean;
  navigationView: string;
}) {
  const getTopOffset = () => {
    if (!isMobileScreen || !isSecondaryNavVisible || navigationView === 'asButton') return 'top-0';

    if (navigationView === 'asButtonList') return 'top-16';
    if (navigationView === 'asLabeledButtonList') return 'top-20';

    return 'top-0';
  };

  const getLeftOffset = () => {
    if (isMobileScreen) return 'left-0';

    if (navigationView === 'asButtonList') return 'left-16';
    if (navigationView === 'asLabeledButtonList') return 'left-64';

    return 'left-0';
  };

  const getRightOffset = () => {
    if (isMobileScreen || !isSecondaryNavVisible) return 'right-0';

    if (navigationView === 'asButtonList') return 'right-16';
    if (navigationView === 'asLabeledButtonList') return 'right-64';

    return 'right-0';
  };

  const getWidth = () => {
    if (isMobileScreen) return 'w-full';

    let leftOffset = 0;
    let rightOffset = 0;

    if (navigationView === 'asButtonList') leftOffset = 64;
    if (navigationView === 'asLabeledButtonList') leftOffset = 256;

    if (isSecondaryNavVisible) {
      if (navigationView === 'asButtonList') rightOffset = 64;
      if (navigationView === 'asLabeledButtonList') rightOffset = 256;
    }

    const totalOffset = leftOffset + rightOffset;
    return totalOffset > 0 ? `w-[calc(100%-${totalOffset}px)]` : 'w-full';
  };

  return [getTopOffset(), getLeftOffset(), getRightOffset(), getWidth()] as const;
}

export function useFixedToolbarController(className?: string) {
  const { navigationView, navigationType } = useNavigationStore();
  const isMobileScreen = useIsMobileScreen();
  const { secondaryNavItems } = useNavigation();

  const isSecondaryNavVisible =
    secondaryNavItems &&
    secondaryNavItems.length > 0 &&
    ['secondary', 'combined'].includes(navigationType);

  const layoutClasses = getFixedToolbarLayoutClasses({
    isMobileScreen,
    isSecondaryNavVisible: Boolean(isSecondaryNavVisible),
    navigationView,
  });

  return {
    className: cn(
      'scrollbar-hide supports-backdrop-blur:bg-background/60 border-b-border bg-background/95 fixed z-50 justify-between overflow-x-auto border-b p-1 backdrop-blur-sm transition-all duration-300',
      ...layoutClasses,
      className
    ),
  };
}
