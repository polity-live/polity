/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CIVIC_TIMELINE_CONTENT_TYPES } from '../../logic/civicTimeline';
import { useTimelinePage } from '../useTimelinePage';

const mocks = vi.hoisted(() => ({
  civic: vi.fn(),
  decision: vi.fn(),
  setContentTypes: vi.fn(),
  setDateRange: vi.fn(),
  setEngagement: vi.fn(),
  setMode: vi.fn(),
  setSortBy: vi.fn(),
  setTopics: vi.fn(),
  toggleContentType: vi.fn(),
  toggleTopic: vi.fn(),
}));

let authUser: { id?: string; email?: string | null } | null = null;
let filterState: any;

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock('@/features/decision-terminal/hooks/useDecisionTerminal', () => ({
  useDecisionTerminal: (args: unknown) => {
    mocks.decision(args);
    return { decisions: [{ id: 'decision-1' }], isLoading: false };
  },
}));

vi.mock('../useTimelineMode', () => ({
  useTimelineMode: () => ({ mode: 'feed', setMode: mocks.setMode }),
}));

vi.mock('../useTimelineFilters', () => ({
  useTimelineFilters: () => ({
    filters: filterState,
    setSortBy: mocks.setSortBy,
    setContentTypes: mocks.setContentTypes,
    toggleContentType: mocks.toggleContentType,
    setDateRange: mocks.setDateRange,
    setTopics: mocks.setTopics,
    toggleTopic: mocks.toggleTopic,
    setEngagement: mocks.setEngagement,
  }),
}));

vi.mock('../useCivicTimeline', () => ({
  useCivicTimeline: (args: unknown) => {
    mocks.civic(args);
    return { items: [], isLoading: false };
  },
}));

beforeEach(() => {
  authUser = { id: 'auth-user', email: 'user@example.test' };
  filterState = {
    contentTypes: [...CIVIC_TIMELINE_CONTENT_TYPES],
    dateRange: 'all',
    topics: [],
    engagement: 'all',
    sortBy: 'recent',
  };
  for (const mock of Object.values(mocks)) mock.mockClear();
});

describe('useTimelinePage', () => {
  it('uses explicit identity/group scope and resets every filter dimension', () => {
    const { result } = renderHook(() =>
      useTimelinePage({ userId: 'explicit-user', groupId: 'group-1' })
    );
    expect(result.current).toMatchObject({
      userId: 'explicit-user',
      activeFilterCount: 0,
      hasActiveFilters: false,
      radiusKm: 'all',
      showFilterPanel: false,
    });
    expect(mocks.decision).toHaveBeenCalledWith({ groupIds: ['group-1'] });
    expect(mocks.civic).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'explicit-user', userEmail: 'user@example.test' })
    );

    act(() => {
      result.current.handleSortChange('trending');
      result.current.handleResetFilters();
      result.current.setShowFilterPanel(true);
      result.current.setMode('map' as never);
    });
    expect(mocks.setSortBy).toHaveBeenCalledWith('trending');
    expect(mocks.setContentTypes).toHaveBeenCalledWith([...CIVIC_TIMELINE_CONTENT_TYPES]);
    expect(mocks.setDateRange).toHaveBeenCalledWith('all');
    expect(mocks.setTopics).toHaveBeenCalledWith([]);
    expect(mocks.setEngagement).toHaveBeenCalledWith('all');
    expect(result.current.showFilterPanel).toBe(true);
  });

  it('counts every active civic filter and falls back through authenticated identity', () => {
    filterState = {
      ...filterState,
      contentTypes: ['event'],
      dateRange: 'week',
      topics: ['budget'],
    };
    const { result } = renderHook(() => useTimelinePage());
    act(() => result.current.setRadiusKm(25));
    expect(result.current).toMatchObject({
      userId: 'auth-user',
      activeFilterCount: 4,
      hasActiveFilters: true,
      radiusKm: 25,
    });
    expect(mocks.decision).toHaveBeenCalledWith({ groupIds: undefined });
  });

  it('selects rail/map items, scrolls escaped IDs, and handles missing document/users', () => {
    const item = { id: 'item"\\value' } as any;
    const element = document.createElement('div');
    element.setAttribute('data-timeline-item-id', item.id);
    element.scrollIntoView = vi.fn();
    document.body.appendChild(element);
    const { result } = renderHook(() => useTimelinePage());

    act(() => result.current.handleMapItemSelect(item));
    expect(result.current.activeItemId).toBe(item.id);
    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    act(() => result.current.handleRailItemSelect({ id: 'rail' } as any));
    expect(result.current.activeItemId).toBe('rail');

    const browserDocument = document;
    vi.stubGlobal('document', undefined);
    act(() => result.current.handleMapItemSelect({ id: 'no-document' } as any));
    vi.stubGlobal('document', browserDocument);

    authUser = null;
    const anonymous = renderHook(() => useTimelinePage());
    expect(anonymous.result.current.userId).toBe('');
    expect(mocks.civic).toHaveBeenLastCalledWith(
      expect.objectContaining({ userEmail: undefined, userId: '' })
    );
  });
});
