/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = (name: string) => vi.fn((args?: unknown) => ({ name, args }));
  return {
    useQuery: vi.fn(),
    responses: new Map<string, readonly [readonly any[] | undefined, { type: string }]>(),
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
    mocks.responses.clear();
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

describe('useNotificationState complete query composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.responses.clear();
    mocks.useQuery.mockImplementation((query: { name: string } | undefined) =>
      query
        ? (mocks.responses.get(query.name) ?? [[], { type: 'complete' }])
        : [undefined, { type: 'complete' }]
    );
  });

  it('loads, normalizes, deduplicates, and sorts all opted-in notification domains', () => {
    mocks.responses.set('userGroupMemberships', [
      [{ group: { id: 'group-1' } }, { group: null }],
      { type: 'complete' },
    ]);
    mocks.responses.set('userEventParticipations', [
      [{ event: { id: 'event-1' } }, {}],
      { type: 'complete' },
    ]);
    mocks.responses.set('userAmendmentCollaborations', [
      [{ amendment: { id: 'amendment-1' } }, { amendment: null }],
      { type: 'complete' },
    ]);
    mocks.responses.set('userBlogRelations', [
      [{ blog: { id: 'blog-1' } }, {}],
      { type: 'complete' },
    ]);
    mocks.responses.set('byUserWithRelations', [
      [
        { id: 'personal', created_at: null, viewer_state: [{ read_at: 1 }] },
        { id: 'duplicate', created_at: 1 },
      ],
      { type: 'complete' },
    ]);
    mocks.responses.set('byRecipientGroups', [
      [
        { id: 'duplicate', created_at: 2 },
        { id: 'group', created_at: 4 },
      ],
      { type: 'complete' },
    ]);
    mocks.responses.set('byRecipientEvents', [
      [{ id: 'event', created_at: 3 }],
      { type: 'complete' },
    ]);
    mocks.responses.set('byRecipientAmendments', [
      [{ id: 'amendment', created_at: 2 }],
      { type: 'complete' },
    ]);
    mocks.responses.set('byRecipientBlogs', [
      [{ id: 'blog', created_at: null }],
      { type: 'complete' },
    ]);
    mocks.responses.set('byEntity', [
      [{ id: 'entity', recipient_entity_type: 'group', reads: [{}] }],
      { type: 'complete' },
    ]);
    mocks.responses.set('byEntityId', [[{ id: 'entity-id' }], { type: 'complete' }]);

    const { result } = renderHook(() =>
      useNotificationState({
        entityFilter: { entityId: 'group-1', entityType: 'group' },
        entityId: 'group-1',
        includeRelations: true,
        includeUserNotifications: true,
      })
    );

    expect(result.current.entityIds).toEqual({
      groupIds: ['group-1'],
      eventIds: ['event-1'],
      amendmentIds: ['amendment-1'],
      blogIds: ['blog-1'],
    });
    expect(result.current.entityNotifications[0]?.is_read).toBe(true);
    expect(result.current.entityByIdNotifications).toEqual([{ id: 'entity-id' }]);
    expect(result.current.userNotifications.map(row => row.id)).toEqual([
      'group',
      'event',
      'amendment',
      'duplicate',
      'personal',
      'blog',
    ]);
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps optional recipient queries disabled when memberships have no entity ids', () => {
    mocks.responses.set('userGroupMemberships', [undefined, { type: 'complete' }]);
    mocks.responses.set('userEventParticipations', [undefined, { type: 'complete' }]);
    mocks.responses.set('userAmendmentCollaborations', [undefined, { type: 'complete' }]);
    mocks.responses.set('userBlogRelations', [undefined, { type: 'complete' }]);
    const { result } = renderHook(() => useNotificationState({ includeUserNotifications: true }));

    expect(mocks.queries.byRecipientGroups).not.toHaveBeenCalled();
    expect(mocks.queries.byRecipientEvents).not.toHaveBeenCalled();
    expect(mocks.queries.byRecipientAmendments).not.toHaveBeenCalled();
    expect(mocks.queries.byRecipientBlogs).not.toHaveBeenCalled();
    expect(result.current.userNotifications).toEqual([]);
    expect(result.current.entityByIdNotifications).toEqual([]);
  });

  it('normalizes a null entity-id query result to an empty collection', () => {
    mocks.responses.set('byEntityId', [null as never, { type: 'complete' }]);
    const { result } = renderHook(() => useNotificationState({ entityId: 'group-1' }));
    expect(result.current.entityByIdNotifications).toEqual([]);
  });

  it.each([
    ['byUser', {}],
    ['unreadCount', {}],
    ['settings', {}],
    ['pushSubscriptions', {}],
    ['byEntity', { entityFilter: { entityId: 'group-1', entityType: 'group' } }],
    ['byEntityId', { entityId: 'group-1' }],
    ['byUserWithRelations', { includeRelations: true }],
    ['byRecipientGroups', { includeUserNotifications: true }],
    ['byRecipientEvents', { includeUserNotifications: true }],
    ['byRecipientAmendments', { includeUserNotifications: true }],
    ['byRecipientBlogs', { includeUserNotifications: true }],
  ] as const)('reports loading when %s is unresolved', (name, options) => {
    if (name.startsWith('byRecipient')) {
      mocks.responses.set('userGroupMemberships', [
        [{ group: { id: 'group-1' } }],
        { type: 'complete' },
      ]);
      mocks.responses.set('userEventParticipations', [
        [{ event: { id: 'event-1' } }],
        { type: 'complete' },
      ]);
      mocks.responses.set('userAmendmentCollaborations', [
        [{ amendment: { id: 'amendment-1' } }],
        { type: 'complete' },
      ]);
      mocks.responses.set('userBlogRelations', [
        [{ blog: { id: 'blog-1' } }],
        { type: 'complete' },
      ]);
    }
    mocks.responses.set(name, [[], { type: 'unknown' }]);

    const { result } = renderHook(() => useNotificationState(options));

    expect(Boolean(result.current.isLoading)).toBe(true);
  });
});
