/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSearchData } from '../useSearchData';

const useAuthMock = vi.fn();
const useSearchStateMock = vi.fn();

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/zero/shared/useSearchState', () => ({
  useSearchState: (options: unknown) => useSearchStateMock(options),
}));

function searchState(events: unknown[] | null | undefined = []) {
  return {
    users: ['user'],
    groups: ['group'],
    statements: ['statement'],
    blogs: ['blog'],
    amendments: ['amendment'],
    events,
    todos: ['todo'],
    timelineEvents: ['timeline'],
    elections: ['election'],
    eventVotingSessions: ['vote'],
    agendaItems: ['agenda'],
    isLoading: false,
  };
}

describe('useSearchData branch matrix', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useSearchStateMock.mockReset();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    useSearchStateMock.mockReturnValue(searchState());
  });

  it('uses default query and cursor limits', () => {
    const { result } = renderHook(() => useSearchData());

    expect(useSearchStateMock).toHaveBeenCalledWith({
      userId: 'user-1',
      query: '',
      limits: {
        users: 20,
        groups: 20,
        statements: 20,
        blogs: 20,
        amendments: 20,
        events: 20,
        todos: 20,
      },
    });
    expect(result.current.currentUserId).toBe('user-1');
    expect(result.current.pageInfo).toBeUndefined();
  });

  it('passes every explicit limit including zero and filters bookable events', () => {
    useSearchStateMock.mockReturnValue(
      searchState([
        { id: 'public-event', is_bookable: false },
        { id: 'bookable-event', is_bookable: true },
        { id: 'unset-event' },
      ])
    );

    const { result } = renderHook(() =>
      useSearchData('assembly', {
        users: { first: 1 },
        groups: { first: 2 },
        statements: { first: 3 },
        todos: { first: 4 },
        blogs: { first: 5 },
        amendments: { first: 6 },
        events: { first: 0 },
      })
    );

    expect(useSearchStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'assembly',
        limits: {
          users: 1,
          groups: 2,
          statements: 3,
          blogs: 5,
          amendments: 6,
          events: 0,
          todos: 4,
        },
      })
    );
    expect(result.current.data.events).toEqual([
      { id: 'public-event', is_bookable: false },
      { id: 'unset-event' },
    ]);
  });

  it('falls back per missing cursor and tolerates missing events and user', () => {
    useAuthMock.mockReturnValue({ user: null });
    useSearchStateMock.mockReturnValue(searchState(null));

    const { result } = renderHook(() =>
      useSearchData('query', {
        users: undefined,
        groups: undefined,
        statements: undefined,
        todos: undefined,
        blogs: undefined,
        amendments: undefined,
        events: undefined,
      })
    );

    expect(useSearchStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: undefined,
        limits: {
          users: 20,
          groups: 20,
          statements: 20,
          blogs: 20,
          amendments: 20,
          events: 20,
          todos: 20,
        },
      })
    );
    expect(result.current.data.events).toEqual([]);
    expect(result.current.currentUserId).toBeUndefined();
  });
});
