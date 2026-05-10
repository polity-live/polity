import { describe, expect, it } from 'vitest';
import { buildTimelineCardProps } from '../buildTimelineCardProps';

describe('buildTimelineCardProps', () => {
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
