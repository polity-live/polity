/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { SearchHeader } from '../SearchHeader';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useLanguageStore.setState({ language: 'en' });
});

function renderHeader(totalResults: number | null) {
  return render(
    <SearchHeader
      searchQuery="K1"
      setSearchQuery={vi.fn()}
      showFilters={false}
      setShowFilters={vi.fn()}
      activeTopics={[]}
      onTopicToggle={vi.fn()}
      totalResults={totalResults}
      queryParam="K1"
      view="list"
      onViewChange={vi.fn()}
    />
  );
}

describe('SearchHeader result summary', () => {
  it('shows a neutral searching message while the exact total is unknown', () => {
    renderHeader(null);

    expect(screen.getByText('Searching for "K1"…')).toBeTruthy();
    expect(screen.queryByText(/0 results/)).toBeNull();
  });

  it('shows exact positive and empty result totals once known', () => {
    const { rerender } = renderHeader(17);

    expect(screen.getByText('Showing 17 results for "K1"')).toBeTruthy();

    rerender(
      <SearchHeader
        searchQuery="K1"
        setSearchQuery={vi.fn()}
        showFilters={false}
        setShowFilters={vi.fn()}
        activeTopics={[]}
        onTopicToggle={vi.fn()}
        totalResults={0}
        queryParam="K1"
        view="list"
        onViewChange={vi.fn()}
      />
    );

    expect(screen.getByText('Showing 0 results for "K1"')).toBeTruthy();
  });
});
