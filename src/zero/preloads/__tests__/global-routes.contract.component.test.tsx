/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  active: vi.fn(),
  idle: vi.fn(),
  pathname: '/',
  preloads: vi.fn(),
  user: null as { id: string } | null,
  query: vi.fn((name: string, args: unknown) => ({ args, name })),
  tasks: vi.fn((name: string, ...args: unknown[]) => ({
    entries: [],
    key: `${name}:${JSON.stringify(args)}`,
    route: { href: `/${name}` },
  })),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@tanstack/react-router', () => ({ useLocation: () => ({ pathname: mocks.pathname }) }));
vi.mock('@/zero/queries', () => ({
  queries: {
    users: { current: (args: unknown) => mocks.query('users.current', args) },
    notifications: {
      settings: (args: unknown) => mocks.query('notifications.settings', args),
      pushSubscriptions: (args: unknown) => mocks.query('notifications.pushSubscriptions', args),
    },
    messages: { unreadSummary: (args: unknown) => mocks.query('messages.unreadSummary', args) },
    groups: {
      currentUserMembershipsWithGroups: (args: unknown) =>
        mocks.query('groups.currentUserMembershipsWithGroups', args),
    },
    events: {
      userParticipationsWithEvent: (args: unknown) =>
        mocks.query('events.userParticipationsWithEvent', args),
    },
    amendments: {
      currentUserOpenNavigationAmendments: (args: unknown) =>
        mocks.query('amendments.currentUserOpenNavigationAmendments', args),
    },
  },
}));
vi.mock('../preload-registry', () => ({
  createPreloadEntry: (name: string, args: unknown, query: unknown) => ({ name, args, query }),
  useZeroPreloads: mocks.preloads,
}));
vi.mock('../preload-coordinator', () => ({
  useActivePreloadTask: mocks.active,
  useIdlePreloadTasks: mocks.idle,
}));
vi.mock('../route-manifests', () => ({
  createPrimaryIdleTasks: vi.fn(() => [
    mocks.tasks('home'),
    mocks.tasks('messages'),
    mocks.tasks('calendar'),
  ]),
  createHomePreloadTask: (...args: unknown[]) => mocks.tasks('home', ...args),
  createMessagesPreloadTask: (...args: unknown[]) => mocks.tasks('messages', ...args),
  createSearchPreloadTask: (...args: unknown[]) => mocks.tasks('search', ...args),
  createCalendarPreloadTask: (...args: unknown[]) => mocks.tasks('calendar', ...args),
  createTodosPreloadTask: (...args: unknown[]) => mocks.tasks('todos', ...args),
  createNotificationsPreloadTask: (...args: unknown[]) => mocks.tasks('notifications', ...args),
  createCreatePreloadTask: (...args: unknown[]) => mocks.tasks('create', ...args),
  createCreateEventPreloadTask: (...args: unknown[]) => mocks.tasks('create-event', ...args),
}));

import {
  useCoreZeroPreloads,
  useGlobalZeroPreloads,
  useRelationshipEntityPreloads,
} from '../global';
import {
  useCalendarPreloads,
  useCreateEventPreloads,
  useCreatePreloads,
  useHomePreloads,
  useMessagesPreloads,
  useNotificationsPreloads,
  usePrimaryRouteIdlePreloads,
  useSearchPreloads,
  useTodosPreloads,
} from '../routes';

describe('global and primary route preload hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
    mocks.pathname = '/';
  });

  it('keeps global query lists empty without authentication and exact with a user', () => {
    renderHook(() => useCoreZeroPreloads());
    renderHook(() => useRelationshipEntityPreloads());
    renderHook(() => useGlobalZeroPreloads());
    expect(mocks.preloads.mock.calls.every(([entries]) => entries.length === 0)).toBe(true);

    vi.clearAllMocks();
    mocks.user = { id: 'user-1' };
    renderHook(() => useCoreZeroPreloads());
    renderHook(() => useRelationshipEntityPreloads());
    expect(mocks.preloads.mock.calls[0]?.[0]).toHaveLength(4);
    expect(mocks.preloads.mock.calls[1]?.[0]).toHaveLength(3);
    expect(mocks.query).toHaveBeenCalledWith('events.userParticipationsWithEvent', {
      userId: 'user-1',
    });
  });

  it('passes undefined tasks while signed out and concrete tasks while signed in', () => {
    const hooks = [
      () => useHomePreloads(),
      () => useMessagesPreloads('conversation-1'),
      () => useSearchPreloads({ q: 'budget', sort: 'trending' }),
      () => useCalendarPreloads(),
      () => useTodosPreloads(),
      () => useNotificationsPreloads(),
      () => useCreatePreloads(),
      () => useCreateEventPreloads('group-1'),
    ];
    for (const hook of hooks) renderHook(hook);
    expect(mocks.active.mock.calls.every(([task]) => task === undefined)).toBe(true);

    vi.clearAllMocks();
    mocks.user = { id: 'user-1' };
    for (const hook of hooks) renderHook(hook);
    expect(mocks.active).toHaveBeenCalledTimes(hooks.length);
    expect(mocks.active.mock.calls.every(([task]) => task?.key)).toBe(true);
    expect(mocks.tasks).toHaveBeenCalledWith('create-event', 'user-1', 'group-1');
  });

  it('rotates idle primary tasks after the active route and keeps original order off-route', () => {
    mocks.user = { id: 'user-1' };
    mocks.pathname = '/messages/thread-1';
    renderHook(() => usePrimaryRouteIdlePreloads());
    expect(mocks.idle.mock.calls[0]?.[1].map((task: { key: string }) => task.key)).toEqual([
      'calendar:[]',
      'home:[]',
    ]);

    mocks.pathname = '/unmatched';
    renderHook(() => usePrimaryRouteIdlePreloads());
    expect(mocks.idle.mock.calls[1]?.[1]).toHaveLength(3);

    mocks.user = null;
    renderHook(() => usePrimaryRouteIdlePreloads());
    expect(mocks.idle.mock.calls[2]?.[1]).toEqual([]);
  });
});
