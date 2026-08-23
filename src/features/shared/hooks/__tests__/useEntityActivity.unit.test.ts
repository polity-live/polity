/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendmentQuery: vi.fn((args: unknown) => ({ args, kind: 'amendment' })),
  eventQuery: vi.fn((args: unknown) => ({ args, kind: 'event' })),
  groupQuery: vi.fn((args: unknown) => ({ args, kind: 'group' })),
  page: [] as any[] | undefined,
  query: undefined as unknown,
  resultType: 'complete' as 'complete' | 'unknown',
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: unknown) => {
    mocks.query = query;
    return [mocks.page, { type: mocks.resultType }];
  },
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    amendments: { activities: mocks.amendmentQuery },
    events: { activities: mocks.eventQuery },
    groups: { activities: mocks.groupQuery },
  },
}));

import {
  canViewEntityActivity,
  useEntityActivity,
  type ActivityEntityType,
} from '../useEntityActivity';

beforeEach(() => {
  mocks.amendmentQuery.mockClear();
  mocks.eventQuery.mockClear();
  mocks.groupQuery.mockClear();
  mocks.page = [];
  mocks.query = undefined;
  mocks.resultType = 'complete';
});

describe('entity activity visibility', () => {
  it('allows creators and active collaborators but not invited amendment readers', () => {
    expect(canViewEntityActivity('amendment', { created_by_id: 'u1' }, 'u1')).toBe(true);
    expect(
      canViewEntityActivity(
        'amendment',
        { collaborators: [{ user_id: 'u2', status: 'active' }] },
        'u2'
      )
    ).toBe(true);
    expect(
      canViewEntityActivity(
        'amendment',
        { collaborators: [{ user_id: 'u2', status: 'invited' }] },
        'u2'
      )
    ).toBe(false);
  });

  it('allows active group members and event participants only', () => {
    expect(
      canViewEntityActivity('group', { memberships: [{ user_id: 'u1', status: 'member' }] }, 'u1')
    ).toBe(true);
    expect(
      canViewEntityActivity(
        'event',
        { participants: [{ user_id: 'u1', status: 'confirmed' }] },
        'u1'
      )
    ).toBe(true);
    expect(
      canViewEntityActivity('event', { participants: [{ user_id: 'u1', status: 'invited' }] }, 'u1')
    ).toBe(false);
    expect(canViewEntityActivity('group', { visibility: 'public' }, undefined)).toBe(false);
  });

  it('allows an active group guest only with a contextual management right', () => {
    const guest = (resource: string, action = 'manage') => ({
      guest_accesses: [
        {
          user_id: 'u1',
          status: 'active',
          guest_roles: [{ role: { action_rights: [{ resource, action }] } }],
        },
      ],
    });
    expect(canViewEntityActivity('group', guest('groupRelationships'), 'u1')).toBe(true);
    expect(canViewEntityActivity('group', guest('payments'), 'u1')).toBe(false);
    expect(canViewEntityActivity('group', guest('groups', 'view'), 'u1')).toBe(false);
  });
});

describe('useEntityActivity', () => {
  it('selects the entity-specific query and resets when its identity changes', () => {
    const { result, rerender } = renderHook(({ id, type }) => useEntityActivity(type, id), {
      initialProps: { id: 'amendment-1', type: 'amendment' as ActivityEntityType },
    });
    expect(mocks.amendmentQuery).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'amendment-1', limit: 50, severity: 'all' })
    );

    act(() => result.current.setSeverity('high'));
    expect(result.current.severity).toBe('high');

    rerender({ id: 'group-1', type: 'group' });
    expect(result.current.severity).toBe('all');
    expect(mocks.groupQuery).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'group-1', severity: 'all' })
    );

    rerender({ id: 'event-1', type: 'event' });
    expect(mocks.eventQuery).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'event-1', severity: 'all' })
    );
  });

  it('keeps loading data stable and replaces a completed first page only when it changes', () => {
    mocks.page = undefined;
    mocks.resultType = 'unknown';
    const { result, rerender } = renderHook(() => useEntityActivity('event', 'event-1'));
    expect(result.current).toMatchObject({ activities: [], hasMore: false, isLoading: true });

    mocks.resultType = 'complete';
    rerender();
    expect(result.current.activities).toEqual([]);

    mocks.page = [{ created_at: 1, id: 'activity-1' }];
    rerender();
    expect(result.current.activities).toEqual(mocks.page);
    const firstPage = result.current.activities;

    rerender();
    expect(result.current.activities).toBe(firstPage);

    mocks.page = [{ created_at: 2, id: 'activity-2' }];
    rerender();
    expect(result.current.activities).toEqual(mocks.page);
  });

  it('paginates with the last cursor, deduplicates additions, and resets on filtering', () => {
    mocks.page = Array.from({ length: 50 }, (_, index) => ({
      created_at: index,
      id: `activity-${index}`,
    }));
    const { result, rerender } = renderHook(() => useEntityActivity('group', 'group-1'));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    expect(mocks.groupQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: { created_at: 49, id: 'activity-49' } })
    );

    mocks.page = [
      { created_at: 49, id: 'activity-49' },
      { created_at: 50, id: 'activity-50' },
    ];
    rerender();
    expect(result.current.activities).toHaveLength(51);
    expect(result.current.activities.at(-1)?.id).toBe('activity-50');

    rerender();
    expect(result.current.activities).toHaveLength(51);
    act(() => result.current.loadMore());

    mocks.page = [];
    act(() => result.current.setSeverity('normal'));
    expect(result.current).toMatchObject({ activities: [], severity: 'normal' });
    expect(mocks.groupQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: null, severity: 'normal' })
    );
  });
});
