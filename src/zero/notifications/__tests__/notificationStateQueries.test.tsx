/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = (name: string) => vi.fn((args?: unknown) => ({ name, args }));
  return {
    useQuery: vi.fn(),
    queries: {
      byUser: query('byUser'),
      unreadCount: query('unreadCount'),
      settings: query('settings'),
      pushSubscriptions: query('pushSubscriptions'),
      byEntity: query('byEntity'),
      byEntityId: query('byEntityId'),
      byUserWithRelations: query('byUserWithRelations'),
      userGroupMemberships: query('userGroupMemberships'),
      userEventParticipations: query('userEventParticipations'),
      userAmendmentCollaborations: query('userAmendmentCollaborations'),
      userBlogRelations: query('userBlogRelations'),
      byRecipientGroups: query('byRecipientGroups'),
      byRecipientEvents: query('byRecipientEvents'),
      byRecipientAmendments: query('byRecipientAmendments'),
      byRecipientBlogs: query('byRecipientBlogs'),
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('../../queries', () => ({
  queries: {
    notifications: mocks.queries,
  },
}));

import { useNotificationSettingsState } from '../useNotificationSettingsState';
import { useNotificationState } from '../useNotificationState';
import { usePushSubscriptionsState } from '../usePushSubscriptionsState';

describe('narrow notification state hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockImplementation(query => [query, { type: 'complete' }]);
  });

  it('loads only notification settings', () => {
    const { result } = renderHook(() => useNotificationSettingsState());

    expect(mocks.queries.settings).toHaveBeenCalledOnce();
    expect(mocks.queries.pushSubscriptions).not.toHaveBeenCalled();
    expect(mocks.queries.byUser).not.toHaveBeenCalled();
    expect(mocks.queries.unreadCount).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      data: { name: 'settings', args: {} },
      isLoading: false,
    });
  });

  it('loads only push subscriptions', () => {
    const { result } = renderHook(() => usePushSubscriptionsState());

    expect(mocks.queries.pushSubscriptions).toHaveBeenCalledOnce();
    expect(mocks.queries.settings).not.toHaveBeenCalled();
    expect(mocks.queries.byUser).not.toHaveBeenCalled();
    expect(mocks.queries.unreadCount).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      data: { name: 'pushSubscriptions', args: {} },
      isLoading: false,
    });
  });
});

describe('legacy notification state compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockReturnValue([undefined, { type: 'complete' }]);
  });

  it('does not construct an entity query without a complete entity filter', () => {
    const { result } = renderHook(() => useNotificationState());

    expect(mocks.queries.byEntity).not.toHaveBeenCalled();
    expect(result.current.entityNotifications).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps entity notification loading when a complete filter is supplied', () => {
    renderHook(() =>
      useNotificationState({
        entityFilter: { entityId: 'group-1', entityType: 'group' },
      })
    );

    expect(mocks.queries.byEntity).toHaveBeenCalledWith({
      entityId: 'group-1',
      entityType: 'group',
    });
  });
});
