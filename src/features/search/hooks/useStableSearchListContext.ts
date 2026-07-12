import { useRef } from 'react';

import type { SearchListContext } from '../types/search-document.types';

/** Keeps zero-virtual's identity-sensitive list context stable for equal content. */
export function useStableSearchListContext(context: SearchListContext): SearchListContext {
  const normalized: SearchListContext = {
    query: context.query,
    types: [...context.types].sort(),
    topics: [...context.topics].sort(),
    createdAfter: context.createdAfter,
    engagement: context.engagement,
    sort: context.sort,
    snapshotAt: context.snapshotAt,
    bounds: context.bounds ?? null,
  };
  const serialized = JSON.stringify(normalized);
  const stableRef = useRef<{ serialized: string; value: SearchListContext } | null>(null);

  if (!stableRef.current || stableRef.current.serialized !== serialized) {
    stableRef.current = { serialized, value: normalized };
  }

  return stableRef.current.value;
}
