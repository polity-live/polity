import { describe, expect, it } from 'vitest';

import { getAgendaDisplayTimes } from '../getAgendaDisplayTimes';

describe('getAgendaDisplayTimes', () => {
  it('prefers actual completion timestamps over calculated schedule times', () => {
    expect(
      getAgendaDisplayTimes({
        activated_at: 1_717_066_000_000,
        completed_at: 1_717_066_600_000,
        start_time: 1_717_066_000_000,
        end_time: 1_717_067_400_000,
        calculated_start_time: 1_717_065_800_000,
        calculated_end_time: 1_717_067_800_000,
      })
    ).toEqual({
      actualStartTime: 1_717_066_000_000,
      actualEndTime: 1_717_066_600_000,
      expectedEndTime: undefined,
      displayStartTime: 1_717_066_000_000,
      displayEndTime: 1_717_066_600_000,
    });
  });

  it('falls back to calculated times when no actual timestamps exist yet', () => {
    expect(
      getAgendaDisplayTimes({
        calculated_start_time: 1_717_065_800_000,
        calculated_end_time: 1_717_067_800_000,
      })
    ).toEqual({
      actualStartTime: undefined,
      actualEndTime: undefined,
      expectedEndTime: undefined,
      displayStartTime: 1_717_065_800_000,
      displayEndTime: 1_717_067_800_000,
    });
  });

  it('uses legacy start and end timestamps when activation fields are absent', () => {
    expect(
      getAgendaDisplayTimes({
        status: 'completed',
        start_time: 1_717_066_000_000,
        end_time: 1_717_066_600_000,
      })
    ).toMatchObject({
      actualStartTime: 1_717_066_000_000,
      actualEndTime: 1_717_066_600_000,
    });
  });

  it('uses the activation timestamp and duration for active agenda items', () => {
    expect(
      getAgendaDisplayTimes({
        status: 'in-progress',
        duration: 45,
        activated_at: 1_717_066_000_000,
        start_time: 1_717_066_000_000,
        calculated_start_time: 1_717_152_000_000,
        calculated_end_time: 1_717_153_800_000,
      })
    ).toEqual({
      actualStartTime: 1_717_066_000_000,
      actualEndTime: undefined,
      expectedEndTime: 1_717_068_700_000,
      displayStartTime: 1_717_066_000_000,
      displayEndTime: 1_717_068_700_000,
    });
  });

  it('defaults active agenda item duration to 30 minutes', () => {
    expect(
      getAgendaDisplayTimes({
        status: 'active',
        activated_at: 1_717_066_000_000,
      })
    ).toEqual({
      actualStartTime: 1_717_066_000_000,
      actualEndTime: undefined,
      expectedEndTime: 1_717_067_800_000,
      displayStartTime: 1_717_066_000_000,
      displayEndTime: 1_717_067_800_000,
    });
  });

  it('lets an explicit closing end time win for active decisions', () => {
    expect(
      getAgendaDisplayTimes({
        status: 'in-progress',
        duration: 45,
        activated_at: 1_717_066_000_000,
        closing_end_time: 1_717_066_900_000,
        calculated_end_time: 1_717_153_800_000,
      })
    ).toEqual({
      actualStartTime: 1_717_066_000_000,
      actualEndTime: undefined,
      expectedEndTime: 1_717_066_900_000,
      displayStartTime: 1_717_066_000_000,
      displayEndTime: 1_717_066_900_000,
    });
  });

  it('keeps the expected end unset when an ongoing status has no start timestamp', () => {
    expect(getAgendaDisplayTimes({ status: 'active' }).expectedEndTime).toBeUndefined();
  });
});
