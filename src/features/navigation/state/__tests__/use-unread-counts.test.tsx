/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUnreadNotificationsCount } from '../use-unread-counts';

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
      countRows: (args: unknown) => args,
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
