import { describe, expect, it } from 'vitest';

import type { NotificationCountProjectionRow } from '@/zero/notifications/queries';
import {
  calculateNotificationCounts,
  calculateNotificationCountsFromProjection,
} from '../useNotificationsPage';

function row(read: boolean, dismissed = false) {
  return {
    viewer_state: [
      {
        read_at: read ? 1 : null,
        dismissed_at: dismissed ? 1 : null,
        purged_at: null,
      },
    ],
  };
}

describe('calculateNotificationCounts', () => {
  it('uses unread counts for personal and entity badges while keeping all as a total', () => {
    const read = row(true);
    const unread = row(false);

    expect(
      calculateNotificationCounts({
        all: [read, unread],
        unread: [read, unread],
        personal: [read, unread],
        entity: [read, unread],
        trash: [],
      })
    ).toEqual({ all: 2, unread: 1, personal: 1, entity: 1, trash: 0 });
  });

  it('reacts to a personal notification being marked unread', () => {
    const base = { all: [row(true)], unread: [], entity: [], trash: [] };

    expect(calculateNotificationCounts({ ...base, personal: [row(true)] }).personal).toBe(0);
    expect(calculateNotificationCounts({ ...base, personal: [row(false)] }).personal).toBe(1);
  });
});

function projectionRow({
  recipientId = null,
  recipientEntityType = null,
  read = false,
  dismissed = false,
  purged = false,
}: {
  recipientId?: string | null;
  recipientEntityType?: string | null;
  read?: boolean;
  dismissed?: boolean;
  purged?: boolean;
}) {
  return {
    recipient_id: recipientId,
    recipient_entity_type: recipientEntityType,
    viewer_state: [
      {
        read_at: read ? 1 : null,
        dismissed_at: dismissed || purged ? 1 : null,
        purged_at: purged ? 1 : null,
      },
    ],
    reads: [],
  } as unknown as NotificationCountProjectionRow;
}

describe('calculateNotificationCountsFromProjection', () => {
  it('derives every exact tab count from one lean projection', () => {
    const rows = [
      projectionRow({ recipientId: 'user-1' }),
      projectionRow({ recipientId: 'user-1', read: true }),
      projectionRow({ recipientEntityType: 'group' }),
      projectionRow({ recipientEntityType: 'event', dismissed: true }),
      projectionRow({ recipientEntityType: 'blog', purged: true }),
    ];

    expect(calculateNotificationCountsFromProjection(rows, 'user-1')).toEqual({
      all: 3,
      unread: 2,
      personal: 1,
      entity: 1,
      trash: 1,
    });
  });
});
