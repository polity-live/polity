import { useNavigationStore } from '@/features/navigation/state/navigation.store';
import { useNavigation } from '@/features/navigation/state/useNavigation';
import { useScreenStore } from '@/features/shared/global-state/screen.store';
import { getFixedToolbarLayoutClasses } from '@/features/shared/hooks/useFixedToolbarController';
import { cn } from '@/features/shared/utils/utils';

export function useFixedAgendaToolbarController(className?: string) {
  const { navigationView, navigationType } = useNavigationStore();
  const { isMobileScreen } = useScreenStore();
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
      'scrollbar-hide supports-backdrop-blur:bg-background/70 border-border/70 bg-background/95 fixed z-50 min-h-12 justify-between overflow-x-auto rounded-none border-x-0 border-t-0 border-b px-2 py-1.5 shadow-none backdrop-blur-md transition-all duration-300',
      ...layoutClasses,
      className
    ),
  };
}
