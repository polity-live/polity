import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateDuration, getMeetingStatus } from '../meetingUtils';

const mocks = vi.hoisted(() => ({
  translate: vi.fn((key: string, values?: object) => ({ key, values })),
  featureThemeClassName: vi.fn((token: string) => `theme:${token}`),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: object) => mocks.translate(key, values),
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (token: string) => mocks.featureThemeClassName(token),
}));

describe('meetingUtils', () => {
  beforeEach(() => {
    mocks.translate.mockClear();
    mocks.featureThemeClassName.mockClear();
  });

  it.each([
    [30, 'minutes', { count: 30 }],
    [60, 'hours', { count: 1 }],
    [61, 'oneHourOneMinute', { hours: 1, minutes: 1 }],
    [62, 'oneHourManyMinutes', { hours: 1, minutes: 2 }],
    [121, 'manyHoursOneMinute', { hours: 2, minutes: 1 }],
    [122, 'manyHoursManyMinutes', { hours: 2, minutes: 2 }],
  ])('translates a %i minute duration using %s', (minutes, suffix, values) => {
    const start = 1_786_184_220_000;
    expect(calculateDuration(start, start + minutes * 60_000)).toEqual({
      key: `features.meet.duration.${suffix}`,
      values,
    });
  });

  it('gives a past meeting precedence over availability', () => {
    expect(getMeetingStatus(true, true)).toEqual({
      label: { key: 'generated.inline.0174_past_meeting_bcf6e6c4', values: undefined },
      variant: 'outline',
    });
  });

  it('returns the themed available state', () => {
    expect(getMeetingStatus(true, false)).toEqual({
      label: { key: 'generated.inline.0175_available_7c62a142', values: undefined },
      variant: 'default',
      className: 'theme:agendaAgendaVoteSectionSuccessBackground',
    });
  });

  it('returns the destructive fully-booked state', () => {
    expect(getMeetingStatus(false, false)).toEqual({
      label: { key: 'generated.inline.0176_fully_booked_e5b07b41', values: undefined },
      variant: 'destructive',
    });
  });
});
