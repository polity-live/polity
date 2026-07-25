/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useEntityNotificationCountRowsMock } = vi.hoisted(() => ({
  useEntityNotificationCountRowsMock: vi.fn(),
}));

vi.mock('../useEntityNotificationCountRows', () => ({
  useEntityNotificationCountRows: useEntityNotificationCountRowsMock,
}));

import { useEntityUnreadCount } from '../useEntityUnreadCount';

describe('useEntityUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['group', 'event', 'amendment', 'blog'] as const)(
    'counts active unread %s notifications from the shared entity rows',
    entityType => {
      useEntityNotificationCountRowsMock.mockReturnValue({
        rows: [
          { id: 'unread', recipient_entity_type: entityType, reads: [], viewer_state: [] },
          {
            id: 'read',
            recipient_entity_type: entityType,
            reads: [],
            viewer_state: [{ read_at: 1 }],
          },
          {
            id: 'dismissed',
            recipient_entity_type: entityType,
            reads: [],
            viewer_state: [{ dismissed_at: 1 }],
          },
          {
            id: 'purged',
            recipient_entity_type: entityType,
            reads: [],
            viewer_state: [{ purged_at: 1 }],
          },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useEntityUnreadCount('entity-1', entityType));

      expect(useEntityNotificationCountRowsMock).toHaveBeenCalledWith({
        query: '',
        entityId: 'entity-1',
        entityType,
      });
      expect(result.current).toBe(1);
    }
  );

  it('reacts when the legacy read marker is added', () => {
    useEntityNotificationCountRowsMock.mockReturnValue({
      rows: [{ id: 'notification-1', recipient_entity_type: 'group', reads: [] }],
      isLoading: false,
    });
    const { result, rerender } = renderHook(() => useEntityUnreadCount('group-1', 'group'));
    expect(result.current).toBe(1);

    useEntityNotificationCountRowsMock.mockReturnValue({
      rows: [
        {
          id: 'notification-1',
          recipient_entity_type: 'group',
          reads: [{ id: 'read-marker' }],
        },
      ],
      isLoading: false,
    });
    rerender();

    expect(result.current).toBe(0);
  });
});
