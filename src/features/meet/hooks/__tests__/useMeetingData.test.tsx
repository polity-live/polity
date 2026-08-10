/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMeetingData } from '../useMeetingData';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as null | { id: string },
  events: [] as any[],
  result: { type: 'complete' } as any,
  query: vi.fn((input: unknown) => input),
  bookingCount: vi.fn(),
  bookedByUser: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [mocks.events, mocks.result],
}));
vi.mock('@/zero/queries', () => ({
  queries: { events: { byIdFull: mocks.query } },
}));
vi.mock('@/zero/events/useMeetingState', () => ({
  getInstanceBookingCount: (...args: any[]) => mocks.bookingCount(...args),
  isBookedByUser: (...args: any[]) => mocks.bookedByUser(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.events = [];
  mocks.result = { type: 'complete' };
  mocks.bookingCount.mockReturnValue(1);
  mocks.bookedByUser.mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useMeetingData', () => {
  it('returns deterministic empty and loading state before a meeting resolves', () => {
    mocks.result = { type: 'unknown' };
    const { result } = renderHook(() => useMeetingData('event-1'));
    expect(result.current).toEqual({
      event: undefined,
      isLoading: true,
      error: null,
      isAuthenticated: true,
      isOwner: false,
      hasBooked: false,
      bookingCount: 0,
      isPast: false,
      isAvailable: false,
    });
    expect(mocks.query).toHaveBeenCalledWith({ id: 'event-1' });
  });

  it('derives ownership, booking, capacity, and temporal availability from participants', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 2));
    mocks.events = [
      {
        id: 'event-1',
        creator_id: 'user-1',
        start_date: new Date(2026, 7, 3).getTime(),
        end_date: new Date(2026, 7, 3, 1).getTime(),
        max_bookings: 3,
        is_bookable: true,
        participants: [{ user_id: 'user-2' }],
      },
    ];
    const { result } = renderHook(() => useMeetingData('event-1'));
    expect(result.current).toMatchObject({
      isOwner: true,
      hasBooked: true,
      bookingCount: 1,
      isPast: false,
      isAvailable: true,
      isAuthenticated: true,
    });
    expect(mocks.bookedByUser).toHaveBeenCalledWith([{ user_id: 'user-2' }], 'user-1', null);
    expect(mocks.bookingCount).toHaveBeenCalledWith([{ user_id: 'user-2' }], 'user-1', null);
  });

  it('uses anonymous, participant, time, and capacity fallbacks for sparse events', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 2));
    mocks.user = null;
    mocks.bookingCount.mockReturnValue(1);
    mocks.events = [
      {
        id: 'event-1',
        creator_id: 'owner-1',
        start_date: null,
        end_date: null,
        max_bookings: null,
        is_bookable: true,
        participants: null,
      },
    ];

    const { result } = renderHook(() => useMeetingData('event-1'));
    expect(result.current).toMatchObject({
      isAuthenticated: false,
      isOwner: false,
      hasBooked: false,
      bookingCount: 1,
      isPast: true,
      isAvailable: false,
    });
    expect(mocks.bookedByUser).not.toHaveBeenCalled();
    expect(mocks.bookingCount).toHaveBeenCalledWith([], 'owner-1', null);
  });

  it('falls back from a missing end date to the start date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 2));
    mocks.bookingCount.mockReturnValue(0);
    mocks.events = [
      {
        id: 'event-1',
        creator_id: 'owner-1',
        start_date: new Date(2026, 7, 3).getTime(),
        end_date: null,
        max_bookings: 2,
        is_bookable: true,
        participants: [],
      },
    ];
    expect(renderHook(() => useMeetingData('event-1')).result.current.isAvailable).toBe(true);
  });
});
