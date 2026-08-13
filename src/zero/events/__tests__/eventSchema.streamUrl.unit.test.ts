import { describe, expect, it } from 'vitest';
import { eventCreateSchema, eventUpdateSchema } from '../schema';

describe('event stream URL input validation', () => {
  it.each([eventCreateSchema, eventUpdateSchema])(
    'accepts normalized HTTP(S) URLs and null',
    schema => {
      expect(
        schema.safeParse({ id: 'event-1', title: 'Event', group_id: null, stream_url: null })
          .success
      ).toBe(true);
      expect(
        schema.safeParse({
          id: 'event-1',
          title: 'Event',
          group_id: null,
          stream_url: 'https://twitch.tv/polity',
        }).success
      ).toBe(true);
    }
  );

  it.each([eventCreateSchema, eventUpdateSchema])('rejects unsafe or unnormalized URLs', schema => {
    expect(
      schema.safeParse({
        id: 'event-1',
        title: 'Event',
        group_id: null,
        stream_url: 'javascript:alert(1)',
      }).success
    ).toBe(false);
    expect(
      schema.safeParse({
        id: 'event-1',
        title: 'Event',
        group_id: null,
        stream_url: 'twitch.tv/polity',
      }).success
    ).toBe(false);
  });
});
