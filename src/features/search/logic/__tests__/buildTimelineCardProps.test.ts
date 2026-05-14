import { describe, expect, it } from 'vitest';
import { buildTimelineCardProps } from '../buildTimelineCardProps';

describe('buildTimelineCardProps', () => {
  it('builds an event timeline card payload with group navigation context', () => {
    const createdAt = new Date('2026-05-10T12:00:00.000Z');
    const startDate = new Date('2026-05-12T18:30:00.000Z');

    const result = buildTimelineCardProps({
      id: 'event-1',
      type: 'event',
      title: 'Town Hall',
      createdAt,
      startDate,
      attendeeCount: 12,
      authorId: 'user-1',
      groupId: 'group-1',
      groupName: 'City Circle',
      authorName: 'Alex Organizer',
    });

    expect(result.cardType).toBe('event');
    expect(result.cardProps).toMatchObject({
      event: {
        id: 'event-1',
        title: 'Town Hall',
        startDate,
        attendeeCount: 12,
        organizerName: 'Alex Organizer',
        organizerId: 'user-1',
        groupId: 'group-1',
        groupName: 'City Circle',
      },
    });
  });

  it('falls back to a creator id for non-group event subtitles', () => {
    const createdAt = new Date('2026-05-10T12:00:00.000Z');

    const result = buildTimelineCardProps({
      id: 'event-2',
      type: 'event',
      title: 'Open Office Hours',
      createdAt,
      authorId: 'user-99',
    });

    expect(result.cardType).toBe('event');
    expect(result.cardProps).toMatchObject({
      event: {
        id: 'event-2',
        organizerName: 'user-99',
        organizerId: 'user-99',
      },
    });
  });

  it('builds a payment timeline card payload', () => {
    const createdAt = new Date('2026-05-10T12:00:00.000Z');

    const result = buildTimelineCardProps({
      id: 'payment-1',
      type: 'payment',
      title: 'Membership dues',
      createdAt,
      amount: 42,
      paymentType: 'membership_fee',
      paymentDirection: 'income',
      groupId: 'group-1',
      groupName: 'City Circle',
    });

    expect(result.cardType).toBe('payment');
    expect(result.cardProps).toMatchObject({
      payment: {
        id: 'payment-1',
        label: 'Membership dues',
        amount: 42,
        type: 'membership_fee',
        direction: 'income',
        createdAt,
        groupId: 'group-1',
        groupName: 'City Circle',
      },
    });
  });

  it('builds an agenda item timeline card payload', () => {
    const createdAt = new Date('2026-05-10T12:00:00.000Z');

    const result = buildTimelineCardProps({
      id: 'agenda-1',
      type: 'agenda_item',
      title: 'Budget approval',
      description: 'Review and decide on the proposed annual budget.',
      createdAt,
      status: 'pending',
      agendaItemType: 'vote',
      orderIndex: 3,
      scheduledTime: '2026-05-15T18:30:00.000Z',
      durationMinutes: 30,
      eventId: 'event-1',
      eventName: 'Annual Assembly',
    });

    expect(result.cardType).toBe('agenda_item');
    expect(result.cardProps).toMatchObject({
      agendaItem: {
        id: 'agenda-1',
        title: 'Budget approval',
        description: 'Review and decide on the proposed annual budget.',
        status: 'pending',
        type: 'vote',
        orderIndex: 3,
        scheduledTime: '2026-05-15T18:30:00.000Z',
        durationMinutes: 30,
        eventId: 'event-1',
        eventName: 'Annual Assembly',
        createdAt,
      },
    });
  });
});
