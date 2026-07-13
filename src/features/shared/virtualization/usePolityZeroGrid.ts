import type { Virtualizer } from '@tanstack/react-virtual';

import { useZeroGridVirtualizer } from './grid-runtime/use-zero-grid-virtualizer';

export interface PolityZeroGridResult<TRow> {
  virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
  rowAt: (index: number) => TRow | undefined;
  complete: boolean;
  rowsEmpty: boolean;
  permalinkNotFound: boolean;
  estimatedTotal: number;
  total: number | undefined;
  settled: boolean;
}

/** Shared application boundary for cursor-paged, multi-lane Zero grids. */
export function usePolityZeroGrid<TRow>(
  options: Record<string, unknown>
): PolityZeroGridResult<TRow> {
  const useImplementation = useZeroGridVirtualizer as (
    runtimeOptions: Record<string, unknown>
  ) => PolityZeroGridResult<TRow>;

  return useImplementation(options);
}
