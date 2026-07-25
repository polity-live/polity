import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useEffect, useLayoutEffect } from 'react';
import type { ScreenType } from '@/features/navigation/types/navigation.types.tsx';

const MOBILE_BREAKPOINT = 768;
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface ScreenState {
  screenType: ScreenType;
  isMobileScreen: boolean;
}

interface ScreenActions {
  setScreenType: (screenType: ScreenType) => void;
  setIsMobile: (isMobile: boolean) => void;
}

// Create the screen store with zustand and immer
export const useScreenStore = create<ScreenState & ScreenActions>()(
  immer(set => ({
    // Initial state
    screenType: 'automatic',
    isMobileScreen: false,

    // Actions
    setScreenType: screenType => {
      set(state => {
        state.screenType = screenType;
      });
    },

    setIsMobile: mobile => {
      set(state => {
        state.isMobileScreen = mobile;
      });
    },
  }))
);

/**
 * Hook that initializes responsive screen detection
 * This should be used in your app's root component
 */
export function useScreenResponsiveDetector(): void {
  const setIsMobile = useScreenStore(state => state.setIsMobile);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);

    // Set initial value
    setIsMobile(mql.matches);

    // Subscribe to changes
    mql.addEventListener('change', onChange);

    // Cleanup on unmount
    return () => mql.removeEventListener('change', onChange);
  }, [setIsMobile]);
}
