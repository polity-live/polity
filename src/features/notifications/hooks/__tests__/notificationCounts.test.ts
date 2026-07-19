import { describe, expect, it } from 'vitest';

import { calculateNotificationCounts } from '../useNotificationsPage';

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
