/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  view: 'list' as 'list' | 'spatial',
  swipeOptions: undefined as
    | {
        onSwipePrev: () => void;
        onSwipeNext: () => void;
        canSwipePrev: boolean;
        canSwipeNext: boolean;
      }
    | undefined,
  setView: vi.fn(),
}));

vi.mock('../hooks/useSearchPage', () => ({
  useSearchPage: () => ({
    view: state.view,
    setView: state.setView,
    searchContext: { query: 'q' },
    permalinkId: 'permalink',
    setTotalResults: vi.fn(),
    searchQuery: 'query',
    setSearchQuery: vi.fn(),
    showFilters: false,
    setShowFilters: vi.fn(),
    contentTypes: [],
    setContentTypes: vi.fn(),
    toggleContentType: vi.fn(),
    dateRange: 'all',
    setDateRange: vi.fn(),
    topics: [],
    availableTopics: [],
    personalTopics: [],
    toggleTopic: vi.fn(),
    engagement: 'all',
    setEngagement: vi.fn(),
    resetFilters: vi.fn(),
    hasActiveFilters: false,
    totalResults: 0,
  }),
}));

vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: (options: typeof state.swipeOptions) => {
    state.swipeOptions = options;
    return { handlers: { onTouchStart: vi.fn() } };
  },
}));

vi.mock('../SearchCardStateProvider', () => ({
  SearchCardStateProvider: ({ children }: { children: React.ReactNode }) => (
    <section data-testid="provider">{children}</section>
  ),
}));
vi.mock('../ui/SearchPageView', () => ({
  SearchPageView: ({ results }: { results: React.ReactNode }) => (
    <main data-testid="page-view">{results}</main>
  ),
}));
vi.mock('../ui/SpatialSearchView', () => ({
  SpatialSearchView: () => <div>spatial-result</div>,
}));
vi.mock('../ui/VirtualSearchGrid', () => ({
  VirtualSearchGrid: () => <div>list-result</div>,
}));

import { SearchPage } from '../SearchPage';

describe('SearchPage view branches', () => {
  afterEach(() => {
    cleanup();
    state.setView.mockClear();
  });

  it('renders list mode and wires both swipe directions', () => {
    state.view = 'list';
    render(<SearchPage />);

    expect(screen.getByText('list-result')).toBeTruthy();
    expect(state.swipeOptions).toMatchObject({ canSwipePrev: false, canSwipeNext: true });
    state.swipeOptions?.onSwipePrev();
    state.swipeOptions?.onSwipeNext();
    expect(state.setView).toHaveBeenNthCalledWith(1, 'list');
    expect(state.setView).toHaveBeenNthCalledWith(2, 'spatial');
  });

  it('renders spatial mode', () => {
    state.view = 'spatial';
    render(<SearchPage />);

    expect(screen.getByText('spatial-result')).toBeTruthy();
    expect(state.swipeOptions).toMatchObject({ canSwipePrev: true, canSwipeNext: false });
  });
});
