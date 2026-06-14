import { useEffect, useState } from 'react';

import { useNavigationStore } from '@/features/navigation/state/navigation.store.tsx';
import type {
  NavigationType,
  NavigationView,
} from '@/features/navigation/types/navigation.types.tsx';

export function useStateSwitcherController({
  navigationType,
}: {
  isMobile: boolean;
  navigationType: NavigationType;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { navigationView, setNavigationView } = useNavigationStore();

  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const clearHoverTimeout = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
  };

  const openDropdownAfterDelay = () => {
    clearHoverTimeout();
    const timeout = setTimeout(() => {
      setIsDropdownOpen(true);
    }, 200);
    setHoverTimeout(timeout);
  };

  const closeDropdownAfterDelay = () => {
    clearHoverTimeout();
    const timeout = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 300);
    setHoverTimeout(timeout);
  };

  const openExpandedAfterDelay = () => {
    clearHoverTimeout();
    const timeout = setTimeout(() => {
      setIsExpanded(true);
    }, 200);
    setHoverTimeout(timeout);
  };

  const closeExpandedAfterDelay = () => {
    clearHoverTimeout();
    const timeout = setTimeout(() => {
      setIsExpanded(false);
    }, 300);
    setHoverTimeout(timeout);
  };

  return {
    navigationView,
    isPrimary: navigationType === 'primary',
    isExpanded,
    isDropdownOpen,
    setIsExpanded,
    setIsDropdownOpen,
    setNavigationView,
    onMobileTriggerMouseEnter: openDropdownAfterDelay,
    onMobileMenuMouseEnter: () => {
      clearHoverTimeout();
      setIsDropdownOpen(true);
    },
    onMobileMenuMouseLeave: closeDropdownAfterDelay,
    onDesktopTriggerMouseEnter: openExpandedAfterDelay,
    onDesktopMenuMouseEnter: () => {
      clearHoverTimeout();
      setIsExpanded(true);
    },
    onDesktopMenuMouseLeave: closeExpandedAfterDelay,
    onMobileStateChange: (newState: NavigationView) => {
      setNavigationView(newState);
      setIsDropdownOpen(false);
    },
    onDesktopStateChange: (newState: NavigationView) => {
      setNavigationView(newState);
      setIsExpanded(false);
    },
  };
}
