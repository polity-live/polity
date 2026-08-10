import { describe, expect, it } from 'vitest';

import {
  isCalendarEventOwnedByUser,
  isCalendarEventVisibleToUser,
} from '../calendarEventVisibility';

const baseEvent = {
  creator_id: 'creator-1',
  creator: null,
  participants: [],
  is_bookable: false,
  meeting_type: null,
};

describe('calendarEventVisibility', () => {
  it('treats creator_id as ownership even without a hydrated creator relation', () => {
    expect(isCalendarEventOwnedByUser({ ...baseEvent, creator_id: 'user-1' }, 'user-1')).toBe(true);
  });

  it('shows participant-linked events when only participant.user_id is present', () => {
    expect(
      isCalendarEventVisibleToUser(
        {
          ...baseEvent,
          participants: [{ user_id: 'user-1', user: null }],
        },
        'user-1'
      )
    ).toBe(true);
  });

  it('uses hydrated participant relations and tolerates a missing participant list', () => {
    expect(
      isCalendarEventVisibleToUser(
        {
          ...baseEvent,
          participants: [{ user_id: 'other', user: { id: 'user-1' } }],
        },
        'user-1'
      )
    ).toBe(true);
    expect(isCalendarEventVisibleToUser({ ...baseEvent, participants: undefined }, 'user-1')).toBe(
      false
    );
  });

  it('shows bookable meetings before the user has booked them', () => {
    expect(
      isCalendarEventVisibleToUser(
        {
          ...baseEvent,
          is_bookable: true,
          meeting_type: 'one-on-one',
        },
        'user-1'
      )
    ).toBe(true);
  });

  it('hides unrelated non-bookable events', () => {
    expect(isCalendarEventVisibleToUser(baseEvent, 'user-1')).toBe(false);
  });
});
