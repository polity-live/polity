// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchCardStateProvider, useSearchCardState } from '../SearchCardStateProvider';

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  rows: new Map<string, any>(),
  resultTypes: new Map<string, string>(),
  queries: [] as (string | undefined)[],
  rafCallbacks: [] as FrameRequestCallback[],
  idleCallbacks: [] as IdleRequestCallback[],
  cancelAnimationFrame: vi.fn(),
  cancelIdleCallback: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
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
  useQuery: (query: string | undefined) => {
    mocks.queries.push(query);
    return [
      query ? mocks.rows.get(query) : undefined,
      { type: query ? (mocks.resultTypes.get(query) ?? 'complete') : 'unknown' },
    ];
  },
}));

type CardState = ReturnType<typeof useSearchCardState>;
let latestState: CardState = null;

function Capture() {
  latestState = useSearchCardState();
  return null;
}

function ProviderHarness() {
  return (
    <SearchCardStateProvider>
      <Capture />
    </SearchCardStateProvider>
  );
}

function installAnimationFrame() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    mocks.rafCallbacks.push(callback);
    return mocks.rafCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', mocks.cancelAnimationFrame);
}

function installIdleCallbacks() {
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
    mocks.idleCallbacks.push(callback);
    return mocks.idleCallbacks.length;
  });
  vi.stubGlobal('cancelIdleCallback', mocks.cancelIdleCallback);
}

function invokeIdle(index: number) {
  act(() => mocks.idleCallbacks[index]({ didTimeout: false, timeRemaining: () => 10 }));
}

