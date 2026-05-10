import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

interface UsePqlFilterStateArgs {
  storage_key: string;
  group_id?: string;
}

export function usePqlFilterState(args?: UsePqlFilterStateArgs) {
  const [filters, result] = useQuery(
    args
      ? queries.pql.byScope({
          storage_key: args.storage_key,
          group_id: args.group_id ?? null,
        })
      : undefined
  );

  return {
    filters: filters ?? [],
    isLoading: Boolean(args) && result.type === 'unknown',
  };
}
