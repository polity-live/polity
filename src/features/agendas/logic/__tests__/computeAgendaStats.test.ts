import { describe, expect, it } from 'vitest';
import { computeAgendaStats } from '../computeAgendaStats';

describe('computeAgendaStats', () => {
  it('counts amendment agenda items, election rows, and unique open change requests', () => {
    const stats = computeAgendaStats([
      {
        id: 'agenda-amendment-1',
        amendment_id: 'amendment-1',
        amendment: {
          id: 'amendment-1',
          change_requests: [
            { id: 'cr-open', status: 'open' },
            { id: 'cr-without-status', status: null },
            { id: 'cr-closed', status: 'accepted' },
          ],
        },
      },
      {
        id: 'agenda-amendment-2',
        amendment_id: 'amendment-2',
        amendment: {
          id: 'amendment-2',
          change_requests: [{ id: 'cr-open', status: 'open' }, { id: 'cr-empty-status' }],
        },
      },
      {
        id: 'agenda-election',
        election: [{ id: 'election-1' }, { id: 'election-2' }],
      },
    ]);

    expect(stats).toEqual({
      amendmentsCount: 2,
      electionsCount: 2,
      openChangeRequestsCount: 3,
    });
  });
});
