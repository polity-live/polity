import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../types/notification-settings.types';
import {
  NOTIFICATION_TYPE_TO_SETTING,
  shouldDispatchNotification,
} from '../notificationTypeSettingMap';

describe('todo comment notification setting', () => {
  it('uses its own enabled-by-default todo setting', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.todoNotifications.comments).toBe(true);
    expect(NOTIFICATION_TYPE_TO_SETTING.todo_comment_added).toEqual({
      category: 'todoNotifications',
      key: 'comments',
    });
  });

  it('suppresses only todo comment notifications when comments are disabled', () => {
    const settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      todoNotifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS.todoNotifications,
        comments: false,
      },
    };

    expect(shouldDispatchNotification('todo_comment_added', settings)).toBe(false);
    expect(shouldDispatchNotification('todo_updated', settings)).toBe(true);
  });
});
