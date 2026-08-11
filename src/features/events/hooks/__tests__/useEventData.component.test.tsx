/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  event: null as Record<string, unknown> | null,
  eventLoading: false,
  participants: [] as Record<string, unknown>[],
  participantsLoading: false,
  agendaItems: [] as Record<string, unknown>[],
  agendaLoading: false,
  byId: vi.fn(),
  participantsQuery: vi.fn(),
  agendaQuery: vi.fn(),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useEventById: (...args: unknown[]) => mocks.byId(...args),
  useEventParticipantsQuery: (...args: unknown[]) => mocks.participantsQuery(...args),
  useEventAgenda: (...args: unknown[]) => mocks.agendaQuery(...args),
}));

import { useEventAgenda, useEventData, useEventParticipants } from '../useEventData';

beforeEach(() => {
  mocks.event = null;
  mocks.eventLoading = false;
  mocks.participants = [];
  mocks.participantsLoading = false;
  mocks.agendaItems = [];
  mocks.agendaLoading = false;
  mocks.byId.mockReset();
  mocks.byId.mockImplementation(() => ({ event: mocks.event, isLoading: mocks.eventLoading }));
  mocks.participantsQuery.mockReset();
  mocks.participantsQuery.mockImplementation(() => ({
    participants: mocks.participants,
    isLoading: mocks.participantsLoading,
  }));
  mocks.agendaQuery.mockReset();
  mocks.agendaQuery.mockImplementation(() => ({
    agendaItems: mocks.agendaItems,
    isLoading: mocks.agendaLoading,
  }));
});

describe('useEventData', () => {
  it('returns empty related collections for an absent loading event', () => {
    mocks.eventLoading = true;
    expect(renderHook(() => useEventData()).result.current).toEqual({
      event: null,
      participants: [],
      delegates: [],
      agendaItems: [],
      roles: [],
      participantStats: { total: 0, members: 0, admins: 0, invited: 0, requested: 0 },
      isLoading: true,
      error: undefined,
    });
    expect(mocks.byId).toHaveBeenCalledWith(undefined);
  });

  it('derives every participant statistic and returns event relations', () => {
    const participants = [
      { id: 'active', status: 'active' },
      { id: 'member', status: 'member' },
      { id: 'admin', status: 'admin' },
      { id: 'confirmed', status: 'confirmed' },
      { id: 'invited', status: 'invited' },
      { id: 'requested', status: 'requested' },
      { id: 'other', status: 'declined' },
    ];
    mocks.event = {
      id: 'event-1',
      participants,
      delegates: [{ id: 'delegate-1' }],
      agenda_items: [{ id: 'agenda-1' }],
      roles: [{ id: 'role-1' }],
    };

    const state = renderHook(() => useEventData('event-1')).result.current;

    expect(state.participants).toBe(participants);
    expect(state.delegates).toEqual([{ id: 'delegate-1' }]);
    expect(state.agendaItems).toEqual([{ id: 'agenda-1' }]);
    expect(state.roles).toEqual([{ id: 'role-1' }]);
    expect(state.participantStats).toEqual({
      total: 7,
      members: 4,
      admins: 1,
      invited: 1,
      requested: 1,
    });
  });

  it('falls back for missing relation fields on an existing event', () => {
    mocks.event = { id: 'event-1' };
    expect(renderHook(() => useEventData('event-1')).result.current).toMatchObject({
      participants: [],
      delegates: [],
      agendaItems: [],
      roles: [],
    });
  });
});

describe('useEventParticipants', () => {
  it('partitions all active aliases, invitations, requests, and ignored statuses', () => {
    mocks.participants = [
      { id: 'active', status: 'active' },
      { id: 'member', status: 'member' },
      { id: 'admin', status: 'admin' },
      { id: 'confirmed', status: 'confirmed' },
      { id: 'invited', status: 'invited' },
      { id: 'requested', status: 'requested' },
      { id: 'other', status: 'declined' },
    ];
    mocks.participantsLoading = true;

    const state = renderHook(() => useEventParticipants('event-1')).result.current;

    expect(state.activeParticipants.map(item => item.id)).toEqual([
      'active',
      'member',
      'admin',
      'confirmed',
    ]);
    expect(state.invitedParticipants.map(item => item.id)).toEqual(['invited']);
    expect(state.requestedParticipants.map(item => item.id)).toEqual(['requested']);
    expect(state.isLoading).toBe(true);
    expect(mocks.participantsQuery).toHaveBeenCalledWith('event-1');
  });

  it('preserves the normalized empty array contract', () => {
    expect(renderHook(() => useEventParticipants()).result.current.participants).toEqual([]);
  });
});

describe('useEventAgenda', () => {
  it('passes through normalized agenda items and loading state', () => {
    mocks.agendaItems = [{ id: 'agenda-1' }];
    mocks.agendaLoading = true;
    expect(renderHook(() => useEventAgenda('event-1')).result.current).toEqual({
      agendaItems: [{ id: 'agenda-1' }],
      isLoading: true,
    });
    expect(mocks.agendaQuery).toHaveBeenCalledWith('event-1');
  });
});
