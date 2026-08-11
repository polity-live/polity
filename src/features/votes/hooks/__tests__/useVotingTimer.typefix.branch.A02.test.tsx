/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSyncedVotingTimer, useVotingTimer } from '../useVotingTimer';

describe('voting timer post-typefix cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T10:00:00Z'));
    vi.spyOn(globalThis, 'setInterval').mockReturnValue(0 as unknown as NodeJS.Timeout);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('cleans up a local timer whose host returned a falsy interval handle', () => {
    const timer = renderHook(() => useVotingTimer({ autoStart: true, initialDuration: 5 }));
    expect(timer.result.current.isRunning).toBe(true);
    timer.unmount();
  });

  it('cleans up a synced timer whose host returned a falsy interval handle', () => {
    const timer = renderHook(() => useSyncedVotingTimer(Date.now(), 5));
    expect(timer.result.current.isRunning).toBe(true);
    timer.unmount();
  });
});
