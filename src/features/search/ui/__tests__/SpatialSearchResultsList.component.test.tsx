/* @vitest-environment jsdom */

import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SearchDocument } from '../../types/search-document.types';
import { SpatialSearchResultsList } from '../SpatialSearchResultsList';

vi.mock('../SearchResultCard', () => ({
  SearchResultCard: ({ document }: { document: SearchDocument }) => (
    <div data-testid="search-result-card">{document.title}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

function makeDocument(id: string, title: string): SearchDocument {
  return {
    id,
    entity_id: id,
    entity_type: 'group',
    title,
    subtitle: null,
    summary: null,
    search_text: title,
    visibility: 'public',
    owner_user_id: null,
    group_id: null,
    image_url: null,
    location_latitude: 52.52,
    location_longitude: 13.405,
    location_label: 'Berlin',
    location_source: 'group',
    location_kind: null,
    location_place_id: null,
    location_boundary_source: null,
    location_geometry: null,
    location_bounds: null,
    card_payload: { type: 'group' },
    created_at: Date.now(),
    updated_at: Date.now(),
    engagement_score: 0,
    trending_score: 0,
    tutorial_run_id: null,
    topics: [],
    group: null,
  } as SearchDocument;
}

describe('SpatialSearchResultsList', () => {
  it('renders search result cards and marks the active document externally', () => {
    render(
      <SpatialSearchResultsList
        parentRef={createRef<HTMLDivElement>()}
        cells={[
          {
            key: 'cell-0',
            index: 0,
            document: makeDocument('group:1', 'Active Group'),
          },
        ]}
        spaceBefore={24}
        spaceAfter={48}
        rowsEmpty={false}
        isComplete={false}
        emptyLabel="No results"
        activeDocumentId="group:1"
        onDocumentSelect={vi.fn()}
      />
    );

    const card = screen.getByTestId('search-result-card');
    const scrollContainer = screen.getByTestId('spatial-search-results-list');
    const wrapper = card.closest('[data-search-document-id="group:1"]');

    expect(scrollContainer.className).toContain('scrollbar-hide');
    expect(scrollContainer.className).toContain('overflow-auto');
    expect(scrollContainer.className).toContain('lg:h-full');
    expect(scrollContainer.className).not.toContain('100dvh');
    const virtualRow = wrapper?.parentElement;
    expect(virtualRow).not.toBeNull();
    if (!virtualRow) {
      throw new Error('Expected the result card to be wrapped in a virtual row');
    }
    expect(virtualRow.getAttribute('data-vrow-index')).toBe('0');
    expect(virtualRow.getAttribute('data-vrow-key')).toBe('cell-0');
    const content = virtualRow.parentElement;
    const beforeSpacer = content?.querySelector('[data-zero-virtual-spacer="before"]');
    const afterSpacer = content?.querySelector('[data-zero-virtual-spacer="after"]');
    expect(content?.style.paddingTop).toBe('');
    expect(content?.style.paddingBottom).toBe('');
    expect((beforeSpacer as HTMLElement).style.height).toBe('24px');
    expect((afterSpacer as HTMLElement).style.height).toBe('48px');
    expect(virtualRow.style.marginTop).toBe('0px');
    expect(card.textContent).toContain('Active Group');
    expect(wrapper?.className).toContain('border-primary');
    expect(wrapper?.className).toContain('bg-primary/5');
  });

  it('selects the document when a result card is clicked', () => {
    const onDocumentSelect = vi.fn();
    const searchDocument = makeDocument('group:2', 'Clickable Group');

    render(
      <SpatialSearchResultsList
        parentRef={createRef<HTMLDivElement>()}
        cells={[
          {
            key: 'cell-1',
            index: 1,
            document: searchDocument,
          },
        ]}
        spaceBefore={0}
        spaceAfter={120}
        rowsEmpty={false}
        isComplete={false}
        emptyLabel="No results"
        activeDocumentId={null}
        onDocumentSelect={onDocumentSelect}
      />
    );

    const action = screen.getByRole('button');

    expect(action.getAttribute('data-action-id')).toBe('search.spatial-result.select');
    expect(action.getAttribute('aria-pressed')).toBe('false');
    action.focus();
    expect(document.activeElement).toBe(action);
    fireEvent.keyDown(action, { key: 'Enter' });
    fireEvent.keyDown(action, { key: ' ' });
    fireEvent.click(action);

    expect(onDocumentSelect).toHaveBeenCalledTimes(3);
    expect(onDocumentSelect).toHaveBeenNthCalledWith(1, searchDocument);
    expect(onDocumentSelect).toHaveBeenNthCalledWith(2, searchDocument);
    expect(onDocumentSelect).toHaveBeenNthCalledWith(3, searchDocument);
    expect(
      screen
        .getByTestId('spatial-search-results-list')
        .querySelector('[data-zero-virtual-spacer="before"]')
    ).toBeNull();
    expect(
      (
        screen
          .getByTestId('spatial-search-results-list')
          .querySelector('[data-zero-virtual-spacer="after"]') as HTMLElement
      ).style.height
    ).toBe('120px');
  });

  it('renders an inert skeleton cell while its document is unavailable', () => {
    const onDocumentSelect = vi.fn();
    const { container } = render(
      <SpatialSearchResultsList
        parentRef={createRef<HTMLDivElement>()}
        cells={[{ key: 'skeleton-0', index: 0, document: null }]}
        spaceBefore={0}
        spaceAfter={0}
        rowsEmpty={false}
        isComplete={false}
        emptyLabel="No results"
        activeDocumentId={null}
        onDocumentSelect={onDocumentSelect}
      />
    );

    const skeleton = container.querySelector(
      '[data-action-id="search.spatial-result.select"]'
    ) as HTMLElement;
    expect(skeleton.getAttribute('tabindex')).toBe('-1');
    expect(skeleton.getAttribute('data-search-document-id')).toBeNull();
    fireEvent.keyDown(skeleton, { key: 'Enter' });
    fireEvent.click(skeleton);
    expect(onDocumentSelect).not.toHaveBeenCalled();
  });
});
