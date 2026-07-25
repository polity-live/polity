import {
  useHistoryScrollState,
  useZeroVirtualizer,
  useZeroWindowVirtualizer,
  type UseZeroVirtualizerOptions,
  type ZeroVirtualizerResult,
} from '@rocicorp/zero-virtual/react';
import { useRef } from 'react';

export type PolityZeroListOptions<TListContext, TRow, TStartRow> = Omit<
  UseZeroVirtualizerOptions<TListContext, TRow, TStartRow>,
  'scrollState' | 'onScrollStateChange'
> & {
  scrollStateKey: string;
};

function serializeListContext(value: unknown): string | undefined {
  try {
    return JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (
        nestedValue === undefined ||
        typeof nestedValue === 'function' ||
        typeof nestedValue === 'symbol' ||
        typeof nestedValue === 'bigint' ||
        (typeof nestedValue === 'number' && !Number.isFinite(nestedValue))
      ) {
        throw new TypeError('listContextParams must be JSON-compatible');
      }
      return nestedValue;
    });
  } catch {
    return undefined;
  }
}

/** Preserves zero-virtual's identity contract when context content is unchanged. */
function useStableListContext<TListContext>(value: TListContext): TListContext {
  const stableRef = useRef<{
    serialized: string;
    value: TListContext;
  } | null>(null);
  const serialized = serializeListContext(value);

  if (serialized === undefined) {
    stableRef.current = null;
    return value;
  }
  if (!stableRef.current || stableRef.current.serialized !== serialized) {
    stableRef.current = { serialized, value };
  }
  return stableRef.current.value;
}

/** Shared zero-virtual 0.6 boundary with Navigation API backed restoration. */
export function usePolityZeroList<TListContext, TRow, TStartRow>({
  scrollStateKey,
  ...options
}: PolityZeroListOptions<TListContext, TRow, TStartRow>): ZeroVirtualizerResult<TRow> {
  const [scrollState, onScrollStateChange] = useHistoryScrollState<TStartRow>(scrollStateKey);
  const listContextParams = useStableListContext(options.listContextParams);

  return useZeroVirtualizer<TListContext, TRow, TStartRow>({
    ...options,
    listContextParams,
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
  const listContextParams = useStableListContext(options.listContextParams);

  return useZeroWindowVirtualizer<TListContext, TRow, TStartRow>({
    ...options,
    listContextParams,
    scrollState,
    onScrollStateChange,
  });
}
