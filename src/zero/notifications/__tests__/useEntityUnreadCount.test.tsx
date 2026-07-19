/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { byEntityMock, useQueryMock } = vi.hoisted(() => ({
  byEntityMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: useQueryMock,
}));

vi.mock('../../queries', () => ({
  queries: {
    notifications: {
      byEntity: byEntityMock,
    },
  },
}));

import { useEntityUnreadCount } from '../useEntityUnreadCount';

describe('useEntityUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    byEntityMock.mockImplementation(args => ({ args }));
  });

  it.each(['group', 'event', 'amendment'] as const)(
    'queries and counts unread %s notifications by entity',
    entityType => {
      useQueryMock.mockReturnValue([
        [
          { id: 'unread', is_read: false, recipient_entity_type: entityType, reads: [] },
          {
            id: 'read',
            is_read: false,
            recipient_entity_type: entityType,
            reads: [{ id: 'read-marker' }],
          },
        ],
        { type: 'complete' },
      ]);

      const { result } = renderHook(() => useEntityUnreadCount('entity-1', entityType));

      expect(byEntityMock).toHaveBeenCalledWith({ entityId: 'entity-1', entityType });
      expect(result.current).toBe(1);
    }
  );

  it('reacts when read markers are added and removes the unread count', () => {
    useQueryMock.mockReturnValue([
      [{ id: 'notification-1', is_read: false, recipient_entity_type: 'group', reads: [] }],
      { type: 'complete' },
    ]);
    const { result, rerender } = renderHook(() => useEntityUnreadCount('group-1', 'group'));
    expect(result.current).toBe(1);

    useQueryMock.mockReturnValue([
      [
        {
          id: 'notification-1',
          is_read: false,
          recipient_entity_type: 'group',
          reads: [{ id: 'read-marker' }],
        },
      ],
      { type: 'complete' },
    ]);
    rerender();

    expect(result.current).toBe(0);
  });

  it('skips the entity query when no entity id is present', () => {
    useQueryMock.mockReturnValue([undefined, { type: 'unknown' }]);

    const { result } = renderHook(() => useEntityUnreadCount('', 'event'));

    expect(byEntityMock).not.toHaveBeenCalled();
    expect(useQueryMock).toHaveBeenCalledWith(undefined);
    expect(result.current).toBe(0);
  });
});
