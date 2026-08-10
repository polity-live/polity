/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCountdownTimerController, useEndedAgoController } from '../useCountdownTimerController';

const mocks = vi.hoisted(() => ({ language: 'en' }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => (options?.time ? `${key}:${options.time}` : key),
    i18n: { language: mocks.language },
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  mocks.language = 'en';
});

afterEach(() => vi.useRealTimers());

describe('useCountdownTimerController', () => {
  it.each([
    [0, 'normal'],
    [10 * 60, 'critical'],
    [30 * 60, 'urgent'],
    [2 * 60 * 60, 'closing'],
    [2 * 24 * 60 * 60, 'normal'],
  ])('classifies %s remaining seconds as %s', (seconds, urgency) => {
    const onExpire = vi.fn();
    const endsAt = new Date(Date.now() + seconds * 1_000);
    const { result, unmount } = renderHook(() =>
      useCountdownTimerController({
        endsAt,
        onExpire,
      })
    );
    expect(result.current.urgency).toBe(urgency);
    if (seconds === 0) expect(onExpire).toHaveBeenCalled();
    unmount();
  });

  it('ticks into expiry with German formatting and optional expiry callback absent', () => {
    mocks.language = 'de';
    const onExpire = vi.fn();
    const endsAt = new Date(Date.now() + 1_000);
    const { result, rerender } = renderHook(
      ({ callback }) => useCountdownTimerController({ endsAt, onExpire: callback }),
      { initialProps: { callback: onExpire as (() => void) | undefined } }
    );
    expect(result.current.timeRemaining.isExpired).toBe(false);
    act(() => vi.advanceTimersByTime(1_000));
    expect(onExpire).toHaveBeenCalled();
    rerender({ callback: undefined });
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.timeRemaining.isExpired).toBe(true);
  });
});

describe('useEndedAgoController', () => {
  it('formats German and English elapsed labels and refreshes on its interval', () => {
    mocks.language = 'de';
    const { result, unmount } = renderHook(() =>
      useEndedAgoController(new Date(Date.now() - 60_000))
    );
    expect(result.current.label).toContain('features.timeline.terminal.endedAgo');
    act(() => vi.advanceTimersByTime(60_000));
    unmount();

    mocks.language = 'en';
    const future = renderHook(() => useEndedAgoController(new Date(Date.now() + 60_000)));
    expect(future.result.current.label).toBeNull();
  });
});
