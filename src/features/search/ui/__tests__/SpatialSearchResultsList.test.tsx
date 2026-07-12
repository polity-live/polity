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
    expect(wrapper?.parentElement?.getAttribute('data-vrow-index')).toBe('0');
    expect(wrapper?.parentElement?.getAttribute('data-vrow-key')).toBe('cell-0');
    expect(wrapper?.parentElement?.parentElement?.style.paddingTop).toBe('24px');
    expect(wrapper?.parentElement?.parentElement?.style.paddingBottom).toBe('48px');
    expect(card.textContent).toContain('Active Group');
    expect(wrapper?.className).toContain('border-primary');
    expect(wrapper?.className).toContain('bg-primary/5');
  });

  it('selects the document when a result card is clicked', () => {
    const onDocumentSelect = vi.fn();
    const document = makeDocument('group:2', 'Clickable Group');

    render(
      <SpatialSearchResultsList
        parentRef={createRef<HTMLDivElement>()}
        cells={[
          {
            key: 'cell-1',
            index: 1,
            document,
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

    fireEvent.click(screen.getByText('Clickable Group'));

    expect(onDocumentSelect).toHaveBeenCalledWith(document);
  });
});
