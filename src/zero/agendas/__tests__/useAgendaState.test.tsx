/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const results = new Map<string, unknown>();
  const statuses = new Map<string, string>();
  const agendas = new Proxy(
    {},
    {
      get: (_target, property: string) => (args: unknown) => ({
        key: `agendas.${property}`,
        args,
      }),
    }
  );
  return {
    results,
    statuses,
    queries: { agendas },
    useQuery: vi.fn((query?: { key?: string }) => [
      query?.key ? results.get(query.key) : undefined,
      { type: query?.key ? (statuses.get(query.key) ?? 'complete') : 'complete' },
    ]),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));
vi.mock('../../queries', () => ({ queries: mocks.queries }));

import {
  getAgendaDurationMinutes,
  getValidTimestamp,
  useAgendaItemByAmendment,
  useAgendaItemCRTimeline,
  useAgendaState,
  useAgendaTimelineState,
  useAgendaTimingState,
  withCalculatedAgendaTimes,
} from '../useAgendaState';
import { AGENDA_VOTE_STEP_KIND } from '../vote-step-kind';

beforeEach(() => {
  mocks.results.clear();
  mocks.statuses.clear();
  mocks.useQuery.mockClear();
});

describe('agenda timing calculation', () => {
  it('normalizes duration and timestamp boundaries', () => {
    expect(getAgendaDurationMinutes({ duration: 15 })).toBe(15);
    expect(getAgendaDurationMinutes({ duration: 0 })).toBe(30);
    expect(getAgendaDurationMinutes({ duration: null })).toBe(30);
    expect(getValidTimestamp(10)).toBe(10);
    expect(getValidTimestamp(0)).toBeUndefined();
    expect(getValidTimestamp(null)).toBeUndefined();
  });

  it('calculates ordered event times and respects actual completion boundaries', () => {
    const rows = [
      {
        id: 'second',
        event_id: 'event-1',
        order_index: 2,
        duration: 10,
        completed_at: 4_000_000,
        event: { start_date: 1_000_000 },
      },
      {
        id: 'first',
        event_id: 'event-1',
        order_index: null,
        duration: null,
        completed_at: 0,
        end_time: 3_000_000,
        event: { start_date: 1_000_000 },
      },
      {
        id: 'third',
        event_id: 'event-1',
        order_index: 3,
        duration: 5,
        completed_at: null,
        end_time: null,
        event: { start_date: 1_000_000 },
      },
      { id: 'no-event-id', event_id: null, duration: 5 },
      { id: 'no-start', event_id: 'event-2', event: { start_date: null } },
    ];
    const calculated = withCalculatedAgendaTimes(rows);
    expect(calculated.find(item => item.id === 'first')).toMatchObject({
      calculated_start_time: 1_000_000,
      calculated_end_time: 2_800_000,
    });
    expect(calculated.find(item => item.id === 'second')).toMatchObject({
      calculated_start_time: 3_000_000,
      calculated_end_time: 3_600_000,
    });
    expect(calculated.find(item => item.id === 'third')).toMatchObject({
      calculated_start_time: 4_000_000,
      calculated_end_time: 4_300_000,
    });
    expect(calculated.find(item => item.id === 'no-event-id')?.calculated_start_time).toBeUndefined();
    expect(calculated.find(item => item.id === 'no-start')?.calculated_start_time).toBeUndefined();
  });

  it('groups multiple events and appends to existing event buckets', () => {
    const calculated = withCalculatedAgendaTimes([
      { id: 'a', event_id: 'event-a', order_index: 1, duration: 1, event: { start_date: 100 } },
      { id: 'b', event_id: 'event-a', order_index: 2, duration: 1, event: { start_date: 100 } },
      { id: 'c', event_id: 'event-b', order_index: 1, duration: 1, event: { start_date: 200 } },
    ]);
    expect(calculated.map(item => item.calculated_start_time)).toEqual([100, 60_100, 200]);
  });
});

