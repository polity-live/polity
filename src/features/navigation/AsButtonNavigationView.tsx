import { Home } from 'lucide-react';

import { NavItemList } from '@/features/navigation/nav-items/nav-item-list.tsx';
import { NavUserAvatar } from '@/features/navigation/nav-items/nav-user-avatar.tsx';
import { StateSwitcher } from '@/features/navigation/toggles/state-switcher.tsx';
import type { NavigationProps } from '@/features/navigation/types/navigation.types.tsx';
import { FloatingNavigationButton, NavigationCloseButton } from '@/features/shared/ui/navigation';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AsButtonNavigationViewProps extends NavigationProps {
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onToggleExpanded: () => void;
}

export function AsButtonNavigationView({
  navigationItems,
  navigationView,
  navigationType,
  isMobile,
  screenType,
  isExpanded,
  onExpand,
  onCollapse,
  onToggleExpanded,
}: AsButtonNavigationViewProps) {
  const isPrimary = navigationType === 'primary';

  return (
    <>
      {!isExpanded && (
        <FloatingNavigationButton
          data-action-id="navigation.overlay.open"
          side={isPrimary ? 'left' : 'right'}
          isExpanded={isExpanded}
          onExpand={onExpand}
          onToggleExpanded={onToggleExpanded}
          icon={<Home className="h-6 w-6" />}
        />
      )}

      {isExpanded && (
        <div
          data-tutorial-anchor={`${navigationType}-navigation`}
          className="bg-background/95 fixed inset-0 z-50 backdrop-blur-sm"
          onMouseLeave={onCollapse}
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label={translateText('navigation.toggles.state.closeNavigation')}
            onClick={onCollapse}
            data-action-id="navigation.overlay.backdrop.close"
          />
          <NavigationCloseButton
            side={isPrimary ? 'right' : 'left'}
            onClose={onCollapse}
            data-action-id="navigation.overlay.close"
          />
          <div className="relative flex h-full items-center justify-center">
            <div className="flex w-full max-w-3xl flex-col items-center px-6">
              <NavItemList
                navigationItems={navigationItems}
                isMobile={isMobile}
                isPrimary={isPrimary}
                navigationView={navigationView}
                screenType={screenType}
              />
              {isPrimary && (
                <NavUserAvatar className="mt-8" navigationView="asButton" isMobile={isMobile} />
              )}
            </div>
          </div>
          {isPrimary && <StateSwitcher isMobile={isMobile} navigationType={navigationType} />}
        </div>
      )}
    </>
  );
}
