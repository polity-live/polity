import { Bell, UserPlus } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import type { NotificationType } from '../../types/notification.types';
import { getNotificationIcon } from '../notificationConstants';

describe('getNotificationIcon', () => {
  it('returns the mapped icon and a defensive fallback', () => {
    expect(getNotificationIcon('membership_request')).toBe(UserPlus);
    expect(getNotificationIcon('future_notification' as NotificationType)).toBe(Bell);
  });
});
