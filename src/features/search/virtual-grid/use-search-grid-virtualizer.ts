import type { Virtualizer } from '@tanstack/react-virtual';

import type { SearchDocument } from '../types/search-document.types';
import { useZeroGridVirtualizer } from './use-zero-grid-virtualizer';

interface SearchGridVirtualizerResult {
  virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
  rowAt: (index: number) => SearchDocument | undefined;
  complete: boolean;
  rowsEmpty: boolean;
  permalinkNotFound: boolean;
  estimatedTotal: number;
  total: number | undefined;
  settled: boolean;
}

/**
 * Typed application boundary around the vendored generic paging implementation.
 * Keeping the boundary search-specific avoids exposing the legacy package API.
 */
export function useSearchGridVirtualizer(options: Record<string, unknown>) {
  const useImplementation = useZeroGridVirtualizer as (
    options: Record<string, unknown>
  ) => SearchGridVirtualizerResult;

  return useImplementation(options);
}
