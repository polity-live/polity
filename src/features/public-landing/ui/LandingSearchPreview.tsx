'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { EntitySearchBar, type FilterOption } from '@/features/shared/ui/typeahead';
import { SearchResultCard } from '@/features/search/ui/SearchResultCard';
import type { SearchDocument } from '@/features/search/types/search-document.types';

export function LandingSearchPreview() {
  const { t, tArray } = useTranslation();
  const searchPreviewQuery = t('pages.home.publicLanding.searchPreview.query');
  const [query, setQuery] = useState('');
  const [typingCycle, setTypingCycle] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    const startDelayMs = 520;
    const typeStepMs = 54;
    const visibleHoldMs = 3600;
    const resetPauseMs = 520;
    setQuery('');

    for (let index = 0; index < searchPreviewQuery.length; index += 1) {
      timers.push(
        window.setTimeout(
          () => setQuery(searchPreviewQuery.slice(0, index + 1)),
          startDelayMs + index * typeStepMs
        )
      );
    }
    timers.push(
      window.setTimeout(
        () => setTypingCycle(cycle => cycle + 1),
        startDelayMs + searchPreviewQuery.length * typeStepMs + visibleHoldMs + resetPauseMs
      )
    );
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [searchPreviewQuery, typingCycle]);

  const filters = useMemo<FilterOption[]>(
    () =>
      tArray('pages.home.publicLanding.searchPreview.filters').map((filter, index) => ({
        label: filter,
        value: filter.toLowerCase(),
        active: index < 3,
      })),
    [tArray]
  );
  const documents = useMemo<SearchDocument[]>(
    () =>
      tArray('pages.home.publicLanding.searchPreview.results').map((result, index) => ({
        id: `landing-search-${index}`,
        entity_type: 'workflow',
        entity_id: `landing-search-entity-${index}`,
        title: result,
        subtitle:
          index === 0
            ? t('pages.home.publicLanding.searchPreview.parliamentaryGroup')
            : t('pages.home.publicLanding.searchPreview.budgetCommittee'),
        summary: t('pages.home.publicLanding.searchPreview.resultMeta'),
        search_text: `${result} ${t('pages.home.publicLanding.searchPreview.resultMeta')}`,
        visibility: 'public',
        owner_user_id: null,
        group_id: 'landing-group',
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
        card_payload: { type: 'workflow', tags: ['climate', 'budget', 'committee'] },
        created_at: Date.now() - index * 1000 * 60 * 60,
        updated_at: Date.now() - index * 1000 * 60 * 15,
        engagement_score: 32 - index,
        trending_score: 18 - index,
        tutorial_run_id: null,
        topics: [{ topic: 'climate' }, { topic: index === 0 ? 'amendments' : 'events' }],
        group: {
          id: 'landing-group',
          name: t('pages.home.publicLanding.searchPreview.parliamentaryGroup'),
        },
      })) as SearchDocument[],
    [t, tArray]
  );
  const resultBaseDelayMs = 520 + searchPreviewQuery.length * 54 + 260;
  const caretOffset = `${Math.min(query.length, 28)}ch`;

  return (
    <div className="landing-search-preview bg-card rounded-lg border p-5 shadow-sm">
      <div className="landing-search-field relative overflow-hidden rounded-md">
        <EntitySearchBar
          searchQuery={query}
          onSearchQueryChange={setQuery}
          placeholder={t('features.search.placeholder', { defaultValue: 'Search...' })}
          filterOptions={filters}
          onFilterToggle={() => undefined}
        />
        <span
          className="landing-search-typing-caret pointer-events-none absolute top-3 left-9 h-5 w-px"
          style={{ transform: `translateX(${caretOffset})` }}
        />
      </div>
      <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        {documents.map((document, index) => (
          <div
            key={`${typingCycle}-${document.id}`}
            className="landing-search-result-card min-h-[14rem] max-w-full min-w-0"
            style={{ animationDelay: `${resultBaseDelayMs + index * 140}ms` }}
          >
            <SearchResultCard document={document} />
          </div>
        ))}
      </div>
    </div>
  );
}
