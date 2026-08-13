/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationFilters } from '../useNotificationFilters';
import { useNotificationSettings } from '../useNotificationSettings';
import {
  calculateNotificationCounts,
  calculateNotificationCountsFromProjection,
  useNotificationsPage,
} from '../useNotificationsPage';
import { useToastSettingsSync } from '../useToastSettingsSync';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../types/notification-settings.types';

const mocks = vi.hoisted(() => ({
  rawSettings: null as Record<string, any> | null,
  settingsLoading: false,
  updateSettings: vi.fn(),
  createSettings: vi.fn(),
  setAllNotificationsRead: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  countRows: null as any[] | null,
  allRows: null as any[] | null,
  countResultType: 'complete',
  allResultType: 'complete',
  user: { id: 'user-1' } as { id: string } | null,
  swipeOptions: null as Record<string, any> | null,
  inAppEnabled: vi.fn(),
  canManage: true,
  expectingAllQuery: false,
  pageActions: {
    handleNotificationClick: vi.fn(),
    handleMarkNotificationAsRead: vi.fn(),
    handleToggleNotificationRead: vi.fn(),
    handleDismissNotification: vi.fn(),
    handleRestoreNotification: vi.fn(),
    handlePurgeNotification: vi.fn(),
    handleDeleteEntityNotificationGlobally: vi.fn(),
  },
}));

