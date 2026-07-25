/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { countUnreadMessageSummaries, useUnreadNotificationsCount } from '../use-unread-counts';

const mocks = vi.hoisted(() => ({
  rows: [] as {
    viewer_state?: {
      read_at?: number | null;
      dismissed_at?: number | null;
      purged_at?: number | null;
    }[];
  }[],
}));

vi.mock('@/providers/auth-provider.tsx', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [mocks.rows, { type: 'complete' }],
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    notifications: {
      countProjection: (args: unknown) => args,
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
});
