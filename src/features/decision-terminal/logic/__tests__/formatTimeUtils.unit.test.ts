import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatCountdownTime, formatDurationShort, formatTimeElapsed } from '../formatTimeUtils';

describe('decision terminal time formatting', () => {
  afterEach(() => vi.useRealTimers());

  it('formats elapsed time in the appropriate locale and unit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));

    expect(formatTimeElapsed('2026-08-09T12:01:00Z')).toBeNull();
    expect(formatTimeElapsed('2026-08-09T11:15:00Z')).toBe('45m');
    expect(formatTimeElapsed(new Date('2026-08-09T09:00:00Z'), { locale: 'de' })).toBe('3Std');
    expect(formatTimeElapsed('2026-08-07T11:00:00Z', { locale: 'en' })).toBe('2d');
  });

  it('formats countdowns below one hour, below one day, and across days', () => {
    expect(formatCountdownTime(0, 4, 9)).toBe('04:09');
    expect(formatCountdownTime(3, 4, 9, { locale: 'en' })).toBe('03:04:09');
    expect(formatCountdownTime(49, 4, 9, { locale: 'de' })).toBe('2T 01:04:09');
  });

  it('formats short durations at every boundary', () => {
    expect(formatDurationShort(0)).toBe('0s');
    expect(formatDurationShort(-1, { locale: 'de' })).toBe('0s');
    expect(formatDurationShort(42)).toBe('42s');
    expect(formatDurationShort(5 * 60, { locale: 'de' })).toBe('5min');
    expect(formatDurationShort(3 * 3600, { locale: 'en' })).toBe('3h');
    expect(formatDurationShort(49 * 3600, { locale: 'de' })).toBe('2T');
  });
});
