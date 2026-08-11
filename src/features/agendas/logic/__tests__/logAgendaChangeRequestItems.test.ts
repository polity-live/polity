import { describe, expect, it } from 'vitest';

import { logAgendaChangeRequestItems } from '../logAgendaChangeRequestItems';

describe('logAgendaChangeRequestItems', () => {
  it('keeps the former development logger as a side-effect-free compatibility hook', () => {
    const items = [
      {
        id: 'agenda-change-1',
        agenda_item_id: 'agenda-item-1',
        change_request_id: 'change-request-1',
        status: 'open',
      },
    ] as const;

    expect(() =>
      logAgendaChangeRequestItems('agenda-details', {
        agendaItemId: 'agenda-item-1',
        amendmentId: 'amendment-1',
        items,
        pendingDisplayItems: items,
      })
    ).not.toThrow();
    expect(items).toEqual([
      {
        id: 'agenda-change-1',
        agenda_item_id: 'agenda-item-1',
        change_request_id: 'change-request-1',
        status: 'open',
      },
    ]);
  });
});