describe('agenda state hook contracts', () => {
  it('selects single- or multi-event rows and combines loading states', () => {
    mocks.results.set('agendas.byEvent', [
      { id: 'single', event_id: 'event-1', duration: 1, event: { start_date: 100 } },
    ]);
    expect(renderHook(() => useAgendaState({ eventId: 'event-1' })).result.current).toMatchObject({
      agendaItems: [{ id: 'single', calculated_start_time: 100 }],
      isLoading: false,
    });

    mocks.results.set('agendas.byEventIds', [
      { id: 'multi', event_id: 'event-2', duration: 1, event: { start_date: 200 } },
    ]);
    expect(renderHook(() => useAgendaState({ eventIds: ['event-2'] })).result.current).toMatchObject({
      agendaItems: [{ id: 'multi', calculated_start_time: 200 }],
      isLoading: false,
    });
    expect(renderHook(() => useAgendaState({ eventIds: [] })).result.current).toEqual({
      agendaItems: [],
      isLoading: false,
    });
    expect(renderHook(() => useAgendaState()).result.current).toEqual({
      agendaItems: [],
      isLoading: false,
    });

    mocks.statuses.set('agendas.byEvent', 'unknown');
    expect(renderHook(() => useAgendaState({ eventId: 'event-1' })).result.current.isLoading).toBe(
      true
    );
    mocks.statuses.delete('agendas.byEvent');
    mocks.statuses.set('agendas.byEventIds', 'unknown');
    expect(renderHook(() => useAgendaState({ eventIds: ['event-2'] })).result.current.isLoading).toBe(
      true
    );
  });

  it('supports timing and optional timeline projections', () => {
    mocks.results.set('agendas.timingByEventIds', [
      { id: 'timing', event_id: 'event-1', event: { start_date: 100 } },
    ]);
    expect(renderHook(() => useAgendaTimingState(['event-1'])).result.current.agendaItems).toHaveLength(
      1
    );
    expect(renderHook(() => useAgendaTimingState()).result.current).toEqual({
      agendaItems: [],
      isLoading: false,
    });
    mocks.statuses.set('agendas.timingByEventIds', 'unknown');
    expect(renderHook(() => useAgendaTimingState(['event-1'])).result.current.isLoading).toBe(true);

    mocks.results.set('agendas.timelineByEventIds', [
      { id: 'timeline', event_id: 'event-1', event: { start_date: 100 } },
    ]);
    expect(
      renderHook(() => useAgendaTimelineState(['event-1'])).result.current.agendaItems
    ).toHaveLength(1);
    expect(renderHook(() => useAgendaTimelineState(['event-1'], false)).result.current).toEqual({
      agendaItems: [],
      isLoading: false,
    });
    expect(renderHook(() => useAgendaTimelineState([], true)).result.current).toEqual({
      agendaItems: [],
      isLoading: false,
    });
    mocks.statuses.set('agendas.timelineByEventIds', 'unknown');
    expect(renderHook(() => useAgendaTimelineState(['event-1'], true)).result.current.isLoading).toBe(
      true
    );
  });

  it('partitions change-request timeline states and annotates vote steps', () => {
    mocks.results.set('agendas.changeRequestTimeline', [
      { id: 'voting', status: 'voting', step_kind: AGENDA_VOTE_STEP_KIND.mergeVariant },
      { id: 'pending', status: 'pending', step_kind: 'change_request' },
      {
        id: 'completed',
        status: 'completed',
        step_kind: AGENDA_VOTE_STEP_KIND.closing,
        is_closing_vote: true,
      },
      { id: 'other', status: 'other', step_kind: 'other' },
    ]);
    const current = renderHook(() => useAgendaItemCRTimeline('agenda-1')).result.current;
    expect(current).toMatchObject({
      currentItem: { id: 'voting' },
      pendingItems: [{ id: 'pending' }],
      completedItems: [{ id: 'completed' }],
      closingVoteItem: { id: 'completed' },
      progress: 0.25,
      isLoading: false,
    });
    expect(current.crTimeline[0]).toHaveProperty('_voteStepKind', AGENDA_VOTE_STEP_KIND.mergeVariant);
    expect(current.crTimeline[2]).toHaveProperty('_voteStepKind', AGENDA_VOTE_STEP_KIND.closing);

    expect(renderHook(() => useAgendaItemCRTimeline(undefined)).result.current).toMatchObject({
      crTimeline: [],
      currentItem: null,
      pendingItems: [],
      completedItems: [],
      closingVoteItem: null,
      progress: 0,
      isLoading: false,
    });
    mocks.statuses.set('agendas.changeRequestTimeline', 'unknown');
    expect(renderHook(() => useAgendaItemCRTimeline('agenda-1')).result.current.isLoading).toBe(true);
  });

  it('returns the first agenda item for an amendment', () => {
    mocks.results.set('agendas.byAmendmentId', [{ id: 'agenda-1' }, { id: 'agenda-2' }]);
    expect(renderHook(() => useAgendaItemByAmendment('amendment-1')).result.current).toEqual({
      agendaItem: { id: 'agenda-1' },
      agendaItemId: 'agenda-1',
      isLoading: false,
    });
    expect(renderHook(() => useAgendaItemByAmendment(undefined)).result.current).toEqual({
      agendaItem: null,
      agendaItemId: undefined,
      isLoading: false,
    });
    mocks.statuses.set('agendas.byAmendmentId', 'unknown');
    expect(renderHook(() => useAgendaItemByAmendment('amendment-1')).result.current.isLoading).toBe(
      true
    );
  });
});
