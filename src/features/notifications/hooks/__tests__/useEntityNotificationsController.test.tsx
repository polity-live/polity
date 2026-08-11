/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '../../types/notification.types';
import { useEntityNotificationsController } from '../useEntityNotificationsController';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setAllNotificationsRead: vi.fn(),
  handleMarkNotificationAsRead: vi.fn(async () => undefined),
  handleToggleNotificationRead: vi.fn(),
  handleDismissNotification: vi.fn(),
  handleDeleteEntityNotificationGlobally: vi.fn(),
  useEntityNotificationCountRows: vi.fn(),
  canManage: true,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/zero/notifications/useEntityNotificationCountRows', () => ({
  useEntityNotificationCountRows: (options: unknown) =>
    mocks.useEntityNotificationCountRows(options),
}));

vi.mock('@/zero/notifications/useNotificationActions', () => ({
  useNotificationActions: () => ({
    setAllNotificationsRead: mocks.setAllNotificationsRead,
  }),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissionEvaluator: () => ({
    userId: 'user-1',
    isLoading: false,
    can: vi.fn(() => false),
  }),
}));

vi.mock('../../logic/notificationPermissions', () => ({
  canManageEntityNotification: () => mocks.canManage,
}));

vi.mock('../useNotificationActions', () => ({
  useNotificationActions: () => ({
    handleMarkNotificationAsRead: mocks.handleMarkNotificationAsRead,
    handleToggleNotificationRead: mocks.handleToggleNotificationRead,
    handleDismissNotification: mocks.handleDismissNotification,
    handleDeleteEntityNotificationGlobally: mocks.handleDeleteEntityNotificationGlobally,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function entityNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notification-1',
    type: 'group_payment_created',
    title: 'Payment created',
    message: 'A payment was created.',
    created_at: Date.now(),
    is_read: false,
    recipient_entity_type: 'group',
    recipient_entity_id: 'group-1',
    reads: [],
    action_url: '/group/group-1/operation#payments',
    ...overrides,
  } as unknown as Notification;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useEntityNotificationCountRows.mockImplementation((options: { enabled?: boolean }) => ({
    rows: options.enabled === false ? [] : [entityNotification()],
    isLoading: false,
  }));
  mocks.setAllNotificationsRead.mockResolvedValue(undefined);
  mocks.canManage = true;
});

describe('useEntityNotificationsController', () => {
  it('does not mark every notification as read when the entity page opens', () => {
    renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );

    expect(mocks.setAllNotificationsRead).not.toHaveBeenCalled();
  });

  it('marks only the clicked notification as read before navigating', async () => {
    const item = entityNotification();
    const { result } = renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );

    await act(async () => {
      await result.current.onNotificationClick(item);
    });

    expect(mocks.handleMarkNotificationAsRead).toHaveBeenCalledWith(item);
    expect(mocks.setAllNotificationsRead).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/group/group-1/operation#payments',
    });
  });

  it('keeps the explicit mark-all action available', async () => {
    const { result } = renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );

    await act(async () => {
      await result.current.onMarkAllAsRead();
    });

    expect(mocks.setAllNotificationsRead).toHaveBeenCalledWith({
      scope: { kind: 'entity', entityId: 'group-1', entityType: 'group' },
      read: true,
    });
  });

  it('keeps the entity unread count exact while search rows and loading are scoped', () => {
    const secondUnread = { ...entityNotification(), id: 'notification-2' };
    mocks.useEntityNotificationCountRows.mockImplementation(
      (options: { query: string; enabled?: boolean }) => {
        if (options.enabled === false) return { rows: [], isLoading: false };
        if (options.query) return { rows: [entityNotification()], isLoading: true };
        return { rows: [entityNotification(), secondUnread], isLoading: false };
      }
    );
    const { result } = renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );

    act(() => {
      result.current.onSearchQueryChange(' payment ');
    });

    expect(result.current.counts).toEqual({ all: 1, unread: 1 });
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.isLoading).toBe(true);
    expect(mocks.useEntityNotificationCountRows).toHaveBeenCalledWith({
      entityId: 'group-1',
      entityType: 'group',
      query: 'payment',
    });
    expect(mocks.useEntityNotificationCountRows).toHaveBeenCalledWith({
      entityId: 'group-1',
      entityType: 'group',
      query: '',
      enabled: true,
    });
  });

  it('skips mark-all when everything is read and exposes caught-up labels', async () => {
    const read = {
      ...entityNotification(),
      reads: [{ read_at: Date.now() }],
    } as unknown as Notification;
    mocks.useEntityNotificationCountRows.mockReturnValue({ rows: [read], isLoading: false });
    const { result } = renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );
    await act(() => result.current.onMarkAllAsRead());
    expect(mocks.setAllNotificationsRead).not.toHaveBeenCalled();
    expect(result.current.labels.statusDescription).toBe('pages.notifications.entity.allCaughtUp');
  });

  it('uses singular and plural unread status descriptions', () => {
    const one = renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );
    expect(one.result.current.labels.statusDescription).toBe(
      'pages.notifications.entity.unreadCount'
    );
    one.unmount();

    mocks.useEntityNotificationCountRows.mockReturnValue({
      rows: [entityNotification(), { ...entityNotification(), id: 'notification-2' }],
      isLoading: false,
    });
    const many = renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );
    expect(many.result.current.labels.statusDescription).toBe(
      'pages.notifications.entity.unreadCountPlural'
    );
  });

  it('covers message, route, user, and empty navigation paths for read and unread rows', async () => {
    const { result } = renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );

    await act(() =>
      result.current.onNotificationClick(
        entityNotification({
          action_url: '/messages/conversation-1',
          type: 'direct_message',
        } as never)
      )
    );
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/messages',
      search: { conversationId: 'conversation-1' },
    });

    await act(() =>
      result.current.onNotificationClick(
        entityNotification({
          action_url: '/event/event-1',
          reads: [{ read_at: Date.now() }],
        } as never)
      )
    );
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: '/event/event-1' });

    await act(() =>
      result.current.onNotificationClick(
        entityNotification({ action_url: null, related_user_id: 'user-2' } as never)
      )
    );
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: '/user/user-2' });

    mocks.navigate.mockClear();
    await act(() =>
      result.current.onNotificationClick(
        entityNotification({ action_url: null, related_user_id: null } as never)
      )
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('formats minute, hour, day, and calendar-date ranges', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
    const { result } = renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );
    expect(result.current.formatTime('2026-08-09T11:30:00Z')).toBe(
      'pages.notifications.time.minutesAgo'
    );
    expect(result.current.formatTime('2026-08-09T10:00:00Z')).toBe(
      'pages.notifications.time.hoursAgo'
    );
    expect(result.current.formatTime('2026-08-07T12:00:00Z')).toBe(
      'pages.notifications.time.daysAgo'
    );
    expect(result.current.formatTime('2026-07-01T12:00:00Z')).toContain('Jul');
    vi.useRealTimers();
  });

  it('forwards management permission and covers both loading operands', () => {
    mocks.canManage = false;
    mocks.useEntityNotificationCountRows.mockImplementation((options: { query: string }) => ({
      rows: [entityNotification()],
      isLoading: options.query === '',
    }));
    const { result } = renderHook(() =>
      useEntityNotificationsController({
        entityId: 'group-1',
        entityType: 'group',
        entityName: 'Group One',
      })
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.canDeleteForEveryone(entityNotification())).toBe(false);
    mocks.useEntityNotificationCountRows.mockReturnValue({
      rows: [entityNotification()],
      isLoading: false,
    });
    act(() => result.current.onSearchQueryChange('query'));
    expect(result.current.isLoading).toBe(false);
  });
});
