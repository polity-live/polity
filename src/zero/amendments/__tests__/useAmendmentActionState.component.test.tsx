/* @vitest-environment jsdom */
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const results = new Map<string, unknown>();
  const statuses = new Map<string, string>();
  const query = (key: string) => (args: unknown) => ({ key, args });
  return {
    results,
    statuses,
    queries: {
      amendments: {
        byId: query('byId'),
        subscribers: query('subscribers'),
        collaborators: query('collaborators'),
        userCollaboration: query('userCollaboration'),
      },
    },
    useQuery: vi.fn((request?: { key: string; args: unknown }) => [
      request ? results.get(request.key) : undefined,
      { type: request ? (statuses.get(request.key) ?? 'complete') : 'unknown' },
    ]),
  };
});
vi.mock('@/zero/observed-query', () => ({ useQuery: state.useQuery }));
vi.mock('../../queries', () => ({ queries: state.queries }));

import {
  useAmendmentCollaborationState,
  useAmendmentSubscriptionState,
} from '../useAmendmentActionState';

afterEach(cleanup);
beforeEach(() => {
  state.results.clear();
  state.statuses.clear();
  state.useQuery.mockClear();
});

describe('focused amendment action state', () => {
  it('uses protected subscribers and preserves count fallback while their result is pending', () => {
    state.results.set('byId', { subscriber_count: 8 });
    state.results.set('subscribers', [{ id: 'subscription', subscriber_id: 'user' }]);
    state.statuses.set('subscribers', 'unknown');
    const hook = renderHook(() =>
      useAmendmentSubscriptionState({ amendmentId: 'amendment', userId: 'user' })
    );
    expect(hook.result.current).toMatchObject({ subscriberCount: 8, isLoading: true });
    expect(state.useQuery.mock.calls.map(([request]) => request)).toEqual([
      { key: 'byId', args: { id: 'amendment' } },
      { key: 'subscribers', args: { amendment_id: 'amendment' } },
    ]);
    state.statuses.set('subscribers', 'complete');
    hook.rerender();
    expect(hook.result.current).toMatchObject({ subscriberCount: 1, isLoading: false });
  });

  it.each(['invited', 'requested', 'active', 'collaborator', 'member', 'admin'] as const)(
    'preserves the own collaboration status %s and authoritative aggregate count',
    status => {
      state.results.set('byId', { collaborator_count: 9 });
      state.results.set('collaborators', [{ status: 'member' }]);
      state.results.set('userCollaboration', [{ id: 'own', status }]);
      const hook = renderHook(() =>
        useAmendmentCollaborationState({ amendmentId: 'amendment', userId: 'user' })
      );
      expect(hook.result.current).toMatchObject({
        collaboration: { id: 'own', status },
        status,
        collaboratorCount: 9,
        isInvited: status === 'invited',
        hasRequested: status === 'requested',
        isAdmin: status === 'admin',
        isCollaborator: !['invited', 'requested'].includes(status),
        isLoading: false,
      });
      expect(state.useQuery.mock.calls.map(([request]) => request)).toEqual([
        { key: 'byId', args: { id: 'amendment' } },
        { key: 'collaborators', args: { amendment_id: 'amendment' } },
        { key: 'userCollaboration', args: { amendment_id: 'amendment', user_id: 'user' } },
      ]);
    }
  );

  it('counts active roster aliases when an aggregate is absent and waits for own status', () => {
    state.results.set(
      'collaborators',
      ['active', 'collaborator', 'member', 'admin', 'invited', 'requested'].map(status => ({
        status,
      }))
    );
    state.statuses.set('userCollaboration', 'unknown');
    const hook = renderHook(() =>
      useAmendmentCollaborationState({ amendmentId: 'amendment', userId: 'user' })
    );
    expect(hook.result.current).toMatchObject({ collaboratorCount: 4, isLoading: true });
    state.statuses.set('userCollaboration', 'complete');
    hook.rerender();
    expect(hook.result.current.isLoading).toBe(false);
  });

  it('removes status and counts when the protected queries revoke their results', () => {
    state.results.set('byId', { collaborator_count: 9 });
    state.results.set('collaborators', [{ status: 'member' }]);
    state.results.set('userCollaboration', [{ id: 'own', status: 'invited' }]);
    const hook = renderHook(() =>
      useAmendmentCollaborationState({ amendmentId: 'amendment', userId: 'user' })
    );
    expect(hook.result.current.isInvited).toBe(true);
    state.results.set('byId', undefined);
    state.results.set('collaborators', []);
    state.results.set('userCollaboration', []);
    hook.rerender();
    expect(hook.result.current).toMatchObject({
      collaboration: null,
      status: null,
      collaboratorCount: 0,
      isInvited: false,
      isCollaborator: false,
    });
  });

  it('keeps every query disabled when card projections supply the action state', () => {
    const hook = renderHook(() => ({
      subscription: useAmendmentSubscriptionState(),
      collaboration: useAmendmentCollaborationState(),
    }));
    expect(state.useQuery.mock.calls.every(([request]) => request === undefined)).toBe(true);
    expect(state.useQuery).toHaveBeenCalledTimes(5);
    expect(hook.result.current.subscription.isLoading).toBe(false);
    expect(hook.result.current.collaboration.isLoading).toBe(false);
  });
});
