import {
  useHistoryScrollState,
  useZeroVirtualizer,
  useZeroWindowVirtualizer,
  type UseZeroVirtualizerOptions,
  type ZeroVirtualizerResult,
} from '@rocicorp/zero-virtual/react';

export type PolityZeroListOptions<TListContext, TRow, TStartRow> = Omit<
  UseZeroVirtualizerOptions<TListContext, TRow, TStartRow>,
  'scrollState' | 'onScrollStateChange'
> & {
  scrollStateKey: string;
};

/** Shared zero-virtual 0.6 boundary with Navigation API backed restoration. */
export function usePolityZeroList<TListContext, TRow, TStartRow>({
  scrollStateKey,
  ...options
}: PolityZeroListOptions<TListContext, TRow, TStartRow>): ZeroVirtualizerResult<TRow> {
  const [scrollState, onScrollStateChange] = useHistoryScrollState<TStartRow>(scrollStateKey);

  return useZeroVirtualizer<TListContext, TRow, TStartRow>({
    ...options,
    scrollState,
    onScrollStateChange,
  });
}

/** Window-scrolling counterpart used by document-flow feeds. */
export function usePolityZeroWindowList<TListContext, TRow, TStartRow>({
  scrollStateKey,
  ...options
}: PolityZeroListOptions<TListContext, TRow, TStartRow>): ZeroVirtualizerResult<TRow> {
  const [scrollState, onScrollStateChange] = useHistoryScrollState<TStartRow>(scrollStateKey);

  return useZeroWindowVirtualizer<TListContext, TRow, TStartRow>({
    ...options,
    scrollState,
    onScrollStateChange,
  });
}
