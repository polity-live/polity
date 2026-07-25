import { cn } from '@/features/shared/utils/utils.ts';
import { StateSwitcher } from '@/features/navigation/toggles/state-switcher.tsx';
import { NavItemList } from '@/features/navigation/nav-items/nav-item-list.tsx';
import { NavUserAvatar } from '@/features/navigation/nav-items/nav-user-avatar.tsx';
import { Separator } from '@/features/shared/ui/ui/separator.tsx';
import type { NavigationProps } from '@/features/navigation/types/navigation.types.tsx';
import {
  getDesktopNavigationVisibilityClasses,
  getListNavigationContainerClasses,
  getListNavigationContentClasses,
  getMobileNavigationVisibilityClasses,
} from './responsive-navigation-layout';

export function AsButtonListNavigation({
  navigationItems,
  navigationType,
  isMobile,
  navigationView,
  screenType,
}: Omit<NavigationProps, 'navigationView'> & { navigationView: 'asButtonList' }) {
  const isPrimary = navigationType === 'primary';

  return (
    <div
      data-navigation-type={navigationType}
      data-navigation-view={navigationView}
      data-screen-type={screenType}
      className={getListNavigationContainerClasses({
        navigationType,
        navigationView,
        screenType,
      })}
    >
      <div className={getListNavigationContentClasses({ navigationView, screenType })}>
        <NavItemList
          navigationItems={navigationItems}
          isMobile={isMobile}
          isPrimary={isPrimary}
          navigationView={navigationView}
          screenType={screenType}
        />
      </div>

      {isPrimary && (
        <div
          className={cn('shrink-0 items-center', getMobileNavigationVisibilityClasses(screenType))}
        >
          <Separator orientation="vertical" className="mx-2 h-8" />
          <NavUserAvatar navigationView="asButtonList" isMobile />
          <div className="flex items-center gap-2 px-2">
            <StateSwitcher isMobile navigationType={navigationType} />
          </div>
        </div>
      )}

      {isPrimary && (
        <div
          className={cn(
            'shrink-0 flex-col items-center gap-2 border-t p-2',
            getDesktopNavigationVisibilityClasses(screenType)
          )}
        >
          <NavUserAvatar isMobile={false} navigationView="asButtonList" />
          <div className="flex flex-col items-center gap-2">
            <StateSwitcher isMobile={false} navigationType={navigationType} />
          </div>
        </div>
      )}
    </div>
  );
}