describe('SearchCardStateProvider remaining branches', () => {
  beforeEach(() => {
    latestState = null;
    mocks.user = null;
    mocks.rows.clear();
    mocks.resultTypes.clear();
    mocks.queries = [];
    mocks.rafCallbacks = [];
    mocks.idleCallbacks = [];
    mocks.cancelAnimationFrame.mockReset();
    mocks.cancelIdleCallback.mockReset();
    installAnimationFrame();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns null outside the provider and projects ready anonymous fallback state', () => {
    const outside = render(<Capture />);
    expect(latestState).toBeNull();
    outside.unmount();

    render(<ProviderHarness />);
    expect(mocks.rafCallbacks).toHaveLength(0);
    expect(mocks.queries.every(query => query === undefined)).toBe(true);
    expect(latestState?.isReady).toBe(true);
    expect(latestState?.getSubscriptionState('user', 'missing', 0)).toMatchObject({
      subscriptions: [],
      isLoading: false,
    });
    expect(latestState?.getGroupState({ id: 'missing', memberCount: 0 })).toMatchObject({
      memberships: [],
      connectedGroupMemberships: [],
      guestAccesses: [],
      isLoading: false,
    });
    expect(
      latestState?.getGroupState({
        id: 'missing',
        connectedGroupId: 'also-missing',
        memberCount: 0,
      }).connectedGroupMemberships
    ).toEqual([]);
    expect(
      latestState?.getEventState({
        id: 'missing',
        participantCount: 0,
        visibility: 'public',
      })
    ).toMatchObject({ event: { group: null, delegates: [] }, participants: [], isLoading: false });
    expect(
      latestState?.getEventState({
        id: 'missing',
        groupId: 'missing-group',
        participantCount: 0,
        visibility: 'public',
      }).event.group?.memberships
    ).toEqual([]);
    expect(latestState?.getAmendmentState('missing', 0)).toMatchObject({
      collaborations: [],
      isLoading: false,
    });
  });

  it('uses fallback timers, stops on an unknown result and clears pending timers', () => {
    vi.useFakeTimers();
    installAnimationFrame();
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.stubGlobal('cancelIdleCallback', undefined);
    mocks.user = { id: 'viewer' };
    mocks.resultTypes.set('subscriptions', 'unknown');
    const rendered = render(<ProviderHarness />);

    act(() => mocks.rafCallbacks[0](0));
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(16));
    expect(mocks.queries).toContain('subscriptions');
    expect(latestState?.isReady).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    rendered.unmount();
    expect(mocks.cancelAnimationFrame).toHaveBeenCalled();

    mocks.resultTypes.set('subscriptions', 'complete');
    const pending = render(<ProviderHarness />);
    act(() => mocks.rafCallbacks.at(-1)?.(0));
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(16));
    expect(vi.getTimerCount()).toBe(1);
    pending.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('indexes all entity rows, roles and duplicate keys through controlled idle stages', () => {
    installIdleCallbacks();
    mocks.user = { id: 'viewer' };
    mocks.rows.set('subscriptions', [
      {
        id: 'all',
        subscriber_id: 'viewer',
        user_id: 'user',
        group_id: 'group',
        amendment_id: 'amendment',
        event_id: 'event',
        blog_id: 'blog',
      },
      { id: 'group-two', subscriber_id: 'viewer', group_id: 'group' },
      { id: 'none', subscriber_id: 'viewer' },
    ]);
    mocks.rows.set('memberships', [
      {
        id: 'member-one',
        group_id: 'group',
        status: 'active',
        membership_roles: [
          { role: null },
          { role: { name: 'Default', sort_order: null } },
          { role: { name: 'Admin', sort_order: 2 } },
        ],
      },
      { id: 'member-two', group_id: 'group', status: 'invited' },
      {
        id: 'member-three',
        group_id: 'other-group',
        status: 'active',
        membership_roles: [
          { role: { name: 'First', sort_order: 2 } },
          { role: { name: 'Fallback', sort_order: null } },
        ],
      },
      { id: 'member-no-group', group_id: null, status: 'active', membership_roles: [] },
    ]);
    mocks.rows.set('guest-accesses', [
      { id: 'guest', group_id: 'group', status: 'accepted' },
      { id: 'guest-none', group_id: null, status: 'accepted' },
    ]);
    mocks.rows.set('participations', [
      { id: 'participant', event_id: 'event', user_id: 'viewer', status: 'active' },
      { id: 'participant-none', event_id: null, user_id: 'viewer', status: 'active' },
    ]);
    mocks.rows.set('collaborations', [
      { id: 'collaboration', amendment_id: 'amendment', status: 'active' },
      { id: 'collaboration-none', amendment_id: null, status: 'active' },
    ]);
    mocks.rows.set('delegations', [
      { event_id: 'event', user_id: 'delegate', status: 'active' },
      { event_id: null, user_id: 'nobody', status: 'active' },
    ]);

    const rendered = render(<ProviderHarness />);
    act(() => mocks.rafCallbacks[0](0));
    invokeIdle(0);
    invokeIdle(1);
    invokeIdle(1);
    invokeIdle(2);
    invokeIdle(3);
    invokeIdle(4);
    invokeIdle(5);

    expect(latestState?.isReady).toBe(true);
    expect(latestState?.getSubscriptionState('group', 'group', 2).subscriptions).toHaveLength(2);
    expect(latestState?.getSubscriptionState('user', 'user', 1).subscriptions).toHaveLength(1);
    expect(
      latestState?.getSubscriptionState('amendment', 'amendment', 1).subscriptions
    ).toHaveLength(1);
    expect(latestState?.getSubscriptionState('event', 'event', 1).subscriptions).toHaveLength(1);
    expect(latestState?.getSubscriptionState('blog', 'blog', 1).subscriptions).toHaveLength(1);

    const group = latestState?.getGroupState({
      id: 'group',
      connectedGroupId: 'group',
      memberCount: 2,
    });
    expect(group?.memberships).toHaveLength(2);
    expect(group?.memberships[0].role).toEqual({ name: 'Admin' });
    expect(group?.memberships[1].role).toBeNull();
    expect(group?.connectedGroupMemberships).toHaveLength(2);
    expect(group?.guestAccesses).toHaveLength(1);

    expect(
      latestState?.getEventState({
        id: 'event',
        groupId: 'group',
        participantCount: 1,
        visibility: 'private',
      })
    ).toMatchObject({
      event: { group: { memberships: [{ user_id: 'viewer' }, { user_id: 'viewer' }] } },
      participants: [{ id: 'participant' }],
    });
    expect(latestState?.getAmendmentState('amendment', 1).collaborations).toHaveLength(1);

    rendered.unmount();
    expect(mocks.cancelIdleCallback).toHaveBeenCalled();
  });
});
