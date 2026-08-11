/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  participation: {} as Record<string, unknown>,
  subscription: {} as Record<string, unknown>,
  viewProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: unknown) => (values ? `${key}:${JSON.stringify(values)}` : key),
  }),
}));

vi.mock('@/features/events/hooks/useEventParticipation', () => ({
  useEventParticipation: () => mocks.participation,
}));

vi.mock('@/features/events/hooks/useSubscribeEvent', () => ({
  useSubscribeEvent: () => mocks.subscription,
}));

vi.mock('../EventTimelineCardView', () => ({
  EventTimelineCardView: (props: Record<string, any>) => {
    mocks.viewProps = props;
    return <div data-testid="event-view" />;
  },
}));

import { EventTimelineCard, type EventTimelineCardProps } from '../EventTimelineCard';

const baseEvent: EventTimelineCardProps['event'] = {
  id: 'event-1',
  title: 'Assembly',
  startDate: '2026-08-09T14:00:00.000Z',
};

function renderCard(event: Partial<EventTimelineCardProps['event']> = {}, props = {}) {
  render(<EventTimelineCard event={{ ...baseEvent, ...event }} {...props} />);
  return mocks.viewProps!;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-09T12:00:00.000Z'));
  mocks.participation = {
    status: null,
    isParticipant: false,
    isInvited: false,
    hasRequested: false,
    participantCount: undefined,
    isLoading: false,
  };
  mocks.subscription = { isSubscribed: false, isLoading: false };
  mocks.viewProps = undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('EventTimelineCard controller', () => {
  it('derives default navigation, empty content, and an upcoming date', () => {
    const props = renderCard();

    expect(props.eventHref).toBe('/event/event-1');
    expect(props.eventDescription).toBeUndefined();
    expect(props.eventSubtitle).toBeUndefined();
    expect(props.eventSubtitleHref).toBeUndefined();
    expect(props.eventTimeStatus).toBe('upcoming');
    expect(props.dateLabel).toBe('Today');
    expect(props.locationDisplay).toBeNull();
    expect(props.resolvedParticipationStatus).toBeNull();
    expect(props.hasParticipationRelationship).toBe(false);
    expect(props.getRsvpLabel()).toBe('features.timeline.cards.rsvp');
    expect(props.getRsvpVariant()).toBe('default');
    expect(props.stats).toHaveLength(1);
    expect(props.stats[0].value).toBe(0);
  });

  it('uses explicit navigation and selection precedence', () => {
    expect(renderCard({}, { href: '/custom', onSelect: vi.fn() }).eventHref).toBe('/custom');
    cleanup();
    expect(renderCard({}, { onSelect: vi.fn() }).eventHref).toBeUndefined();
  });

  it.each([
    ['member', 'attending', 'secondary'],
    ['admin', 'attending', 'secondary'],
    ['confirmed', 'attending', 'secondary'],
    ['invited', 'invited', 'default'],
    ['requested', 'pending', 'outline'],
  ] as const)('maps %s participation to its RSVP presentation', (status, label, variant) => {
    const props = renderCard({ participationStatus: status });

    expect(props.getRsvpLabel()).toBe(`features.timeline.cards.event.${label}`);
    expect(props.getRsvpVariant()).toBe(variant);
    expect(props.hasParticipationRelationship).toBe(true);
  });

  it('falls back independently to all relationship flags from the hook', () => {
    mocks.participation = {
      ...mocks.participation,
      status: 'hook-status',
      isParticipant: true,
      participantCount: 7,
    };
    let props = renderCard();
    expect(props.resolvedParticipationStatus).toBe('hook-status');
    expect(props.isParticipant).toBe(true);
    expect(props.stats[0].value).toBe(7);

    cleanup();
    mocks.participation = { ...mocks.participation, isParticipant: false, isInvited: true };
    props = renderCard();
    expect(props.isInvited).toBe(true);

    cleanup();
    mocks.participation = { ...mocks.participation, isInvited: false, hasRequested: true };
    props = renderCard();
    expect(props.hasRequested).toBe(true);
  });

  it('prefers explicit attendee counts, includes positive stats, and omits zero stats', () => {
    const props = renderCard({ attendeeCount: 9, electionsCount: 2, amendmentsCount: 3 });
    expect(props.stats.map((stat: any) => stat.value)).toEqual([9, 2, 3]);
    expect(props.stats.map((stat: any) => stat.label)).toEqual([
      'features.timeline.cards.event.participants:{"count":9}',
      'features.timeline.cards.event.elections:{"count":2}',
      'features.timeline.cards.event.amendments:{"count":3}',
    ]);

    cleanup();
    expect(renderCard({ electionsCount: 0, amendmentsCount: 0 }).stats).toHaveLength(1);
  });

  it.each([
    [{ location: 'Hall', city: 'Berlin', postcode: '10115' }, 'Hall, 10115 Berlin'],
    [{ location: 'Hall', city: 'Berlin' }, 'Hall, Berlin'],
    [{ location: 'Hall', postcode: '10115' }, 'Hall, 10115'],
    [{ location: 'Hall' }, 'Hall'],
    [{ city: 'Berlin', postcode: '10115' }, '10115 Berlin'],
    [{ city: 'Berlin' }, 'Berlin'],
    [{ postcode: '10115' }, '10115'],
    [{ location: 'Berlin Hall', city: 'Berlin', postcode: '10115' }, 'Berlin Hall'],
    [{ location: 'Hall 10115', city: 'Berlin', postcode: '10115' }, 'Hall 10115'],
  ] as const)('builds location display %#', (event, expected) => {
    expect(renderCard(event).locationDisplay).toBe(expected);
  });

  it('derives organizer and group subtitles and links', () => {
    let props = renderCard({ organizerName: 'Ada', organizerId: 'user-1' });
    expect(props.eventSubtitle).toBe('Ada');
    expect(props.eventSubtitleHref).toBe('/user/user-1');

    cleanup();
    props = renderCard({ groupName: 'Civic Group', groupId: 'group-1', organizerId: 'user-1' });
    expect(props.eventSubtitle).toBe('Civic Group');
    expect(props.eventSubtitleHref).toBe('/group/group-1');

    cleanup();
    props = renderCard({ groupName: 'Civic Group' });
    expect(props.eventSubtitleHref).toBeUndefined();
  });

  it('classifies past, near-future live, and tomorrow dates', () => {
    let props = renderCard({ startDate: '2026-08-09T11:00:00.000Z' });
    expect(props.eventTimeStatus).toBe('past');
    expect(props.dateLabel).toBe('Today');

    cleanup();
    props = renderCard({ startDate: '2026-08-09T12:30:00.000Z' });
    expect(props.eventTimeStatus).toBe('live');

    cleanup();
    props = renderCard({ startDate: '2026-08-10T14:00:00.000Z' });
    expect(props.eventTimeStatus).toBe('upcoming');
    expect(props.dateLabel).toBe('Tomorrow');

    cleanup();
    props = renderCard({ startDate: '2026-08-12T14:00:00.000Z' });
    expect(props.dateLabel).toBeNull();
  });
});
