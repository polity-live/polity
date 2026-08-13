import { describe, expect, it, vi } from 'vitest';

import { calculateSpeakerTime, formatTime } from '../eventStreamHelpers';

describe('eventStreamHelpers', () => {
  it('adds only the preceding speakers and treats absent durations as zero', () => {
    const start = new Date('2026-08-01T10:00:00.000Z');
    const speakers = [{ time: 5 }, { time: null }, {}, { time: 12 }];

    expect(calculateSpeakerTime(0, speakers, start)).toEqual(start);
    expect(calculateSpeakerTime(3, speakers, start)).toEqual(new Date('2026-08-01T10:05:00.000Z'));
    expect(calculateSpeakerTime(4, speakers, start)).toEqual(new Date('2026-08-01T10:17:00.000Z'));
  });

  it('formats time with a stable 24-hour contract', () => {
    const date = new Date('2026-08-01T10:17:00.000Z');
    const formatter = vi.spyOn(date, 'toLocaleTimeString').mockReturnValue('12:17');

    expect(formatTime(date)).toBe('12:17');
    expect(formatter).toHaveBeenCalledWith('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  });
});
