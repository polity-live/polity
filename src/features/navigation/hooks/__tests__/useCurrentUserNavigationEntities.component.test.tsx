/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCurrentUserNavigationEntities } from '../useCurrentUserNavigationEntities';

const mocks = vi.hoisted(() => ({
  amendments: [] as unknown[],
  groups: undefined as unknown[] | undefined,
  isLoadingAmendments: false,
  isLoadingEvents: false,
  isLoadingGroups: false,
  participations: [] as unknown[],
}));

vi.mock('@/features/navigation/logic/userMenuItems', () => ({
  buildUserMenuAmendments: (items: unknown[]) => items.map(() => 'amendment'),
  buildUserMenuEvents: (items: unknown[]) => items.map(() => 'event'),
  buildUserMenuGroups: (items: unknown[]) => items.map(() => 'group'),
}));
vi.mock('@/zero/groups/useGroupState.ts', () => ({
  useGroupState: () => ({
    currentUserMembershipsWithGroups: mocks.groups,
    isLoading: mocks.isLoadingGroups,
  }),
}));
vi.mock('@/zero/events/useEventState.ts', () => ({
  useUserEventParticipations: () => ({
    participations: mocks.participations,
    isLoading: mocks.isLoadingEvents,
  }),
}));
vi.mock('@/zero/amendments/useAmendmentState.ts', () => ({
  useCurrentUserOpenNavigationAmendments: () => ({
    amendments: mocks.amendments,
    isLoading: mocks.isLoadingAmendments,
  }),
}));

beforeEach(() => {
  mocks.groups = undefined;
  mocks.participations = [];
  mocks.amendments = [];
  mocks.isLoadingGroups = false;
  mocks.isLoadingEvents = false;
  mocks.isLoadingAmendments = false;
});

describe('useCurrentUserNavigationEntities', () => {
  it('uses empty data fallbacks and disables navigation data', () => {
    const { result } = renderHook(() => useCurrentUserNavigationEntities('user-1', false));
    expect(result.current).toEqual({
      groups: [],
      events: [],
      amendments: [],
      isLoading: false,
    });
  });

  it('builds enabled entities and covers every loading source', () => {
    mocks.participations = [{}];
    mocks.amendments = [{}];
    const { result, rerender } = renderHook(() => useCurrentUserNavigationEntities('user-1', true));
    expect(result.current.groups).toEqual([]);
    expect(result.current.events).toEqual(['event']);
    expect(result.current.amendments).toEqual(['amendment']);
    expect(result.current.isLoading).toBe(false);

    mocks.groups = [{}];
    rerender();
    expect(result.current.groups).toEqual(['group']);
    mocks.isLoadingAmendments = true;
    rerender();
    expect(result.current.isLoading).toBe(true);
    mocks.isLoadingEvents = true;
    rerender();
    expect(result.current.isLoading).toBe(true);
    mocks.isLoadingGroups = true;
    rerender();
    expect(result.current.isLoading).toBe(true);
  });
});
