/* @vitest-environment jsdom */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupConflictError, buildGroupConflictResponse } from '../../logic/groupConflict';

const mocks = vi.hoisted(() => ({ preflight: vi.fn() }));
vi.mock('@/server/group-conflict-preflight', () => ({ groupConflictPreflightFn: mocks.preflight }));

import { useGroupConflictPreflight } from '../useGroupConflictPreflight';
import { useMembershipActivationPreflight } from '../useMembershipActivationPreflight';

const conflict = (summary = 'Conflict') =>
  buildGroupConflictResponse([
    {
      kind: 'permission_blocked_resolution',
      blocking: true,
      summary,
      explanation: summary,
      details: { users: [], groups: [], source_groups: [], paths: [] },
      resolutions: [],
    },
  ]);
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (reason: any) => void;
  const promise = new Promise<any>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  mocks.preflight.mockReset();
});
afterEach(cleanup);

describe('useGroupConflictPreflight', () => {
  it('resets when disabled or without input and resolves successful requests', async () => {
    const empty = renderHook(() => useGroupConflictPreflight(null));
    expect(empty.result.current).toMatchObject({ blocking: false, isLoading: false, error: null });
    empty.unmount();
    const disabled = renderHook(() =>
      useGroupConflictPreflight(
        { kind: 'membership_activation', group_id: 'g' },
        { enabled: false }
      )
    );
    expect(disabled.result.current.blocking).toBe(false);
    disabled.unmount();

    mocks.preflight.mockResolvedValueOnce(conflict());
    const hook = renderHook(() =>
      useGroupConflictPreflight({ kind: 'membership_activation', group_id: 'g' })
    );
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.blocking).toBe(true);
  });

  it('converts conflict errors and reports Error and non-Error failures', async () => {
    mocks.preflight.mockRejectedValueOnce(new GroupConflictError(conflict('Caught')));
    let hook = renderHook(() =>
      useGroupConflictPreflight({ kind: 'membership_activation', group_id: 'g' })
    );
    await waitFor(() => expect(hook.result.current.blocking).toBe(true));
    expect(hook.result.current.error).toBeNull();
    hook.unmount();

    mocks.preflight.mockRejectedValueOnce(new Error('failed'));
    hook = renderHook(() =>
      useGroupConflictPreflight({ kind: 'membership_activation', group_id: 'g2' })
    );
    await waitFor(() => expect(hook.result.current.error?.message).toBe('failed'));
    hook.unmount();

    mocks.preflight.mockRejectedValueOnce('failed');
    hook = renderHook(() =>
      useGroupConflictPreflight({ kind: 'membership_activation', group_id: 'g3' })
    );
    await waitFor(() => expect(hook.result.current.error?.message).toBe('Preflight failed'));
  });

  it('ignores success and failure completion after cancellation', async () => {
    const success = deferred();
    mocks.preflight.mockReturnValueOnce(success.promise);
    let hook = renderHook(() =>
      useGroupConflictPreflight({ kind: 'membership_activation', group_id: 'success' })
    );
    hook.unmount();
    success.resolve(buildGroupConflictResponse([]));
    await success.promise;

    const failure = deferred();
    mocks.preflight.mockReturnValueOnce(failure.promise);
    hook = renderHook(() =>
      useGroupConflictPreflight({ kind: 'membership_activation', group_id: 'failure' })
    );
    hook.unmount();
    failure.reject(new Error('cancelled'));
    await failure.promise.catch(() => undefined);
  });
});

describe('useMembershipActivationPreflight', () => {
  it('normalizes ids, merges successes and conflict errors, and supports disabled requests', async () => {
    const empty = renderHook(() => useMembershipActivationPreflight(null, []));
    expect(empty.result.current.blocking).toBe(false);
    empty.unmount();
    const disabled = renderHook(() =>
      useMembershipActivationPreflight('g', ['u'], { enabled: false })
    );
    expect(disabled.result.current.isLoading).toBe(false);
    disabled.unmount();

    mocks.preflight
      .mockResolvedValueOnce(buildGroupConflictResponse([]))
      .mockRejectedValueOnce(new GroupConflictError(conflict()));
    const hook = renderHook(() => useMembershipActivationPreflight('g', ['u2', '', 'u1', 'u2']));
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(mocks.preflight).toHaveBeenCalledTimes(2);
    expect(mocks.preflight.mock.calls[0][0].data.user_id).toBe('u1');
    expect(hook.result.current.blocking).toBe(true);
  });

  it('reports Error and non-Error failures', async () => {
    mocks.preflight.mockRejectedValueOnce(new Error('membership failed'));
    let hook = renderHook(() => useMembershipActivationPreflight('g', ['u']));
    await waitFor(() => expect(hook.result.current.error?.message).toBe('membership failed'));
    hook.unmount();
    mocks.preflight.mockRejectedValueOnce('bad');
    hook = renderHook(() => useMembershipActivationPreflight('g2', ['u']));
    await waitFor(() => expect(hook.result.current.error?.message).toBe('Preflight failed'));
  });

  it('ignores merged and rejected results after cancellation', async () => {
    const success = deferred();
    mocks.preflight.mockReturnValueOnce(success.promise);
    let hook = renderHook(() => useMembershipActivationPreflight('g', ['u']));
    hook.unmount();
    success.resolve(buildGroupConflictResponse([]));
    await success.promise;

    const failure = deferred();
    mocks.preflight.mockReturnValueOnce(failure.promise);
    hook = renderHook(() => useMembershipActivationPreflight('g2', ['u']));
    hook.unmount();
    failure.reject(new Error('cancelled'));
    await failure.promise.catch(() => undefined);
  });
});
