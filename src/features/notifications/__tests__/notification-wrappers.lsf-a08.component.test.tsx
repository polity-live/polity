/* @vitest-environment jsdom */

import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  entityController: vi.fn((props: unknown) => ({ controller: true, props })),
  entityView: vi.fn(() => null),
  settingsView: vi.fn(() => null),
  tabsProps: undefined as any,
  lists: [] as any[],
  reset: vi.fn().mockResolvedValue(undefined),
}));
const settings = vi.hoisted(() => ({
  settings: { email: true },
  isLoading: false,
  isUpdating: false,
  updateGroupNotifications: vi.fn(),
  updateEventNotifications: vi.fn(),
  updateAmendmentNotifications: vi.fn(),
  updateBlogNotifications: vi.fn(),
  updateTodoNotifications: vi.fn(),
  updateSocialNotifications: vi.fn(),
  updateDeliverySettings: vi.fn(),
  updateTimelineSettings: vi.fn(),
  resetToDefaults: mocks.reset,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
vi.mock('@/zero/notifications/useNotificationState', () => ({
  useNotificationState: () => ({ userNotifications: [{ id: 'notification-1' }], isLoading: false }),
}));
vi.mock('../hooks/useEntityNotificationsController', () => ({
  useEntityNotificationsController: mocks.entityController,
}));
vi.mock('../ui/EntityNotificationsView', () => ({ EntityNotificationsView: mocks.entityView }));
vi.mock('../hooks/useNotificationSettings', () => ({ useNotificationSettings: () => settings }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../ui/NotificationSettingsContentView', () => ({
  NotificationSettingsContentView: mocks.settingsView,
}));
vi.mock('@/features/shared/ui/typeahead', () => ({ EntitySearchBar: () => null }));
vi.mock('@/features/shared/ui/feed', () => ({
  FeedToolbar: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: (props: any) => {
    mocks.tabsProps = props;
    return <>{props.children}</>;
  },
  TabsContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../ui/NotificationHeader', () => ({ NotificationHeader: () => null }));
vi.mock('../ui/NotificationTabs', () => ({ NotificationTabs: () => null }));
vi.mock('../ui/NotificationsList', () => ({
  NotificationsList: (props: any) => {
    mocks.lists.push(props);
    return null;
  },
}));

import { useUserNotifications } from '../hooks/useUserNotifications';
import { EntityNotifications } from '../ui/EntityNotifications';
import { NotificationSettingsContent } from '../ui/NotificationSettingsContent';
import { NotificationsPageView } from '../ui/NotificationsPageView';
import { useNotificationSettingsContentController } from '../ui/useNotificationSettingsContentController';
import { NOTIFICATION_CATEGORIES } from '@/zero/notifications/notificationTypes';

afterEach(() => {
  cleanup();
  mocks.lists = [];
  vi.clearAllMocks();
});

describe('notification LSF contracts', () => {
  it('exposes user notifications and the authenticated user id', () => {
    const { result } = renderHook(() => useUserNotifications());
    expect(result.current).toEqual({
      data: { notifications: [{ id: 'notification-1' }] },
      isLoading: false,
      userId: 'user-1',
    });
  });

  it('connects entity and settings controllers to their views', async () => {
    render(
      <>
        <EntityNotifications entityId="group-1" entityType="group" entityName="Group" />
        <NotificationSettingsContent userId="user-1" />
      </>
    );
    expect(mocks.entityView).toHaveBeenCalledOnce();
    expect(mocks.settingsView).toHaveBeenCalledOnce();

    const { result } = renderHook(() =>
      useNotificationSettingsContentController({ userId: 'user-1' })
    );
    await act(async () => result.current.handleReset());
    await waitFor(() => expect(mocks.reset).toHaveBeenCalled());
    expect(result.current.resetting).toBe(false);
    act(() => result.current.setResetting(true));
    expect(result.current.resetting).toBe(true);
    expect(result.current.updateTimelineSettings).toBe(settings.updateTimelineSettings);
  });

  it('forwards tab changes and provides an inert trash-item click', () => {
    const onSelectedTabChange = vi.fn();
    render(
      <NotificationsPageView
        {...({
          searchQuery: 'query',
          onSearchQueryChange: vi.fn(),
          selectedTab: 'all',
          onSelectedTabChange,
          tabSwipeHandlers: {},
          unreadCount: 1,
          counts: { all: 1, unread: 1, personal: 0, entity: 0, trash: 0 },
          isInitialLoading: false,
          labels: {
            searchPlaceholder: 'Search',
            emptyAllTitle: 'empty',
            emptyAllDescription: 'empty',
            allCaughtUpTitle: 'done',
            emptyUnreadDescription: 'empty',
            emptyReadTitle: 'empty',
            emptyReadDescription: 'empty',
            emptyPersonalTitle: 'empty',
            emptyPersonalDescription: 'empty',
            emptyEntityTitle: 'empty',
            emptyEntityDescription: 'empty',
            emptyTrashTitle: 'empty',
            emptyTrashDescription: 'empty',
          },
          onMarkAllAsRead: vi.fn(),
          onMarkAllAsUnread: vi.fn(),
          onNotificationClick: vi.fn(),
          onMarkAsRead: vi.fn(),
          onDeleteNotification: vi.fn(),
          onToggleRead: vi.fn(),
          onRestoreNotification: vi.fn(),
          onPurgeNotification: vi.fn(),
          onDeleteForEveryone: vi.fn(),
          canDeleteForEveryone: vi.fn(),
        } as any)}
      />
    );
    mocks.tabsProps.onValueChange('trash');
    expect(onSelectedTabChange).toHaveBeenCalledWith('trash');
    expect(mocks.lists.find(props => props.mode === 'trash').onNotificationClick()).toBeUndefined();
  });

  it('publishes every notification category constant', () => {
    expect(Object.keys(NOTIFICATION_CATEGORIES)).toHaveLength(9);
  });
});
