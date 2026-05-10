import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { onServerError } from '../mutate-with-server-check';
import { mutators } from '../mutators';

export function usePqlFilterActions() {
  const zero = useZero();

  const createFilter = useCallback(
    (args: {
      id: string;
      storage_key: string;
      label: string;
      query: string;
      group_id?: string;
      is_active: boolean;
    }) => {
      const result = zero.mutate(
        mutators.pql.create({
          ...args,
          group_id: args.group_id ?? null,
        })
      );

      onServerError(result, message => console.error('PQL filter create failed:', message));
    },
    [zero]
  );

  const updateFilter = useCallback(
    (args: { id: string; label?: string; query?: string; is_active?: boolean }) => {
      const result = zero.mutate(mutators.pql.update(args));
      onServerError(result, message => console.error('PQL filter update failed:', message));
    },
    [zero]
  );

  const deleteFilter = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.pql.delete({ id }));
      onServerError(result, message => console.error('PQL filter delete failed:', message));
    },
    [zero]
  );

  return {
    createFilter,
    updateFilter,
    deleteFilter,
  };
}
