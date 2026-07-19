import { describe, expect, it } from 'vitest';
import { parseOptionalTimestamp } from '../ai-create-tools';

describe('AI timestamp parsing', () => {
  it('uses end of day for date-only todo deadlines', () => {
    const timestamp = parseOptionalTimestamp('2026-07-19', {
      timeZone: 'Europe/Berlin',
      dateOnlyBoundary: 'end',
    });

    expect(new Date(timestamp ?? 0).toISOString()).toBe('2026-07-19T21:59:59.999Z');
  });

  it('interprets naive date-times in the request time zone', () => {
    const timestamp = parseOptionalTimestamp('2026-07-19T14:30', {
      timeZone: 'Europe/Berlin',
    });

    expect(new Date(timestamp ?? 0).toISOString()).toBe('2026-07-19T12:30:00.000Z');
  });

  it('does not reinterpret timestamps that already include an offset', () => {
    const timestamp = parseOptionalTimestamp('2026-07-19T14:30:00-04:00', {
      timeZone: 'Europe/Berlin',
    });

    expect(new Date(timestamp ?? 0).toISOString()).toBe('2026-07-19T18:30:00.000Z');
  });
});
