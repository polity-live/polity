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
      displayStartTime: 1_717_065_800_000,
      displayEndTime: 1_717_067_800_000,
    });
  });
});
