export function mergeCreateSearchParams<TSearch extends object>(
  currentSearch: TSearch,
  updates: Partial<TSearch>
): TSearch {
  const mergedSearch = {
    ...(currentSearch as Record<string, unknown>),
    ...(updates as Record<string, unknown>),
  };

  return Object.fromEntries(
    Object.entries(mergedSearch).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as TSearch;
}
