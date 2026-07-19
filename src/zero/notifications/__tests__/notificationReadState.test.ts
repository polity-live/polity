import { describe, expect, it } from 'vitest';

import {
  applyEntityReadState,
  isNotificationDismissed,
  isNotificationPurged,
  isNotificationRead,
} from '../notificationReadState';

describe('notificationReadState', () => {
  it('prefers the isolated viewer state over both legacy read fields', () => {
    expect(
      isNotificationRead({
        is_read: true,
        recipient_entity_type: 'group',
        reads: [{ id: 'legacy-read' }],
        viewer_state: [{ read_at: null, dismissed_at: null, purged_at: null }],
      })
    ).toBe(false);
    expect(
      isNotificationRead({
        is_read: false,
        recipient_entity_type: null,
        reads: [],
        viewer_state: [{ read_at: 123, dismissed_at: null, purged_at: null }],
      })
    ).toBe(true);
  });

  it('derives trash and purge state only from the current viewer row', () => {
    const notification = {
      is_read: false,
      viewer_state: [{ read_at: null, dismissed_at: 123, purged_at: 456 }],
    };
    expect(isNotificationDismissed(notification)).toBe(true);
    expect(isNotificationPurged(notification)).toBe(true);
  });

  it('uses the current user read relation for entity notifications', () => {
    expect(
      isNotificationRead({
        is_read: false,
        recipient_entity_type: 'group',
        reads: [{ id: 'read-1' }],
      })
    ).toBe(true);
    expect(
      isNotificationRead({
        is_read: true,
        recipient_entity_type: 'event',
        reads: [],
      })
    ).toBe(false);
  });

  it('preserves the stored read flag for personal notifications', () => {
    expect(
      isNotificationRead({
        is_read: true,
        recipient_entity_type: null,
        reads: [],
      })
    ).toBe(true);
  });

  it('normalizes entity rows without mutating the source rows', () => {
    const rows = [
      {
        id: 'notification-1',
        is_read: false,
        recipient_entity_type: 'amendment',
        reads: [{ id: 'read-1' }],
      },
    ];

    const normalized = applyEntityReadState(rows);

    expect(normalized[0]?.is_read).toBe(true);
    expect(rows[0]?.is_read).toBe(false);
  });
});