vi.mock('../../logic/notificationHelpers', () => ({
  filterAccessibleNotifications: (rows: unknown[]) => rows,
  isNotificationRead: (row: { is_read?: boolean }) => Boolean(row.is_read),
}));
vi.mock('@/zero/notifications/useNotificationSettingsState', () => ({
  useNotificationSettingsState: () => ({
    data: mocks.rawSettings,
    isLoading: mocks.settingsLoading,
  }),
}));
vi.mock('@/zero/notifications/useNotificationActions', () => ({
  useNotificationActions: () => ({
    updateSettings: mocks.updateSettings,
    createSettings: mocks.createSettings,
    setAllNotificationsRead: mocks.setAllNotificationsRead,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { query?: string } | undefined) => {
    if (!query) return [undefined, { type: mocks.allResultType }];
    if (query.query) {
      mocks.expectingAllQuery = true;
      return [mocks.countRows, { type: mocks.countResultType }];
    }
    if (mocks.expectingAllQuery) {
      mocks.expectingAllQuery = false;
      return [mocks.allRows ?? mocks.countRows, { type: mocks.allResultType }];
    }
    return [mocks.countRows, { type: mocks.countResultType }];
  },
}));
vi.mock('@/zero/queries', () => ({
  queries: { notifications: { countProjection: (args: Record<string, any>) => args } },
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: (options: Record<string, any>) => {
    mocks.swipeOptions = options;
    return { handlers: { onTouchStart: vi.fn() } };
  },
}));
vi.mock('../useNotificationActions', () => ({
  useNotificationActions: () => mocks.pageActions,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/rbac', () => ({ usePermissionEvaluator: () => ({ can: vi.fn() }) }));
vi.mock('../../logic/notificationPermissions', () => ({
  canManageEntityNotification: () => mocks.canManage,
}));
vi.mock('../../utils/gated-toast', () => ({
  setInAppNotificationsEnabled: mocks.inAppEnabled,
}));

const activeUnread = { id: 'active-unread', is_read: false, recipient_id: 'user-1' };
const activeRead = { id: 'active-read', is_read: true, recipient_id: 'other' };
const dismissed = {
  id: 'dismissed',
  is_read: false,
  viewer_state: [{ dismissed_at: 1, purged_at: null }],
};
const purged = {
  id: 'purged',
  is_read: false,
  viewer_state: [{ dismissed_at: 1, purged_at: 2 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rawSettings = null;
  mocks.settingsLoading = false;
  mocks.updateSettings.mockResolvedValue(undefined);
  mocks.createSettings.mockResolvedValue(undefined);
  mocks.countRows = [activeUnread, activeRead, dismissed, purged];
  mocks.allRows = [activeUnread, activeRead];
  mocks.countResultType = 'complete';
  mocks.allResultType = 'complete';
  mocks.user = { id: 'user-1' };
  mocks.canManage = true;
  mocks.expectingAllQuery = false;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(cleanup);

describe('notification hooks coverage', () => {
  it('partitions accessible notifications across read, personal, and every entity marker', () => {
    const notifications = [
      { id: 'personal', is_read: false, recipient: { id: 'user-1' } },
      { id: 'read', is_read: true, recipient: { id: 'other' } },
      { id: 'entity-type', recipient_entity_type: 'group' },
      { id: 'behalf-type', on_behalf_of_entity_type: 'event' },
      { id: 'group', recipient_group: {} },
      { id: 'event', recipient_event: {} },
      { id: 'amendment', recipient_amendment: {} },
      { id: 'blog', recipient_blog: {} },
      { id: 'behalf-group', on_behalf_of_group: {} },
      { id: 'behalf-event', on_behalf_of_event: {} },
      { id: 'behalf-amendment', on_behalf_of_amendment: {} },
      { id: 'behalf-blog', on_behalf_of_blog: {} },
      { id: 'ordinary' },
    ] as any[];
    const { result } = renderHook(() =>
      useNotificationFilters({ notifications, userId: 'user-1' })
    );
    expect(result.current.all).toHaveLength(13);
    expect(result.current.read.map(row => row.id)).toEqual(['read']);
    expect(result.current.unread).toHaveLength(12);
    expect(result.current.personal.map(row => row.id)).toEqual(['personal']);
    expect(result.current.entity).toHaveLength(10);
  });

  it('merges persisted settings and timestamps with defaults', () => {
    mocks.rawSettings = {
      id: 'settings-1',
      group_notifications: { newEvents: false },
      event_notifications: { invitations: false },
      amendment_notifications: { votes: false },
      blog_notifications: { newPosts: false },
      todo_notifications: { assigned: false },
      social_notifications: { directMessages: false },
      delivery_settings: { inAppNotifications: false },
      timeline_settings: { showNotifications: false },
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-02T00:00:00Z',
    };
    const { result } = renderHook(() => useNotificationSettings('ignored-user'));
    expect(result.current.settings.id).toBe('settings-1');
    expect(result.current.settings.createdAt).toBeInstanceOf(Date);
    expect(result.current.settings.updatedAt).toBeInstanceOf(Date);
    expect(result.current.settings.groupNotifications.newEvents).toBe(false);
  });

  it('updates every category on an existing settings row', async () => {
    mocks.rawSettings = { id: 'settings-1', created_at: null, updated_at: null };
    const { result } = renderHook(() => useNotificationSettings());
    const updates = {
      groupNotifications: DEFAULT_NOTIFICATION_SETTINGS.groupNotifications,
      eventNotifications: DEFAULT_NOTIFICATION_SETTINGS.eventNotifications,
      amendmentNotifications: DEFAULT_NOTIFICATION_SETTINGS.amendmentNotifications,
      blogNotifications: DEFAULT_NOTIFICATION_SETTINGS.blogNotifications,
      todoNotifications: DEFAULT_NOTIFICATION_SETTINGS.todoNotifications,
      socialNotifications: DEFAULT_NOTIFICATION_SETTINGS.socialNotifications,
      deliverySettings: DEFAULT_NOTIFICATION_SETTINGS.deliverySettings,
      timelineSettings: DEFAULT_NOTIFICATION_SETTINGS.timelineSettings,
    };
    await act(() => result.current.updateSettings(updates));
    expect(mocks.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'settings-1', group_notifications: updates.groupNotifications })
    );

    await act(() => result.current.updateGroupNotifications({}));
    await act(() => result.current.updateEventNotifications({}));
    await act(() => result.current.updateAmendmentNotifications({}));
    await act(() => result.current.updateBlogNotifications({}));
    await act(() => result.current.updateTodoNotifications({}));
    await act(() => result.current.updateSocialNotifications({}));
    await act(() => result.current.updateDeliverySettings({}));
    await act(() => result.current.updateTimelineSettings({}));
    await act(() => result.current.resetToDefaults());
    await act(() => result.current.toggleSetting('deliverySettings', 'inAppNotifications'));
    expect(mocks.updateSettings).toHaveBeenCalledTimes(11);
  });

  it('creates defaults for a missing row and returns mutation failures', async () => {
    const { result } = renderHook(() => useNotificationSettings());
    const created = await act(() => result.current.updateSettings({}));
    expect(created).toEqual({ success: true });
    expect(mocks.createSettings).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String), delivery_settings: expect.any(Object) })
    );

    mocks.createSettings.mockRejectedValueOnce(new Error('failed'));
    const failed = await act(() =>
      result.current.updateSettings({ deliverySettings: { inAppNotifications: false } as never })
    );
    expect(failed).toEqual({ success: false, error: expect.any(Error) });
    expect(result.current.isUpdating).toBe(false);
  });

  it('calculates legacy and projection counts for active, read, trash, and entity rows', () => {
    expect(
      calculateNotificationCounts({
        all: [activeUnread, dismissed],
        unread: [activeUnread, activeRead],
        personal: [activeUnread, activeRead],
        entity: [activeUnread, activeRead],
        trash: [dismissed, purged],
      } as never)
    ).toEqual({ all: 1, unread: 1, personal: 1, entity: 1, trash: 1 });

    expect(
      calculateNotificationCountsFromProjection(
        [
          activeUnread,
          activeRead,
          { ...activeUnread, id: 'entity', recipient_id: null, recipient_entity_type: 'group' },
          { ...activeUnread, id: 'unknown', recipient_entity_type: 'user' },
          dismissed,
          purged,
        ] as never,
        'user-1'
      )
    ).toEqual({ all: 4, unread: 3, personal: 2, entity: 1, trash: 1 });
  });

  it('drives page queries, loading, mark-all actions, permissions, and swipe boundaries', async () => {
    mocks.countResultType = 'unknown';
    const { result } = renderHook(() => useNotificationsPage());
    expect(result.current.isInitialLoading).toBe(true);
    expect(mocks.swipeOptions).toMatchObject({ canSwipePrev: false, canSwipeNext: true });
    mocks.swipeOptions!.onSwipePrev();
    act(() => mocks.swipeOptions!.onSwipeNext());
    expect(result.current.selectedTab).toBe('unread');

    await act(() => result.current.handleMarkAllAsRead());
    await act(() => result.current.handleMarkAllAsUnread());
    expect(mocks.setAllNotificationsRead).toHaveBeenNthCalledWith(1, {
      scope: { kind: 'inbox' },
      read: true,
    });
    expect(mocks.setAllNotificationsRead).toHaveBeenNthCalledWith(2, {
      scope: { kind: 'inbox' },
      read: false,
    });
    expect(result.current.canDeleteForEveryone({} as never)).toBe(true);

    act(() => result.current.setSelectedTab('trash'));
    expect(mocks.swipeOptions).toMatchObject({ canSwipePrev: true, canSwipeNext: false });
    mocks.swipeOptions!.onSwipeNext();
    act(() => mocks.swipeOptions!.onSwipePrev());
    expect(result.current.selectedTab).toBe('entity');

    act(() => result.current.setSelectedTab('invalid' as never));
    expect(mocks.swipeOptions).toMatchObject({ canSwipePrev: false, canSwipeNext: false });
    act(() => mocks.swipeOptions!.onSwipeNext());
    expect(result.current.selectedTab).toBe('all');
  });

  it('uses all-unread rows during search and covers both loading operands and null rows', () => {
    mocks.countRows = null;
    mocks.allRows = null;
    const { result } = renderHook(() => useNotificationsPage());
    expect(result.current.counts.all).toBe(0);
    act(() => result.current.setSearchQuery('  query  '));
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isInitialLoading).toBe(false);

    mocks.allResultType = 'unknown';
    act(() => result.current.setSearchQuery('next'));
    expect(result.current.isInitialLoading).toBe(true);
  });

  it('syncs missing, enabled, and disabled in-app delivery settings', () => {
    const hook = renderHook(() => useToastSettingsSync());
    expect(mocks.inAppEnabled).toHaveBeenLastCalledWith(true);

    mocks.rawSettings = { delivery_settings: {} };
    hook.rerender();
    expect(mocks.inAppEnabled).toHaveBeenLastCalledWith(true);

    mocks.rawSettings = { delivery_settings: { inAppNotifications: false } };
    hook.rerender();
    expect(mocks.inAppEnabled).toHaveBeenLastCalledWith(false);
  });
});
