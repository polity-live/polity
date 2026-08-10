/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ results: undefined as any, loading: false }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupState: () => ({ searchResults: mocks.results, isLoading: mocks.loading }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));
vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: any) => value ?? '',
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: (group: any) => group,
}));

import { groupsPageInternals, useGroupsPage } from '../useGroupsPage';

beforeEach(() => {
  mocks.results = undefined;
  mocks.loading = false;
});

describe('useGroupsPage', () => {
  it('normalizes missing search results and optional group fields', () => {
    mocks.results = [
      null,
      {
        id: 'g',
        name: null,
        description: null,
        member_count: null,
        event_count: null,
        amendment_count: null,
      },
    ];
    const { result } = renderHook(() => useGroupsPage());
    expect(result.current.filteredGroups).toEqual([
      {
        id: 'g',
        name: '',
        description: '',
        memberCount: 0,
        eventCount: 0,
        amendmentCount: 0,
        topics: [],
      },
    ]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('filters, toggles tags both ways, and clears active filters', () => {
    const groups = [
      { id: '1', name: 'Alpha', description: 'First', topics: ['Climate', 'Local'] },
      { id: '2', name: 'Beta', description: 'Economy', topics: ['Finance'] },
      { id: '3', name: 'Gamma', topics: [] },
    ];
    expect(groupsPageInternals.getAllGroupTags(groups as any)).toEqual([
      'Climate',
      'Finance',
      'Local',
    ]);
    expect(groupsPageInternals.filterGroupDisplays(groups as any, 'alpha', [])).toHaveLength(1);
    expect(groupsPageInternals.filterGroupDisplays(groups as any, 'economy', [])).toHaveLength(1);
    expect(groupsPageInternals.filterGroupDisplays(groups as any, 'clim', [])).toHaveLength(1);
    expect(groupsPageInternals.filterGroupDisplays(groups as any, 'absent', [])).toHaveLength(0);
    expect(
      groupsPageInternals.filterGroupDisplays(groups as any, '', ['clim', 'local'])
    ).toHaveLength(1);
    expect(groupsPageInternals.filterGroupDisplays(groups as any, '', ['absent'])).toHaveLength(0);

    const { result } = renderHook(() => useGroupsPage());
    act(() => result.current.setSearchTerm('query'));
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => result.current.toggleTag('tag'));
    expect(result.current.selectedTags).toEqual(['tag']);
    act(() => result.current.toggleTag('tag'));
    expect(result.current.selectedTags).toEqual([]);
    act(() => result.current.setSelectedTags(['one']));
    act(() => result.current.clearAllFilters());
    expect(result.current.hasActiveFilters).toBe(false);
  });
});
