import { Home } from 'lucide-react';

import { NavItemList } from '@/features/navigation/nav-items/nav-item-list.tsx';
import { NavUserAvatar } from '@/features/navigation/nav-items/nav-user-avatar.tsx';
import { StateSwitcher } from '@/features/navigation/toggles/state-switcher.tsx';
import type { NavigationProps } from '@/features/navigation/types/navigation.types.tsx';
import { FloatingNavigationButton, NavigationCloseButton } from '@/features/shared/ui/navigation';

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
          side={isPrimary ? 'left' : 'right'}
          isExpanded={isExpanded}
          onExpand={onExpand}
          onToggleExpanded={onToggleExpanded}
          icon={<Home className="h-6 w-6" />}
        />
      )}

      {isExpanded && (
        <div
          className="bg-background/95 fixed inset-0 z-50 backdrop-blur-sm"
          onMouseLeave={onCollapse}
          onClick={onCollapse}
        >
          <NavigationCloseButton side={isPrimary ? 'right' : 'left'} onClose={onCollapse} />
          <div className="flex h-full items-center justify-center">
            <div className="flex w-full max-w-3xl flex-col items-center px-6">
              <NavItemList
                navigationItems={navigationItems}
                isMobile={isMobile}
                isPrimary={isPrimary}
                navigationView={navigationView}
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
