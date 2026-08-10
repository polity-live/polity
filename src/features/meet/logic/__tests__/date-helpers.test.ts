import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import {
  endOfMonth,
  endOfWeek,
  formatDate,
  formatMonth,
  formatTime,
  formatWeekRange,
  getWeekDays,
  isDateInRange,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from '../date-helpers';

describe('meet date helpers', () => {
  afterEach(() => {
    useLanguageStore.setState({ language: 'de' });
    vi.restoreAllMocks();
  });

  it('computes inclusive calendar boundaries and days', () => {
    const date = new Date(2026, 4, 13, 12);

    expect(startOfWeek(date).getDay()).toBe(0);
    expect(endOfWeek(date).getDay()).toBe(6);
    expect(startOfMonth(date).getDate()).toBe(1);
    expect(endOfMonth(date).getDate()).toBe(31);
    expect(getWeekDays(date)).toHaveLength(7);
    expect(isSameDay(date, new Date(2026, 4, 13, 23))).toBe(true);
    expect(isSameDay(date, new Date(2026, 4, 14))).toBe(false);
    expect(isDateInRange(date, new Date(2026, 4, 13), new Date(2026, 4, 14))).toBe(true);
    expect(isDateInRange(date, new Date(2026, 4, 14), new Date(2026, 4, 15))).toBe(false);
  });

  it.each([
    ['de', 'de-DE'],
    ['en', 'en-US'],
  ] as const)('formats values using the %s locale', (language, locale) => {
    useLanguageStore.setState({ language });
    const localeSpy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString');
    const date = new Date(2026, 4, 13, 12, 30);

    formatDate(date);
    formatWeekRange(date);
    formatMonth(date);
    formatTime(date);

    expect(localeSpy).toHaveBeenCalledWith(locale, expect.any(Object));
    expect(timeSpy).toHaveBeenCalledWith(locale, expect.any(Object));
  });
});
