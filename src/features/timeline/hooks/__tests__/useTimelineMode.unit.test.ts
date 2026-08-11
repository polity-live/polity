// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    expect(normalizeTimelineMode(null)).toBeNull();
    expect(normalizeTimelineMode(undefined)).toBeNull();
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

  it('uses the fallback for invalid storage and tolerates storage failures', () => {
    localStorage.setItem('polity:timeline-mode', 'invalid');
    const { result } = renderHook(() => useTimelineMode('decisions'));
    expect(result.current.mode).toBe('decisions');

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const fallback = renderHook(() => useTimelineMode('timeline'));
    expect(fallback.result.current.mode).toBe('timeline');
    getItem.mockRestore();

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => renderHook(() => useTimelineMode())).not.toThrow();
    setItem.mockRestore();
  });

  it('sets, toggles, and checks both supported modes', () => {
    const { result } = renderHook(() => useTimelineMode());
    expect(result.current.isMode('timeline')).toBe(true);
    act(() => result.current.toggleMode());
    expect(result.current).toMatchObject({ mode: 'decisions', isDecisionsMode: true });
    act(() => result.current.toggleMode());
    expect(result.current).toMatchObject({ mode: 'timeline', isTimelineMode: true });
    act(() => result.current.setMode('decisions'));
    expect(result.current.isMode('timeline')).toBe(false);
  });

  it('uses the supplied default during server rendering', () => {
    const browserWindow = window;
    vi.stubGlobal('window', undefined);
    let renderedMode = '';
    function Probe() {
      renderedMode = useTimelineMode('decisions').mode;
      return null;
    }
    renderToString(createElement(Probe));
    vi.stubGlobal('window', browserWindow);
    expect(renderedMode).toBe('decisions');
  });
});
