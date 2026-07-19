/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '../../types/notification.types';
import { useEntityNotificationsController } from '../useEntityNotificationsController';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setAllNotificationsRead: vi.fn(),
  handleMarkNotificationAsRead: vi.fn(async () => undefined),
  useQuery: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: unknown) => mocks.useQuery(query),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    notifications: {
      countRows: (args: unknown) => args,
    },
  },
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

vi.mock('../useNotificationActions', () => ({
  useNotificationActions: () => ({
    handleMarkNotificationAsRead: mocks.handleMarkNotificationAsRead,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function entityNotification(): Notification {
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
  } as unknown as Notification;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useQuery.mockReturnValue([[entityNotification()], { type: 'complete' }]);
  mocks.setAllNotificationsRead.mockResolvedValue(undefined);
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
});
