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

  it('prefers non-final open timeline rows over raw amendment change request rows', () => {
    const rawOpenChangeRequests = Array.from({ length: 12 }, (_, index) => ({
      id: `raw-cr-${index + 1}`,
      status: 'open',
    }));

    const stats = computeAgendaStats([
      {
        id: 'agenda-amendment-1',
        amendment_id: 'amendment-1',
        amendment: {
          id: 'amendment-1',
          change_requests: rawOpenChangeRequests,
        },
        change_request_timeline: [
          ...Array.from({ length: 6 }, (_, index) => ({
            id: `timeline-cr-${index + 1}`,
            change_request_id: `cr-${index + 1}`,
            is_final_vote: false,
            status: 'pending',
          })),
          {
            id: 'timeline-final-vote',
            change_request_id: null,
            is_final_vote: true,
            status: 'pending',
          },
        ],
      },
    ]);

    expect(stats.openChangeRequestsCount).toBe(6);
  });

  it('excludes completed timeline rows even when raw change requests are still open', () => {
    const stats = computeAgendaStats([
      {
        id: 'agenda-amendment-1',
        amendment_id: 'amendment-1',
        amendment: {
          id: 'amendment-1',
          change_requests: [
            { id: 'cr-open-1', status: 'open' },
            { id: 'cr-open-2', status: 'open' },
          ],
        },
        change_request_timeline: [
          {
            id: 'timeline-cr-1',
            change_request_id: 'cr-open-1',
            is_final_vote: false,
            status: 'completed',
          },
          {
            id: 'timeline-cr-2',
            change_request_id: 'cr-open-2',
            is_final_vote: false,
            status: 'voting',
          },
        ],
      },
    ]);

    expect(stats.openChangeRequestsCount).toBe(1);
  });

  it('falls back to raw amendment change requests before timeline initialization', () => {
    const stats = computeAgendaStats([
      {
        id: 'agenda-amendment-1',
        amendment_id: 'amendment-1',
        amendment: {
          id: 'amendment-1',
          change_requests: [
            { id: 'cr-open', status: 'open' },
            { id: 'cr-without-status', status: null },
            { id: 'cr-accepted', status: 'accepted' },
          ],
        },
        change_request_timeline: [],
      },
    ]);

    expect(stats.openChangeRequestsCount).toBe(2);
  });
});
