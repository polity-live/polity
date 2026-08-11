/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countUnreadMessageSummaries,
  countUnreadNotifications,
  useUnreadMessagesCount,
  useUnreadNotificationsCount,
} from '../use-unread-counts';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  resultType: 'complete',
  rows: [] as {
    viewer_state?: {
      read_at?: number | null;
      dismissed_at?: number | null;
      purged_at?: number | null;
    }[];
  }[],
}));

vi.mock('@/providers/auth-provider.tsx', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [mocks.rows, { type: mocks.resultType }],
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    notifications: {
      countProjection: (args: unknown) => args,
    },
    messages: {
      unreadSummary: (args: unknown) => args,
    },
  },
}));

function row(read: boolean, dismissed = false) {
  return {
    viewer_state: [
      {
        read_at: read ? 1 : null,
        dismissed_at: dismissed ? 1 : null,
        purged_at: null,
      },
    ],
  };
}

describe('useUnreadNotificationsCount', () => {
  beforeEach(() => {
    mocks.user = { id: 'user-1' };
    mocks.resultType = 'complete';
    mocks.rows = [row(false), row(false)];
  });

  it('reactively derives the primary navigation badge from viewer_state', () => {
    const { result, rerender } = renderHook(() => useUnreadNotificationsCount());
    expect(result.current.count).toBe(2);

    mocks.rows = [row(true), row(false)];
    rerender();
    expect(result.current.count).toBe(1);

    mocks.rows = [row(true), row(true)];
    rerender();
    expect(result.current.count).toBe(0);
  });

  it('does not count dismissed notifications as unread', () => {
    mocks.rows = [row(false, true), row(false)];
    const { result } = renderHook(() => useUnreadNotificationsCount());
    expect(result.current.count).toBe(1);
  });

  it('supports missing rows and reports loading only for an authenticated unknown query', () => {
    expect(countUnreadNotifications(undefined)).toBe(0);
    mocks.rows = [];
    mocks.resultType = 'unknown';
    const authenticated = renderHook(() => useUnreadNotificationsCount());
    expect(authenticated.result.current.isLoading).toBe(true);
    authenticated.unmount();

    mocks.user = null;
    const anonymous = renderHook(() => useUnreadNotificationsCount());
    expect(anonymous.result.current).toEqual({ count: 0, isLoading: false });
  });
});

describe('countUnreadMessageSummaries', () => {
  it('adds persisted unread counts and an unread incoming request exactly once', () => {
    expect(
      countUnreadMessageSummaries(
        [
          {
            user_id: 'user-1',
            unread_count: 3,
            last_read_at: 10,
            conversation: {
              type: 'direct',
              status: 'pending',
              requested_by_id: 'user-2',
              created_at: 20,
            },
          },
          {
            user_id: 'user-1',
            unread_count: 2,
            last_read_at: 30,
            conversation: {
              type: 'direct',
              status: 'active',
              requested_by_id: 'user-2',
              created_at: 20,
            },
          },
        ],
        'user-1'
      )
    ).toBe(6);
  });

  it('does not add a request badge for the requester, read requests, groups, or events', () => {
    const conversations = [
      { type: 'direct', requested_by_id: 'user-1', lastReadAt: 0 },
      { type: 'direct', requested_by_id: 'user-2', lastReadAt: 20 },
      { type: 'group', requested_by_id: 'user-2', lastReadAt: 0 },
      { type: 'event', requested_by_id: 'user-2', lastReadAt: 0 },
    ];
    const rows = conversations.map(({ lastReadAt, ...conversation }) => ({
      unread_count: 0,
      last_read_at: lastReadAt,
      conversation: {
        ...conversation,
        status: 'pending',
        created_at: 20,
      },
    }));

    expect(countUnreadMessageSummaries(rows, 'user-1')).toBe(0);
  });

  it('handles missing users, rows, conversations, and zero creation timestamps', () => {
    expect(countUnreadMessageSummaries([], undefined)).toBe(0);
    expect(countUnreadMessageSummaries(undefined, 'user-1')).toBe(0);
    expect(
      countUnreadMessageSummaries(
        [
          { conversation: null },
          {
            conversation: {
              type: 'direct',
              status: 'pending',
              requested_by_id: 'user-2',
              created_at: 0,
            },
          },
          {
            conversation: {
              type: 'direct',
              status: 'pending',
              requested_by_id: 'user-2',
              created_at: 20,
            },
          },
        ],
        'user-1'
      )
    ).toBe(1);
  });

  it('reports message loading state for authenticated and anonymous users', () => {
    mocks.rows = [];
    mocks.resultType = 'unknown';
    mocks.user = { id: 'user-1' };
    const authenticated = renderHook(() => useUnreadMessagesCount());
    expect(authenticated.result.current.isLoading).toBe(true);
    authenticated.unmount();

    mocks.user = null;
    const anonymous = renderHook(() => useUnreadMessagesCount());
    expect(anonymous.result.current).toEqual({ count: 0, isLoading: false });
  });
});
