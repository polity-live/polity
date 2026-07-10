/* @vitest-environment jsdom */

import { createRef } from 'react';
import { cleanup, render } from '@testing-library/react';
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
  it('reveals search cards sequentially without animating the virtual position wrapper', () => {
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
          },
        ]}
        totalHeight={400}
        showNewResults={false}
        rowsEmpty={false}
        isComplete
        newResultsLabel="New results"
        emptyLabel="No results"
        onJumpToTop={vi.fn()}
        onScroll={vi.fn()}
        onMeasureElement={vi.fn()}
      />
    );

    const positionWrapper = container.querySelector('[data-index="4"]') as HTMLElement | null;
    const revealWrapper = container.querySelector('.civic-load-card-reveal') as HTMLElement | null;

    expect(positionWrapper).toBeTruthy();
    expect(positionWrapper?.style.transform).toBe('translate(40px, 20px)');
    expect(positionWrapper?.className).not.toContain('civic-load-card-reveal');
    expect(revealWrapper).toBeTruthy();
    expect(revealWrapper?.style.getPropertyValue('--civic-load-index')).toBe('4');
  });
});
