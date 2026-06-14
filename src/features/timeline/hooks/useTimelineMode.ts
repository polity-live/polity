'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * Timeline mode types
 * - timeline: Shows the civic timeline around the user
 * - decisions: Bloomberg-style terminal for active votes and elections
 */
export type TimelineMode = 'timeline' | 'decisions';

const STORAGE_KEY = 'polity:timeline-mode';

/**
 * Hook to manage the active timeline mode with localStorage persistence
 *
 * @returns Object with current mode and functions to change it
 *
 * @example
 * ```tsx
 * const { mode, setMode, toggleMode } = useTimelineMode();
 *
 * return (
 *   <div>
 *     Use shared Button controls to call setMode('timeline') or setMode('decisions').
 *   </div>
 * );
 * ```
 */
export function normalizeTimelineMode(value: string | null | undefined): TimelineMode | null {
  if (value === 'timeline') return 'timeline';
  if (value === 'subscribed') return 'timeline';
  if (value === 'decisions') return 'decisions';
  return null;
}

export function useTimelineMode(defaultMode: TimelineMode = 'timeline') {
  // Initialize from localStorage if available
  const [mode, setModeState] = useState<TimelineMode>(() => {
    if (typeof window === 'undefined') {
      return defaultMode;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const normalizedStoredMode = normalizeTimelineMode(stored);
      if (normalizedStoredMode) {
        return normalizedStoredMode;
      }
    } catch {
      // Ignore localStorage errors (private browsing, etc.)
    }

    return defaultMode;
  });

  // Persist mode changes to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore localStorage errors
    }
  }, [mode]);

  /**
   * Set the timeline mode directly
   */
  const setMode = useCallback((newMode: TimelineMode) => {
    setModeState(newMode);
  }, []);

  /**
   * Toggle between modes in order: timeline -> decisions -> timeline
   */
  const toggleMode = useCallback(() => {
    setModeState(current => {
      switch (current) {
        case 'timeline':
          return 'decisions';
        case 'decisions':
          return 'timeline';
        default:
          return 'timeline';
      }
    });
  }, []);

  /**
   * Check if the current mode matches the given mode
   */
  const isMode = useCallback((checkMode: TimelineMode) => mode === checkMode, [mode]);

  /**
   * Check if in timeline mode
   */
  const isTimelineMode = mode === 'timeline';

  /**
   * Check if in decisions (terminal) mode
   */
  const isDecisionsMode = mode === 'decisions';

  return {
    mode,
    setMode,
    toggleMode,
    isMode,
    isTimelineMode,
    isSubscribedMode: isTimelineMode,
    isDecisionsMode,
  };
}

export default useTimelineMode;
