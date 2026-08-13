/* @vitest-environment jsdom */

import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SearchDocument } from '../../types/search-document.types';
import { VirtualSearchGridView } from '../VirtualSearchGridView';

vi.mock('../SearchResultCard', () => ({
  SearchResultCard: ({ document }: { document: SearchDocument }) => (
    <div data-testid="search-result-card">{document.title}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('VirtualSearchGridView', () => {
  it('positions fixed-height search cards without entrance animations or measurements', () => {
    const document = {
      id: 'search-doc-1',
      entity_id: 'group-1',
      entity_type: 'group',
      title: 'Civic Assembly',
      subtitle: null,
      summary: 'A group for civic work.',
      search_text: '',
      visibility: 'public',
      image_url: null,
      location_latitude: null,
      location_longitude: null,
      location_label: null,
      location_source: null,
      location_kind: null,
      location_place_id: null,
      location_boundary_source: null,
      location_geometry: null,
      location_bounds: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      owner_user_id: null,
      group_id: null,
      card_payload: { type: 'group' },
      engagement_score: 0,
      trending_score: 0,
      tutorial_run_id: null,
      topics: [],
      group: null,
    } as SearchDocument;

    const { container } = render(
      <VirtualSearchGridView
        parentRef={createRef<HTMLDivElement>()}
        cells={[
          {
            key: 'cell-4',
            index: 4,
            top: 20,
            left: 40,
            width: 320,
            document,
            mode: 'preview',
          },
        ]}
        totalHeight={400}
        showNewResults={false}
        rowsEmpty={false}
        isComplete
        newResultsLabel="New results"
        emptyLabel="No results"
        onJumpToTop={vi.fn()}
      />
    );

    const positionWrapper = container.querySelector('[data-index="4"]') as HTMLElement | null;
    const scrollContainer = container.querySelector('.overflow-auto') as HTMLElement | null;

    expect(scrollContainer?.dataset.testid).toBe('search-results-scroll');
    expect(scrollContainer?.className).toContain('scrollbar-hide');
    expect(scrollContainer?.className).toContain('h-full');
    expect(scrollContainer?.className).toContain('min-h-0');
    expect(scrollContainer?.className).not.toContain('100dvh');
    expect(positionWrapper).toBeTruthy();
    expect(positionWrapper?.style.transform).toBe('translate(40px, 20px)');
    expect(positionWrapper?.style.height).toBe('360px');
    expect(positionWrapper?.dataset.searchDocumentId).toBe('search-doc-1');
    expect(positionWrapper?.dataset.searchCardMode).toBe('preview');
    expect(container.querySelector('.civic-load-card-reveal')).toBeNull();
    expect(container.querySelector('.civic-page-reveal')).toBeNull();
  });

  it('jumps to newly available results through a stable focusable action', () => {
    const onJumpToTop = vi.fn();

    render(
      <VirtualSearchGridView
        parentRef={createRef<HTMLDivElement>()}
        cells={[]}
        totalHeight={0}
        showNewResults
        rowsEmpty={false}
        isComplete={false}
        newResultsLabel="New results"
        emptyLabel="No results"
        onJumpToTop={onJumpToTop}
      />
    );

    const action = screen.getByRole('button', { name: 'New results' });
    expect(action.getAttribute('data-action-id')).toBe('search.virtual-grid.jump-to-top');
    action.focus();
    expect(document.activeElement).toBe(action);
    fireEvent.click(action);

    expect(onJumpToTop).toHaveBeenCalledTimes(1);
  });
});
