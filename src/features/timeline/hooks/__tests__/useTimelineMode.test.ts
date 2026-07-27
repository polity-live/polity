// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  activateAppTutorialSession,
  deactivateAppTutorialSession,
} from '@/features/app-tutorial/events';
import { normalizeTimelineMode, useTimelineMode } from '../useTimelineMode';

afterEach(() => {
  deactivateAppTutorialSession();
  localStorage.clear();
});

describe('normalizeTimelineMode', () => {
  it('migrates the legacy subscribed mode to timeline', () => {
    expect(normalizeTimelineMode('subscribed')).toBe('timeline');
  });

  it('keeps supported timeline modes and rejects unknown values', () => {
    expect(normalizeTimelineMode('timeline')).toBe('timeline');
    expect(normalizeTimelineMode('decisions')).toBe('decisions');
    expect(normalizeTimelineMode('explore')).toBeNull();
  });

  it('opens the decision terminal during an active app tutorial session', () => {
    localStorage.setItem('polity:timeline-mode', 'timeline');
    activateAppTutorialSession();

    const { result } = renderHook(() => useTimelineMode());

    expect(result.current.mode).toBe('decisions');
  });

  it('keeps the persisted mode outside an app tutorial session', () => {
    localStorage.setItem('polity:timeline-mode', 'timeline');

    const { result } = renderHook(() => useTimelineMode('decisions'));

    expect(result.current.mode).toBe('timeline');
  });
});
