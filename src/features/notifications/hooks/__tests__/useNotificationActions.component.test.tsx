/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '../../types/notification.types';
import { useNotificationActions } from '../useNotificationActions';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setNotificationRead: vi.fn(),
  dismissNotification: vi.fn(),
  restoreNotification: vi.fn(),
  purgeNotificationForUser: vi.fn(),
  deleteEntityNotificationGlobally: vi.fn(),
  waitForClientApply: vi.fn(async (result?: unknown) => void result),
  serverConfirmed: vi.fn(async (result?: unknown) => void result),
  toastSuccess: vi.fn(),
  reportAction: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/zero/notifications/useNotificationActions', () => ({
  useNotificationActions: () => ({
    setNotificationRead: mocks.setNotificationRead,
    dismissNotification: mocks.dismissNotification,
    restoreNotification: mocks.restoreNotification,
    purgeNotificationForUser: mocks.purgeNotificationForUser,
    deleteEntityNotificationGlobally: mocks.deleteEntityNotificationGlobally,
  }),
}));

vi.mock('../../utils/gated-toast', () => ({
  gatedToast: { success: mocks.toastSuccess },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: mocks.reportAction,
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
  mocks.dismissNotification.mockReturnValue('dismiss-result');
  mocks.restoreNotification.mockReturnValue('restore-result');
  mocks.purgeNotificationForUser.mockReturnValue('purge-result');
  mocks.deleteEntityNotificationGlobally.mockReturnValue('global-delete-result');
  mocks.serverConfirmed.mockResolvedValue(undefined);
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

  it('reports confirmed reads and absorbs rejected confirmations', async () => {
    const { result } = renderHook(() => useNotificationActions());
    await act(() => result.current.handleMarkNotificationAsRead(notification()));
    expect(mocks.reportAction).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'notification.read',
    });

    mocks.serverConfirmed.mockRejectedValueOnce(new Error('rejected'));
    await act(() =>
      result.current.handleMarkNotificationAsRead(notification({ id: 'notification-2' }))
    );
    expect(mocks.setNotificationRead).toHaveBeenCalledTimes(2);
  });

  it('navigates explicit message and route targets before entity fallbacks', async () => {
    const { result } = renderHook(() => useNotificationActions());
    await act(() =>
      result.current.handleNotificationClick(
        notification({ action_url: '/messages/conversation%201', type: 'direct_message' })
      )
    );
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/messages',
      search: { conversationId: 'conversation 1' },
    });

    await act(() =>
      result.current.handleNotificationClick(notification({ action_url: '/group/group-1' }))
    );
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: '/group/group-1' });
  });

  it('covers every related-entity navigation fallback', async () => {
    const { result } = renderHook(() => useNotificationActions());
    const cases: [Partial<Notification>, string | null][] = [
      [
        { related_entity_type: 'group', related_group: { id: 'group-1' } as never },
        '/group/group-1',
      ],
      [{ related_entity_type: 'group', related_group: null as never }, null],
      [
        { related_entity_type: 'event', related_event: { id: 'event-1' } as never },
        '/event/event-1',
      ],
      [{ related_entity_type: 'event', related_event: null as never }, null],
      [{ related_entity_type: 'user', related_user: { id: 'user-1' } as never }, '/user/user-1'],
      [{ related_entity_type: 'user', related_user: null as never }, null],
      [{ related_entity_type: 'message' }, '/messages'],
      [
        {
          related_entity_type: 'blog',
          related_blog: { id: 'blog-1' } as never,
          on_behalf_of_group: { id: 'group-1' } as never,
        },
        '/group/group-1/blog/blog-1',
      ],
      [
        {
          related_entity_type: 'blog',
          related_blog: { id: 'blog-2' } as never,
          related_user: { id: 'user-2' } as never,
        },
        '/user/user-2/blog/blog-2',
      ],
      [
        {
          related_entity_type: 'blog',
          related_blog: { id: 'blog-3' } as never,
          sender: { id: 'sender-1' } as never,
        },
        '/user/sender-1/blog/blog-3',
      ],
      [{ related_entity_type: 'blog', related_blog: { id: 'blog-4' } as never }, null],
      [{ related_entity_type: 'blog', related_blog: null as never }, null],
      [
        { related_entity_type: 'amendment', related_amendment: { id: 'amendment-1' } as never },
        '/amendment/amendment-1',
      ],
      [{ related_entity_type: 'amendment', related_amendment: null as never }, null],
      [{ related_entity_type: 'unknown' as never }, null],
      [{ related_entity_type: null }, null],
    ];

    for (const [overrides, expected] of cases) {
      mocks.navigate.mockClear();
      await act(() =>
        result.current.handleNotificationClick(
          notification({ ...overrides, is_read: true, action_url: null })
        )
      );
      if (expected) expect(mocks.navigate).toHaveBeenCalledWith({ to: expected });
      else expect(mocks.navigate).not.toHaveBeenCalled();
    }
  });

  it('toggles read state with event handling, reporting, and rollback-safe rejection', async () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const { result } = renderHook(() => useNotificationActions());
    await act(() => result.current.handleToggleNotificationRead(notification(), event as never));
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(mocks.setNotificationRead).toHaveBeenLastCalledWith({
      notificationId: 'notification-1',
      read: true,
    });
    expect(mocks.reportAction).toHaveBeenCalledOnce();

    await act(() =>
      result.current.handleToggleNotificationRead(notification({ is_read: true }), undefined)
    );
    expect(mocks.setNotificationRead).toHaveBeenLastCalledWith({
      notificationId: 'notification-1',
      read: false,
    });

    mocks.serverConfirmed.mockRejectedValueOnce(new Error('rejected'));
    await act(() => result.current.handleToggleNotificationRead(notification()));
  });

  it('dismisses with restore action and covers rejected dismissal', async () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const { result } = renderHook(() => useNotificationActions());
    await act(() => result.current.handleDismissNotification('notification-1', event as never));
    expect(mocks.toastSuccess).toHaveBeenCalledOnce();
    const options = mocks.toastSuccess.mock.calls[0]![1];
    options.action.onClick();
    expect(mocks.restoreNotification).toHaveBeenCalledWith({ notificationId: 'notification-1' });

    mocks.serverConfirmed.mockRejectedValueOnce(new Error('rejected'));
    await act(() => result.current.handleDismissNotification('notification-2'));
  });

  it('restores, purges, and absorbs rejected global deletion with optional events', async () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const { result } = renderHook(() => useNotificationActions());
    await act(() => result.current.handleRestoreNotification('notification-1', event as never));
    await act(() => result.current.handlePurgeNotification('notification-2'));
    expect(mocks.waitForClientApply).toHaveBeenCalledWith('restore-result');
    expect(mocks.waitForClientApply).toHaveBeenCalledWith('purge-result');

    mocks.serverConfirmed.mockRejectedValueOnce(new Error('rejected'));
    await act(() => result.current.handleDeleteEntityNotificationGlobally('notification-3'));
  });
});
