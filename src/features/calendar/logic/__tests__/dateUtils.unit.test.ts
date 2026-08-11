import { afterEach, describe, expect, it, vi } from 'vitest';

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
} from '../dateUtils';

describe('calendar dateUtils', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calculates Sunday-based week and calendar month bounds', () => {
    const date = new Date(2026, 7, 5, 12);
    expect(startOfWeek(date)).toEqual(new Date(2026, 7, 2, 12));
    expect(endOfWeek(date)).toEqual(new Date(2026, 7, 8, 12));
    expect(startOfMonth(date)).toEqual(new Date(2026, 7, 1));
    expect(endOfMonth(date)).toEqual(new Date(2026, 7, 31));
  });

  it('compares calendar days and inclusive ranges', () => {
    const date = new Date(2026, 7, 5, 12);
    expect(isSameDay('2026-08-05T01:00:00', date)).toBe(true);
    expect(isSameDay(new Date(2025, 7, 5), date)).toBe(false);
    expect(isSameDay(new Date(2026, 6, 5), date)).toBe(false);
    expect(isSameDay(new Date(2026, 7, 6), date)).toBe(false);
    expect(isDateInRange(date, new Date(2026, 7, 5), new Date(2026, 7, 5, 23))).toBe(true);
    expect(isDateInRange(new Date(2026, 7, 4), new Date(2026, 7, 5), new Date(2026, 7, 6))).toBe(
      false
    );
  });

  it('delegates date, month and time formatting to stable locale contracts', () => {
    const date = new Date(2026, 7, 5, 12);
    const dateFormatter = vi
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('formatted');
    const timeFormatter = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('time');

    expect(formatDate(date)).toBe('formatted');
    expect(formatMonth(date)).toBe('formatted');
    expect(formatTime(date)).toBe('time');
    expect(dateFormatter).toHaveBeenCalledWith('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(dateFormatter).toHaveBeenCalledWith('en-US', { month: 'long', year: 'numeric' });
    expect(timeFormatter).toHaveBeenCalledWith('en-US', { hour: 'numeric', minute: '2-digit' });
  });

  it('formats week endpoints and returns all seven days', () => {
    const formatter = vi
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValueOnce('Aug 2')
      .mockReturnValueOnce('Aug 8, 2026');
    const date = new Date(2026, 7, 5, 12);

    expect(formatWeekRange(date)).toBe('Aug 2 - Aug 8, 2026');
    expect(formatter).toHaveBeenNthCalledWith(1, 'en-US', { month: 'short', day: 'numeric' });
    expect(formatter).toHaveBeenNthCalledWith(2, 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    expect(getWeekDays(date)).toEqual([
      new Date(2026, 7, 2, 12),
      new Date(2026, 7, 3, 12),
      new Date(2026, 7, 4, 12),
      new Date(2026, 7, 5, 12),
      new Date(2026, 7, 6, 12),
      new Date(2026, 7, 7, 12),
      new Date(2026, 7, 8, 12),
    ]);
  });
});
