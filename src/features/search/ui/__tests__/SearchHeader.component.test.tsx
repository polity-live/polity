/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import {
  KeyboardPlatformProvider,
  type KeyboardPlatform,
} from '@/features/shared/keyboard/keyboard-shortcut';
import { SearchHeader } from '../SearchHeader';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useLanguageStore.setState({ language: 'en' });
});

function header(
  searchQuery: string,
  totalResults: number | null,
  platform: KeyboardPlatform = 'windows'
) {
  return (
    <KeyboardPlatformProvider platform={platform}>
      <SearchHeader
        searchQuery={searchQuery}
        setSearchQuery={vi.fn()}
        showFilters={false}
        setShowFilters={vi.fn()}
        activeTopics={[]}
        onTopicToggle={vi.fn()}
        totalResults={totalResults}
        queryParam={searchQuery}
        view="list"
        onViewChange={vi.fn()}
      />
    </KeyboardPlatformProvider>
  );
}

function renderHeader(totalResults: number | null) {
  return render(header('K1', totalResults));
}

function renderEmptyHeader(platform: KeyboardPlatform = 'windows') {
  return render(header('', null, platform));
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

    rerender(header('K1', 0));

    expect(screen.getByText('Showing 0 results for "K1"')).toBeTruthy();
  });
});

describe('SearchHeader command box promotion', () => {
  it('shows the localized shortcut only while the search field is empty', () => {
    const { rerender } = renderEmptyHeader();

    const input = screen.getByPlaceholderText('Search groups, events, amendments, users...');
    expect(input.getAttribute('aria-keyshortcuts')).toBe('Control+K');
    expect(screen.getByText('Ctrl K')).toBeTruthy();

    rerender(header('K1', null));

    expect(screen.queryByText('Ctrl K')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
  });

  it('uses the German control-key label without changing the placeholder', () => {
    useLanguageStore.setState({ language: 'de' });
    renderEmptyHeader();

    expect(
      screen.getByPlaceholderText('Suche nach Gruppen, Veranstaltungen, Anträgen, Nutzern...')
    ).toBeTruthy();
    expect(screen.getByText('Strg K')).toBeTruthy();
  });

  it('uses the Apple shortcut in both UI and ARIA on macOS', () => {
    renderEmptyHeader('macos');

    const input = screen.getByPlaceholderText('Search groups, events, amendments, users...');
    expect(input.getAttribute('aria-keyshortcuts')).toBe('Meta+K');
    expect(screen.getByText('⌘ K')).toBeTruthy();
  });
});

describe('SearchHeader actions', () => {
  it('exposes stable selectable view, filter, and personal-topic actions', () => {
    const onViewChange = vi.fn();
    const setShowFilters = vi.fn();
    const onTopicToggle = vi.fn();

    render(
      <KeyboardPlatformProvider platform="windows">
        <SearchHeader
          searchQuery=""
          setSearchQuery={vi.fn()}
          showFilters={false}
          setShowFilters={setShowFilters}
          activeTopics={[]}
          personalTopics={['climate']}
          onTopicToggle={onTopicToggle}
          totalResults={null}
          queryParam=""
          view="list"
          onViewChange={onViewChange}
        />
      </KeyboardPlatformProvider>
    );

    const listView = screen.getByRole('button', { name: 'List view' });
    const spatialView = screen.getByRole('button', { name: 'Spatial view' });
    const filters = screen.getByRole('button', { name: 'Filters' });
    const topic = screen.getByRole('button', { name: '#climate' });

    expect(listView.getAttribute('data-action-id')).toBe('search.header.view.list');
    expect(listView.getAttribute('aria-pressed')).toBe('true');
    expect(spatialView.getAttribute('data-action-id')).toBe('search.header.view.spatial');
    expect(spatialView.getAttribute('aria-pressed')).toBe('false');
    expect(filters.getAttribute('data-action-id')).toBe('search.header.filters.toggle');
    expect(topic.getAttribute('data-action-id')).toBe('search.header.topic.toggle');

    spatialView.focus();
    expect(document.activeElement).toBe(spatialView);
    fireEvent.click(spatialView);
    fireEvent.click(filters);
    topic.focus();
    fireEvent.click(topic);

    expect(onViewChange).toHaveBeenCalledWith('spatial');
    expect(setShowFilters).toHaveBeenCalledWith(true);
    expect(onTopicToggle).toHaveBeenCalledWith('climate');
  });
});
