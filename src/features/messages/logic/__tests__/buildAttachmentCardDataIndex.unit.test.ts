import { describe, expect, it } from 'vitest';
import {
  buildAttachmentCardDataIndex,
  type AgendaItemCardDataSource,
} from '../buildAttachmentCardDataIndex';

describe('buildAttachmentCardDataIndex', () => {
  it('builds agenda item card data with an event href for fallback resolution', () => {
    const agendaItems: AgendaItemCardDataSource[] = [
      {
        id: 'agenda-1',
        title: 'Budget approval',
        description: 'Review and decide on the proposed annual budget.',
        type: 'vote',
        status: 'pending',
        order_index: 3,
        scheduled_time: '2026-05-15T18:30:00.000Z',
        duration: 30,
        event_id: 'event-1',
        event: { title: 'Annual Assembly' },
        created_at: Date.parse('2026-05-10T12:00:00.000Z'),
        updated_at: Date.parse('2026-05-10T13:00:00.000Z'),
      },
    ];

    const cardDataByKey = buildAttachmentCardDataIndex({
      attachmentOptions: [],
      agendaItems,
    });

    const parsed = JSON.parse(cardDataByKey.get('agenda_item:agenda-1') ?? 'null') as {
      cardType: string;
      cardProps: {
        agendaItem: {
          eventId?: string | null;
          eventName?: string | null;
        };
      };
    } | null;

    expect(parsed).not.toBeNull();
    expect(parsed?.cardType).toBe('agenda_item');
    expect(parsed?.cardProps.agendaItem.eventId).toBe('event-1');
    expect(parsed?.cardProps.agendaItem.eventName).toBe('Annual Assembly');
  });
});
