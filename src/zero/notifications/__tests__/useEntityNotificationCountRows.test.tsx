/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  responses: new Map<
    string,
    readonly [readonly unknown[] | undefined, { readonly type: string }]
  >(),
  queries: {
    countByGroupOwner: vi.fn((args: unknown) => ({ name: 'group-owner', args })),
    countByGroupMembership: vi.fn((args: unknown) => ({ name: 'group-membership', args })),
    countByGroupGuest: vi.fn((args: unknown) => ({ name: 'group-guest', args })),
    countByEventParticipant: vi.fn((args: unknown) => ({ name: 'event-participant', args })),
    countByAmendmentCreator: vi.fn((args: unknown) => ({ name: 'amendment-creator', args })),
    countByAmendmentCollaborator: vi.fn((args: unknown) => ({
      name: 'amendment-collaborator',
      args,
    })),
    countByBlogBlogger: vi.fn((args: unknown) => ({ name: 'blog-blogger', args })),
  },
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { name: string } | undefined) => mocks.useQuery(query),
}));

vi.mock('../../queries', () => ({
  queries: {
    notifications: mocks.queries,
  },
}));

import { useEntityNotificationCountRows } from '../useEntityNotificationCountRows';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.responses.clear();
  mocks.useQuery.mockImplementation((query: { name: string } | undefined) =>
    query
      ? (mocks.responses.get(query.name) ?? [[], { type: 'complete' }])
      : [undefined, { type: 'complete' }]
  );
});

describe('useEntityNotificationCountRows', () => {
  it('runs all group access paths and deduplicates notifications by id', () => {
    const first = { id: 'notification-1', viewer_state: [] };
    const duplicate = { id: 'notification-2', viewer_state: [] };
    const third = { id: 'notification-3', viewer_state: [] };
    mocks.responses.set('group-owner', [
      [{ recipient_notifications: [first, duplicate] }],
      { type: 'complete' },
    ]);
    mocks.responses.set('group-membership', [
      [{ group: { recipient_notifications: [duplicate, third] } }],
      { type: 'unknown' },
    ]);

    const { result } = renderHook(() =>
      useEntityNotificationCountRows({
        entityId: 'group-1',
        entityType: 'group',
        query: ' payment ',
      })
    );

    const args = { entityId: 'group-1', query: ' payment ' };
    expect(mocks.queries.countByGroupOwner).toHaveBeenCalledWith(args);
    expect(mocks.queries.countByGroupMembership).toHaveBeenCalledWith(args);
    expect(mocks.queries.countByGroupGuest).toHaveBeenCalledWith(args);
    expect(mocks.queries.countByEventParticipant).not.toHaveBeenCalled();
    expect(result.current.rows.map(row => row.id)).toEqual([
      'notification-1',
      'notification-2',
      'notification-3',
    ]);
    expect(result.current.isLoading).toBe(true);
  });

  it.each([
    ['event', 'countByEventParticipant'],
    ['amendment', 'countByAmendmentCreator'],
    ['blog', 'countByBlogBlogger'],
  ] as const)('selects only relevant %s query branches', (entityType, queryName) => {
    const { result } = renderHook(() =>
      useEntityNotificationCountRows({
        entityId: `${entityType}-1`,
        entityType,
      })
    );

    expect(mocks.queries[queryName]).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('disables every query and loading state when requested', () => {
    const { result } = renderHook(() =>
      useEntityNotificationCountRows({
        entityId: 'group-1',
        entityType: 'group',
        enabled: false,
      })
    );

    expect(Object.values(mocks.queries).every(query => query.mock.calls.length === 0)).toBe(true);
    expect(mocks.useQuery).toHaveBeenCalledTimes(7);
    expect(mocks.useQuery).toHaveBeenCalledWith(undefined);
    expect(result.current).toEqual({ rows: [], isLoading: false });
  });

  it('collects rows from every nested entity relation and tolerates empty access rows', () => {
    mocks.responses.set('group-owner', [
      [
        {
          recipient_notifications: null,
          group: { recipient_notifications: [{ id: 'group-row' }] },
          event: { recipient_notifications: [{ id: 'event-row' }] },
          amendment: { recipient_notifications: [{ id: 'amendment-row' }] },
          blog: { recipient_notifications: [{ id: 'blog-row' }] },
        },
        {},
      ],
      { type: 'complete' },
    ]);

    const { result } = renderHook(() =>
      useEntityNotificationCountRows({ entityId: 'group-1', entityType: 'group' })
    );

    expect(result.current.rows.map(row => row.id)).toEqual([
      'group-row',
      'event-row',
      'amendment-row',
      'blog-row',
    ]);
  });

  it('treats an unresolved enabled access branch as an empty collection', () => {
    mocks.responses.set('group-owner', [undefined, { type: 'complete' }]);

    const { result } = renderHook(() =>
      useEntityNotificationCountRows({ entityId: 'group-1', entityType: 'group' })
    );

    expect(result.current.rows).toEqual([]);
  });
});
