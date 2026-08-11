/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { groupConflictPreflightFn } = vi.hoisted(() => ({
  groupConflictPreflightFn: vi.fn(),
}));

vi.mock('@/server/group-conflict-preflight', () => ({
  groupConflictPreflightFn,
}));

import { useGroupConflictPreflight } from '../useGroupConflictPreflight';

afterEach(() => {
  vi.clearAllMocks();
});

describe('useGroupConflictPreflight', () => {
  it('does not commit an invalid server response to render state', async () => {
    groupConflictPreflightFn.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useGroupConflictPreflight({
        kind: 'membership_activation',
        group_id: 'group-1',
        user_id: 'user-1',
      })
    );

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    expect(result.current.response).toMatchObject({
      blocking: false,
      conflicts: [],
    });
    expect(result.current.blocking).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('commits a valid conflict response', async () => {
    groupConflictPreflightFn.mockResolvedValueOnce({
      blocking: false,
      summary: 'Checked',
      conflicts: [],
    });

    const { result } = renderHook(() =>
      useGroupConflictPreflight({
        kind: 'membership_activation',
        group_id: 'group-1',
        user_id: 'user-1',
      })
    );

    await waitFor(() =>
      expect(result.current.response).toEqual({
        blocking: false,
        summary: 'Checked',
        conflicts: [],
      })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
