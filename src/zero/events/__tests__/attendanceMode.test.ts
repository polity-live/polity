import { describe, expect, it } from 'vitest';
import {
  hasOpenElectorateSnapshot,
  resolveEventAttendanceMode,
  resolveParticipationChannel,
} from '../attendance-mode';

describe('event attendance mode', () => {
  it('derives participation channels consistently for each attendance mode', () => {
    expect(
      resolveParticipationChannel({
        attendanceMode: 'online',
        hasConfirmedOfflineAssignment: true,
      })
    ).toBe('online');
    expect(
      resolveParticipationChannel({
        attendanceMode: 'hybrid',
        hasConfirmedOfflineAssignment: true,
      })
    ).toBe('offline');
    expect(
      resolveParticipationChannel({
        attendanceMode: 'hybrid',
        hasConfirmedOfflineAssignment: false,
      })
    ).toBe('online');
    expect(
      resolveParticipationChannel({
        attendanceMode: 'offline',
        hasConfirmedOfflineAssignment: false,
      })
    ).toBe('offline');
  });

  it('uses the legacy location type only when no explicit attendance mode exists', () => {
    expect(
      resolveEventAttendanceMode({ attendance_mode: 'online', location_type: 'physical' })
    ).toBe('online');
    expect(resolveEventAttendanceMode({ attendance_mode: null, location_type: 'online' })).toBe(
      'online'
    );
    expect(
      resolveEventAttendanceMode({ attendance_mode: 'offline', location_type: 'online' })
    ).toBe('offline');
  });

  it('locks only non-closed ballots with an electorate snapshot', () => {
    expect(hasOpenElectorateSnapshot([{ status: 'final', electorate_snapshotted_at: 123 }])).toBe(
      true
    );
    expect(
      hasOpenElectorateSnapshot([
        { status: 'closed', electorate_snapshotted_at: 123 },
        { status: 'indicative', electorate_snapshotted_at: null },
      ])
    ).toBe(false);
  });
});
