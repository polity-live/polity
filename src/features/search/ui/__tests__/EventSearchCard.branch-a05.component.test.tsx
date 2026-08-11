// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventSearchCard } from '../EventSearchCard';

const mocks = vi.hoisted(() => ({ cards: [] as any[], extractHashtags: vi.fn() }));

vi.mock('@/features/timeline/ui/cards/EventTimelineCard', () => ({
  EventTimelineCard: (props: any) => {
    mocks.cards.push(props);
    return <div data-testid="event-card" />;
  },
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtags: (...args: any[]) => mocks.extractHashtags(...args),
}));

vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

function renderEvent(event: Record<string, unknown>, props: Record<string, unknown> = {}) {
  render(<EventSearchCard event={event as any} {...props} />);
  return mocks.cards.at(-1);
}

describe('EventSearchCard branch coverage', () => {
  beforeEach(() => {
    mocks.cards = [];
    mocks.extractHashtags.mockReset().mockReturnValue([{ id: 'hash', tag: 'extracted' }]);
  });

  afterEach(cleanup);

  it('maps a fully populated relational event', () => {
    const onSelect = vi.fn();
    const props = renderEvent(
      {
        id: 7,
        title: 'Event',
        description: 'Description',
        start_date: 100,
        end_date: 200,
        location_name: 'Hall',
        city: 'Berlin',
        postcode: '10115',
        attendeeCount: 4,
        event_hashtags: ['raw'],
        agenda_items: [
          { election: { id: 'e' }, amendment: null },
          { election: null, amendment: { id: 'a' } },
        ],
        creator: {
          id: 'creator',
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'fallback@test',
        },
        group: { id: 'group', name: 'Group' },
      },
      { className: 'extra', href: '/event', onSelect }
    );

    expect(props).toEqual(
      expect.objectContaining({ className: 'entity-search-card-no-spotlight extra', onSelect })
    );
    expect(props.event).toEqual(
      expect.objectContaining({
        id: '7',
        title: 'Event',
        description: 'Description',
        location: 'Hall',
        city: 'Berlin',
        postcode: '10115',
        attendeeCount: 4,
        organizerName: 'Ada Lovelace',
        organizerId: 'creator',
        groupName: 'Group',
        groupId: 'group',
        electionsCount: 1,
        amendmentsCount: 1,
        hashtags: [{ id: 'hash', tag: 'extracted' }],
      })
    );
  });

  it('uses creator email and explicit group fallbacks when names are blank', () => {
    const props = renderEvent(
      {
        id: 'email',
        title: null,
        description: 123,
        start_date: null,
        end_date: null,
        city: null,
        postcode: 123,
        post_code: 'P-2',
        participant_count: 3,
        hashtags: [{ id: 'h', tag: 'copied' }],
        agenda_items: 'invalid',
        creator: { id: null, first_name: null, last_name: '', email: 'creator@test' },
        group: { id: null, name: null },
      },
      { groupName: 'Fallback group', groupId: 'fallback-id' }
    );

    expect(props.event).toEqual(
      expect.objectContaining({
        title: '',
        description: undefined,
        endDate: undefined,
        city: undefined,
        postcode: 'P-2',
        attendeeCount: 3,
        organizerName: 'creator@test',
        organizerId: undefined,
        groupName: 'Fallback group',
        groupId: 'fallback-id',
        electionsCount: 0,
        amendmentsCount: 0,
        hashtags: [{ id: 'h', tag: 'copied' }],
      })
    );
  });

  it('maps organizer relations and participant arrays', () => {
    const props = renderEvent({
      id: 'organizer',
      title: 'Organizer event',
      organizer: { id: 'org-id', name: 'Organizer' },
      groupName: 'Flat group',
      group_id: 'flat-group-id',
      participants: [{}, {}],
      hashtags: 'invalid',
      location: 'Remote',
      post_code: 123,
    });

    expect(props.event).toEqual(
      expect.objectContaining({
        organizerName: 'Organizer',
        organizerId: 'org-id',
        groupName: 'Flat group',
        groupId: 'flat-group-id',
        attendeeCount: 2,
        hashtags: [],
        location: 'Remote',
        postcode: undefined,
      })
    );
  });

  it('handles missing organizer values and calendar-style flat identifiers', () => {
    const emptyOrganizer = renderEvent({
      id: 'empty-organizer',
      title: 'Empty organizer',
      organizer: null,
      groupName: 42,
      group_id: null,
      attendeeCount: 'many',
      participant_count: 'many',
      participants: 'invalid',
      location: { label: 'not a string' },
    });
    expect(emptyOrganizer.event).toEqual(
      expect.objectContaining({
        organizerName: undefined,
        organizerId: undefined,
        groupName: undefined,
        groupId: undefined,
        attendeeCount: 0,
        location: undefined,
      })
    );

    cleanup();
    const flat = renderEvent({
      id: 'flat',
      title: 'Flat',
      organizerName: 'Flat organizer',
      organizerId: 'flat-organizer-id',
    });
    expect(flat.event).toEqual(
      expect.objectContaining({
        organizerName: 'Flat organizer',
        organizerId: 'flat-organizer-id',
      })
    );

    cleanup();
    const invalidFlat = renderEvent({
      id: 'invalid-flat',
      title: 'Invalid flat',
      creator: { id: null, first_name: null, last_name: null, email: null },
      organizerId: 9,
      location_name: null,
    });
    expect(invalidFlat.event.organizerName).toBeUndefined();
    expect(invalidFlat.event.organizerId).toBeUndefined();

    cleanup();
    const bare = renderEvent({ id: 'bare', title: 'Bare' });
    expect(bare.event.organizerName).toBeUndefined();
  });
});
