/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: new Map<string, readonly Record<string, unknown>[]>(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'viewer-1' } }),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    common: { viewerSubscriptions: () => 'subscriptions' },
    rbac: {
      viewerMemberships: () => 'memberships',
      viewerGuestAccesses: () => 'guest-accesses',
      viewerParticipations: () => 'participations',
    },
    amendments: { viewerCollaborations: () => 'collaborations' },
    events: { viewerDelegations: () => 'delegations' },
  },
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: string) => [mocks.rows.get(query) ?? [], { type: 'complete' }],
}));

import { SearchCardStateProvider, useSearchCardState } from '../SearchCardStateProvider';

function requireCardState(state: ReturnType<typeof useSearchCardState>) {
  if (!state) throw new Error('Search card state was not provided');
  return state;
}

afterEach(() => {
  cleanup();
  mocks.rows.clear();
  vi.unstubAllGlobals();
});

describe('SearchCardStateProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 10 });
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });

  it('projects viewer state from entity indexes without mixing unrelated rows', () => {
    mocks.rows.set('subscriptions', [
      {
        id: 'subscription-group',
        subscriber_id: 'viewer-1',
        group_id: 'group-1',
      },
      {
        id: 'subscription-event',
        subscriber_id: 'viewer-1',
        event_id: 'event-1',
      },
    ]);
    mocks.rows.set('memberships', [
      {
        id: 'membership-primary',
        group_id: 'group-1',
        status: 'active',
        membership_roles: [{ role: { name: 'Member', sort_order: 1 } }],
      },
      {
        id: 'membership-connected',
        group_id: 'group-2',
        status: 'active',
        membership_roles: [],
      },
    ]);
    mocks.rows.set('guest-accesses', [{ id: 'guest-1', group_id: 'group-1', status: 'accepted' }]);
    mocks.rows.set('participations', [
      {
        id: 'participation-1',
        event_id: 'event-1',
        user_id: 'viewer-1',
        status: 'active',
      },
    ]);
    mocks.rows.set('collaborations', [
      { id: 'collaboration-1', amendment_id: 'amendment-1', status: 'active' },
    ]);
    mocks.rows.set('delegations', [
      { event_id: 'event-1', user_id: 'delegate-1', status: 'active' },
    ]);

    let state: ReturnType<typeof useSearchCardState> = null;
    function CaptureState() {
      state = useSearchCardState();
      return null;
    }

    render(
      <SearchCardStateProvider>
        <CaptureState />
      </SearchCardStateProvider>
    );

    const cardState = requireCardState(state);

    expect(cardState.isReady).toBe(true);
    expect(cardState.getSubscriptionState('group', 'group-1', 7)).toEqual({
      subscriberCount: 7,
      subscriptions: [{ id: 'subscription-group', subscriber_id: 'viewer-1' }],
      isLoading: false,
    });
    expect(cardState.getSubscriptionState('group', 'group-unknown', 0).subscriptions).toEqual([]);

    const groupState = cardState.getGroupState({
      id: 'group-1',
      connectedGroupId: 'group-2',
      memberCount: 4,
    });
    expect(groupState?.memberships).toEqual([
      {
        id: 'membership-primary',
        status: 'active',
        role: { name: 'Member' },
      },
    ]);
    expect(groupState?.connectedGroupMemberships).toHaveLength(1);
    expect(groupState?.guestAccesses).toEqual([{ id: 'guest-1', status: 'accepted' }]);

    const eventState = cardState.getEventState({
      id: 'event-1',
      participantCount: 3,
      visibility: 'public',
      groupId: 'group-1',
    });
    expect(eventState?.participants).toEqual([
      {
        id: 'participation-1',
        user_id: 'viewer-1',
        status: 'active',
      },
    ]);
    expect(eventState?.event.delegates).toEqual([{ user_id: 'delegate-1', status: 'active' }]);
    expect(eventState?.event.group?.memberships).toEqual([
      { user_id: 'viewer-1', status: 'active' },
    ]);

    expect(cardState.getAmendmentState('amendment-1', 2)).toEqual({
      collaborations: [{ id: 'collaboration-1', status: 'active' }],
      collaboratorCount: 2,
      isLoading: false,
    });
  });
});
