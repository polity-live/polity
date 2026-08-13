/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const model = vi.hoisted(() => {
  const action = vi.fn();
  return {
    action,
    useNotificationsPage: vi.fn(() => ({
      searchQuery: 'network',
      setSearchQuery: action,
      selectedTab: 'unread',
      setSelectedTab: action,
      tabSwipeHandlers: { onTouchStart: action },
      unreadCount: 2,
      counts: { all: 3, unread: 2, read: 1, personal: 1, entity: 1, trash: 0 },
      isInitialLoading: false,
      t: (key: string) => `translated:${key}`,
      handleMarkAllAsRead: action,
      handleMarkAllAsUnread: action,
      handleNotificationClick: action,
      handleMarkNotificationAsRead: action,
      handleToggleNotificationRead: action,
      handleDismissNotification: action,
      handleRestoreNotification: action,
      handlePurgeNotification: action,
      handleDeleteEntityNotificationGlobally: action,
      canDeleteForEveryone: action,
    })),
  };
});

vi.mock('../hooks/useNotificationsPage', () => model);
vi.mock('../ui/NotificationsPageView', () => ({
  NotificationsPageView: (props: Record<string, any>) => (
    <output>{`${props.searchQuery}:${props.selectedTab}:${props.unreadCount}:${props.labels.emptyTrashTitle}:${props.onPurgeNotification === model.action}`}</output>
  ),
}));

import { NotificationsPage } from '../NotificationsPage';

afterEach(cleanup);

describe('notifications page adapter', () => {
  it('maps the complete notification model, translated labels, and handlers into the view', () => {
    render(<NotificationsPage />);

    expect(model.useNotificationsPage).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('network:unread:2:translated:features.notifications.empty.noTrash:true')
    ).toBeTruthy();
  });
});
