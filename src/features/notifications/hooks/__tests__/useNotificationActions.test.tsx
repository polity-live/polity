/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '../../types/notification.types';
import { useNotificationActions } from '../useNotificationActions';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setNotificationRead: vi.fn(),
  deleteNotification: vi.fn(),
  deleteEntityNotificationGlobally: vi.fn(),
  waitForClientApply: vi.fn(async (result?: unknown) => void result),
  serverConfirmed: vi.fn(async (result?: unknown) => void result),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/zero/notifications/useNotificationActions', () => ({
  useNotificationActions: () => ({
    setNotificationRead: mocks.setNotificationRead,
    deleteNotification: mocks.deleteNotification,
    deleteEntityNotificationGlobally: mocks.deleteEntityNotificationGlobally,
  }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => mocks.waitForClientApply(result),
  serverConfirmed: (result: unknown) => mocks.serverConfirmed(result),
}));

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notification-1',
    type: 'membership_request',
    title: 'Notification',
    message: 'Message',
    created_at: Date.now(),
    is_read: false,
    recipient_entity_type: null,
    recipient_entity_id: null,
    action_url: null,
    related_entity_type: null,
    related_user_id: null,
    ...overrides,
  } as Notification;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setNotificationRead.mockReturnValue('read-result');
  mocks.deleteEntityNotificationGlobally.mockReturnValue('global-delete-result');
});

describe('useNotificationActions', () => {
  it('marks one personal notification as read and consumes the action event', async () => {
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    const item = notification();
    const { result } = renderHook(() => useNotificationActions());

    await act(async () => {
      await result.current.handleMarkNotificationAsRead(item, event as never);
    });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(mocks.setNotificationRead).toHaveBeenCalledWith({ notificationId: item.id, read: true });
    expect(mocks.waitForClientApply).toHaveBeenCalledWith('read-result');
  });

  it('marks one entity notification through its per-user read record', async () => {
    const item = notification({
      recipient_entity_type: 'group',
      recipient_entity_id: 'group-1',
      reads: [],
    });
    const { result } = renderHook(() => useNotificationActions());

    await act(async () => {
      await result.current.handleMarkNotificationAsRead(item);
    });

    expect(mocks.setNotificationRead).toHaveBeenCalledWith({ notificationId: item.id, read: true });
    expect(mocks.waitForClientApply).toHaveBeenCalledWith('read-result');
  });

  it('does not mutate notifications that are already effectively read', async () => {
    const item = notification({
      recipient_entity_type: 'group',
      recipient_entity_id: 'group-1',
      reads: [
        {
          id: 'read-1',
          notification_id: 'notification-1',
          entity_type: 'group',
          entity_id: 'group-1',
          read_by_user_id: 'user-1',
          read_at: Date.now(),
        },
      ],
    });
    const { result } = renderHook(() => useNotificationActions());

    await act(async () => {
      await result.current.handleMarkNotificationAsRead(item);
    });

    expect(mocks.setNotificationRead).not.toHaveBeenCalled();
  });

  it('waits for server confirmation when deleting an entity notification globally', async () => {
    const { result } = renderHook(() => useNotificationActions());

    await act(async () => {
      await result.current.handleDeleteEntityNotificationGlobally('notification-1');
    });

    expect(mocks.deleteEntityNotificationGlobally).toHaveBeenCalledWith({
      notificationId: 'notification-1',
    });
    expect(mocks.waitForClientApply).toHaveBeenCalledWith('global-delete-result');
    expect(mocks.serverConfirmed).toHaveBeenCalledWith('global-delete-result');
  });
});
