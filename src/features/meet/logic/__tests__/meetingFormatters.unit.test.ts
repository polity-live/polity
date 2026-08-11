import { describe, expect, it, vi } from 'vitest';

import { formatMeetingDate, formatMeetingTime, formatMeetingType } from '../meetingFormatters';

describe('meetingFormatters', () => {
  it('formats the meeting date with the documented locale fields', () => {
    const formatter = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('date');

    expect(formatMeetingDate('2026-08-01T10:17:00.000Z')).toBe('date');
    expect(formatter).toHaveBeenCalledWith('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    formatter.mockRestore();
  });

  it('formats the meeting time with the documented locale fields', () => {
    const formatter = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('time');

    expect(formatMeetingTime(1_786_184_220_000)).toBe('time');
    expect(formatter).toHaveBeenCalledWith('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    formatter.mockRestore();
  });

  it('turns the first type separator into a display space', () => {
    expect(formatMeetingType('delegate-assembly-extra')).toBe('delegate assembly-extra');
    expect(formatMeetingType('meeting')).toBe('meeting');
  });
});
