import { describe, expect, it } from 'vitest';
import { buildEventTemporalFields } from '@/features/events/logic/buildEventTemporalFields';
import {
  formatLocalDateInput,
  formatLocalDateTimeInput,
  formatLocalTimeInput,
} from '@/features/shared/logic/localDateTime';

describe('buildEventTemporalFields', () => {
  it('keeps cleared event dates and deadlines null', () => {
    expect(
      buildEventTemporalFields({
        startDate: '',
        startTime: '09:30',
        endDate: '',
        endTime: '11:45',
        registrationDeadline: '',
        amendmentDeadline: '',
        candidacyDeadline: '',
        delegatesNominationDeadline: '',
      })
    ).toEqual({
      start_date: null,
      end_date: null,
      registration_deadline: null,
      amendment_deadline: null,
      candidacy_deadline: null,
      delegates_nomination_deadline: null,
    });
  });

  it('serializes provided local event dates and deadlines without shifting them', () => {
    const result = buildEventTemporalFields({
      startDate: '2026-05-27',
      startTime: '09:30',
      endDate: '2026-05-27',
      endTime: '11:45',
      registrationDeadline: '2026-05-20T18:00',
      amendmentDeadline: '2026-05-19T17:15',
      candidacyDeadline: '2026-05-18T08:05',
      delegatesNominationDeadline: '2026-05-17T13:40',
    });

    expect(formatLocalDateInput(result.start_date)).toBe('2026-05-27');
    expect(formatLocalTimeInput(result.start_date)).toBe('09:30');
    expect(formatLocalDateInput(result.end_date)).toBe('2026-05-27');
    expect(formatLocalTimeInput(result.end_date)).toBe('11:45');
    expect(formatLocalDateTimeInput(result.registration_deadline)).toBe('2026-05-20T18:00');
    expect(formatLocalDateTimeInput(result.amendment_deadline)).toBe('2026-05-19T17:15');
    expect(formatLocalDateTimeInput(result.candidacy_deadline)).toBe('2026-05-18T08:05');
    expect(formatLocalDateTimeInput(result.delegates_nomination_deadline)).toBe('2026-05-17T13:40');
  });
});
