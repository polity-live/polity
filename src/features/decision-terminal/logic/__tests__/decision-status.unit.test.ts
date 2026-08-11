import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatCountdown,
  generateDecisionId,
  getDecisionStatus,
  getStatusColorClass,
  isClosed,
  isClosingSoon,
  isOpeningSoon,
  isRecentlyClosed,
  isUrgent,
} from '../decision-status';

const mocks = vi.hoisted(() => ({
  featureThemeClassName: vi.fn((token: string) => `theme:${token}`),
  formatCountdownTime: vi.fn(
    (hours: number, minutes: number, seconds: number, options: object) =>
      `${hours}:${minutes}:${seconds}:${JSON.stringify(options)}`
  ),
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (token: string) => mocks.featureThemeClassName(token),
}));

vi.mock('../formatTimeUtils', () => ({
  formatCountdownTime: (hours: number, minutes: number, seconds: number, options: object) =>
    mocks.formatCountdownTime(hours, minutes, seconds, options),
}));

const now = new Date('2026-08-01T10:00:00.000Z');
const fromNow = (milliseconds: number) => new Date(now.getTime() + milliseconds);

describe('decision-status', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it.each([
    [-1, undefined, 'passed'],
    [0, 'failed', 'failed'],
    [15 * 60_000, undefined, 'final_minutes'],
    [16 * 60_000, undefined, 'last_hour'],
    [60 * 60_000, undefined, 'last_hour'],
    [61 * 60_000, undefined, 'closing_soon'],
    [24 * 60 * 60_000 + 59_000, undefined, 'closing_soon'],
    [25 * 60 * 60_000, undefined, 'open'],
  ] as const)('maps time offset %i to %s', (offset, result, expected) => {
    expect(getDecisionStatus(fromNow(offset), result)).toBe(expected);
  });

  it('checks urgent, closing, closed, opening and recently closed boundaries', () => {
    expect(isUrgent(fromNow(-1))).toBe(false);
    expect(isUrgent(fromNow(1))).toBe(true);
    expect(isUrgent(fromNow(60 * 60_000))).toBe(true);
    expect(isUrgent(fromNow(60 * 60_000 + 1))).toBe(false);

    expect(isClosingSoon(fromNow(-1))).toBe(false);
    expect(isClosingSoon(fromNow(24 * 60 * 60_000))).toBe(true);
    expect(isClosingSoon(fromNow(24 * 60 * 60_000 + 1))).toBe(false);

    expect(isClosed(fromNow(0))).toBe(true);
    expect(isClosed(fromNow(1))).toBe(false);

    expect(isOpeningSoon(fromNow(0))).toBe(false);
    expect(isOpeningSoon(fromNow(24 * 60 * 60_000))).toBe(true);
    expect(isOpeningSoon(fromNow(24 * 60 * 60_000 + 1))).toBe(false);

    expect(isRecentlyClosed(fromNow(1))).toBe(false);
    expect(isRecentlyClosed(fromNow(0))).toBe(true);
    expect(isRecentlyClosed(fromNow(-24 * 60 * 60_000))).toBe(true);
    expect(isRecentlyClosed(fromNow(-24 * 60 * 60_000 - 1))).toBe(false);
  });

  it('formats ended and active countdowns through the shared formatter', () => {
    expect(formatCountdown(fromNow(0))).toBe('00:00:00');
    expect(formatCountdown(fromNow(25 * 60 * 60_000 + 2 * 60_000 + 3_000), 'de')).toBe(
      '25:2:3:{"locale":"de"}'
    );
    expect(mocks.formatCountdownTime).toHaveBeenCalledWith(25, 2, 3, { locale: 'de' });
  });

  it.each([
    ['open', 'decisionterminalDecisionStatusSuccessText'],
    ['closing_soon', 'decisionterminalDecisionStatusWarningText'],
    ['last_hour', 'decisionterminalDecisionStatusWarningTextAlpha'],
    ['final_minutes', 'decisionterminalDecisionStatusDangerText'],
    ['passed', 'decisionterminalDecisionStatusSuccessText'],
    ['elected', 'decisionterminalDecisionStatusSuccessText'],
    ['failed', 'decisionterminalDecisionStatusDangerTextAlpha'],
    ['tied', 'decisionterminalDecisionStatusNeutralText'],
  ] as const)('maps %s to its theme token', (status, token) => {
    expect(getStatusColorClass(status)).toBe(`theme:${token}`);
  });

  it('uses a muted fallback for an unknown status', () => {
    expect(getStatusColorClass('unknown' as never)).toBe('text-muted-foreground');
  });

  it('generates padded vote and election identifiers', () => {
    expect(generateDecisionId('vote', 7)).toBe('V-007');
    expect(generateDecisionId('election', 42)).toBe('E-042');
  });
});
