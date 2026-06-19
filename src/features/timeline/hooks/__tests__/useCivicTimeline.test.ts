import { describe, expect, it } from 'vitest';

import type { AgendaStateItem } from '@/zero/agendas/useAgendaState';
import { mapAgendaItemToCivicTimelineItem } from '../useCivicTimeline';

const activatedAt = new Date('2026-06-19T13:05:00Z').getTime();
const plannedStart = new Date('2026-06-20T08:00:00Z').getTime();

function agendaItem(overrides: Partial<AgendaStateItem>): AgendaStateItem {
  return {
    id: 'agenda-1',
    event_id: 'event-1',
    amendment_id: null,
    creator_id: 'user-1',
    title: 'Agenda vote',
    description: null,
    type: 'vote',
    status: 'planned',
    forwarding_status: null,
    order_index: 1,
    duration: 30,
    scheduled_time: null,
    start_time: null,
    end_time: null,
    activated_at: null,
    completed_at: null,
    majority_type: null,
    time_limit: null,
    voting_phase: null,
    created_at: new Date('2026-06-01T08:00:00Z').getTime(),
    updated_at: new Date('2026-06-01T08:00:00Z').getTime(),
    calculated_start_time: plannedStart,
    calculated_end_time: plannedStart + 30 * 60_000,
    event: {
      id: 'event-1',
      title: 'Future assembly',
      location_name: null,
      latitude: null,
      longitude: null,
      country: null,
      region: null,
      post_code: null,
      city: null,
      street: null,
      house_number: null,
    },
    ...overrides,
  } as unknown as AgendaStateItem;
}

describe('useCivicTimeline agenda mapping', () => {
  it('maps activated agenda items by actual runtime instead of planned event time', () => {
    const item = mapAgendaItemToCivicTimelineItem(
      agendaItem({
        status: 'in-progress',
        duration: 45,
        activated_at: activatedAt,
        start_time: activatedAt,
      })
    );

    expect(item?.timestamp.getTime()).toBe(activatedAt);
    expect(item?.startDate?.getTime()).toBe(activatedAt);
    expect(item?.endDate?.getTime()).toBe(activatedAt + 45 * 60_000);
    expect(item?.status).toBe('in-progress');
    expect(item?.reason).toBe('active_now');
  });

  it('keeps unstarted agenda items on their calculated schedule', () => {
    const item = mapAgendaItemToCivicTimelineItem(agendaItem({}));

    expect(item?.timestamp.getTime()).toBe(plannedStart);
    expect(item?.startDate?.getTime()).toBe(plannedStart);
    expect(item?.endDate?.getTime()).toBe(plannedStart + 30 * 60_000);
    expect(item?.status).toBe('planned');
    expect(item?.reason).toBe('member_context');
  });
});
