import { describe, expect, it } from 'vitest';
import { eventCreateSchema, eventUpdateSchema } from '../schema';

describe('event schema nullable timestamps', () => {
  it('preserves null schedule values when creating events', () => {
    const parsed = eventCreateSchema.parse({
      id: 'event-1',
      title: 'Open Event',
      creator_id: 'user-1',
      group_id: null,
      visibility: 'public',
      start_date: null,
      end_date: null,
      recurrence_end_date: null,
      registration_deadline: null,
      amendment_deadline: null,
      candidacy_deadline: null,
      delegates_nomination_deadline: null,
    });

    expect(parsed.start_date).toBeNull();
    expect(parsed.end_date).toBeNull();
    expect(parsed.recurrence_end_date).toBeNull();
    expect(parsed.registration_deadline).toBeNull();
    expect(parsed.amendment_deadline).toBeNull();
    expect(parsed.candidacy_deadline).toBeNull();
    expect(parsed.delegates_nomination_deadline).toBeNull();
  });

  it('preserves null schedule values when updating events', () => {
    const parsed = eventUpdateSchema.parse({
      id: 'event-1',
      start_date: null,
      end_date: null,
      recurrence_end_date: null,
      registration_deadline: null,
      amendment_deadline: null,
      candidacy_deadline: null,
    });

    expect(parsed.start_date).toBeNull();
    expect(parsed.end_date).toBeNull();
    expect(parsed.recurrence_end_date).toBeNull();
    expect(parsed.registration_deadline).toBeNull();
    expect(parsed.amendment_deadline).toBeNull();
    expect(parsed.candidacy_deadline).toBeNull();
  });
});
