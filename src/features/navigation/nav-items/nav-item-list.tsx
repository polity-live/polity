import type {
  NavigationItem,
  NavigationView,
} from '@/features/navigation/types/navigation.types.tsx';
import React, { useState } from 'react';
import { useLocation, useRouterState } from '@tanstack/react-router';
import { NavItemListView } from './NavItemListView';
export function NavItemList({
  navigationItems,
  isMobile,
  isPrimary,
  navigationView,
}: {
  navigationItems: NavigationItem[];
  isMobile: boolean;
  isPrimary: boolean;
  navigationView: NavigationView;
}) {
  const { pathname, hash } = useLocation();
  const isRouterPending = useRouterState({ select: s => s.status === 'pending' });
  const normalizedHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  const currentRoute = `${pathname ?? '/'}${normalizedHash}`;
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  // Clear loading state when router finishes navigating
  React.useEffect(() => {
    if (!isRouterPending && loadingItem) {
      setLoadingItem(null);
    }
  }, [isRouterPending, loadingItem]);

  const handleItemClick = (item: NavigationItem) => {
    setLoadingItem(item.id);
    if (item.onClick) {
      item.onClick();
    }
    setHoveredItem(null);
  };
  return (
    <NavItemListView
      navigationItems={navigationItems}
      isMobile={isMobile}
      isPrimary={isPrimary}
      navigationView={navigationView}
      pathname={pathname}
      hash={hash}
      isRouterPending={isRouterPending}
      normalizedHash={normalizedHash}
      currentRoute={currentRoute}
      hoveredItem={hoveredItem}
      setHoveredItem={setHoveredItem}
      loadingItem={loadingItem}
      setLoadingItem={setLoadingItem}
      handleItemClick={handleItemClick}
    />
  );
}
