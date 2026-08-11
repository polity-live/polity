/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  byCreator: vi.fn((args: unknown) => ({ name: 'byCreator', args })),
}));

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));
vi.mock('../../queries', () => ({ queries: { events: { byCreator: mocks.byCreator } } }));

import { getInstanceBookingCount, isBookedByUser, useMeetingsByCreator } from '../useMeetingState';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useQuery.mockReturnValue([undefined, { type: 'unknown' }]);
});

describe('meeting state', () => {
  it('skips anonymous queries and filters only configured meetings', () => {
    expect(renderHook(() => useMeetingsByCreator()).result.current).toEqual({
      meetings: [],
      isLoading: true,
    });
    expect(mocks.byCreator).not.toHaveBeenCalled();

    mocks.useQuery.mockReturnValue([
      [
        { id: 'missing', meeting_type: null },
        { id: 'empty', meeting_type: '' },
        { id: 'meeting', meeting_type: 'office-hours' },
      ],
      { type: 'complete' },
    ]);
    const state = renderHook(() => useMeetingsByCreator('user-1')).result.current;
    expect(state.meetings).toEqual([{ id: 'meeting', meeting_type: 'office-hours' }]);
    expect(state.isLoading).toBe(false);
  });

  it('counts and finds bookings for recurring and unscoped instances', () => {
    const participants = [
      { user_id: 'creator', instance_date: null },
      { user_id: 'user-null', instance_date: null },
      { user_id: 'user-undefined' },
      { user_id: 'user-zero', instance_date: 0 },
      { user_id: 'user-match', instance_date: 100 },
      { user_id: 'user-other', instance_date: 200 },
    ];

    expect(getInstanceBookingCount(participants, 'creator', null)).toBe(3);
    expect(getInstanceBookingCount(participants, 'creator', undefined as never)).toBe(3);
    expect(getInstanceBookingCount(participants, 'creator', 100)).toBe(1);
    expect(isBookedByUser(participants, 'missing', null)).toBe(false);
    expect(isBookedByUser(participants, 'user-null', null)).toBe(true);
    expect(isBookedByUser(participants, 'user-undefined', undefined as never)).toBe(true);
    expect(isBookedByUser(participants, 'user-zero', null)).toBe(true);
    expect(isBookedByUser(participants, 'user-match', 100)).toBe(true);
    expect(isBookedByUser(participants, 'user-other', 100)).toBe(false);
  });
});
