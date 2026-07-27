import { useEffect, useMemo, useState } from 'react';
import { groupConflictPreflightFn } from '@/server/group-conflict-preflight';
import {
  buildGroupConflictResponse,
  groupConflictResponseSchema,
  type GroupConflictResponse,
  toGroupConflictError,
} from '@/features/groups/logic/groupConflict';
import type { GroupConflictPreflightInput } from '@/features/groups/logic/groupConflictPreflight';

interface UseGroupConflictPreflightOptions {
  enabled?: boolean;
}

export function useGroupConflictPreflight(
  input: GroupConflictPreflightInput | null | undefined,
  options?: UseGroupConflictPreflightOptions
) {
  const enabled = options?.enabled ?? true;
  const [response, setResponse] = useState<GroupConflictResponse>(() =>
    buildGroupConflictResponse([])
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const serializedInput = useMemo(
    () => (enabled && input ? JSON.stringify(input) : null),
    [enabled, input]
  );
  const stableInput = useMemo<GroupConflictPreflightInput | null>(
    () => (serializedInput ? (JSON.parse(serializedInput) as GroupConflictPreflightInput) : null),
    [serializedInput]
  );

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !stableInput) {
      setResponse(buildGroupConflictResponse([]));
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    void groupConflictPreflightFn({ data: stableInput })
      .then(nextResponse => {
        if (cancelled) {
          return;
        }
        setResponse(groupConflictResponseSchema.parse(nextResponse));
      })
      .catch(caughtError => {
        if (cancelled) {
          return;
        }

        const conflictError = toGroupConflictError(caughtError);
        if (conflictError) {
          setResponse(conflictError.response);
          setError(null);
          return;
        }

        setResponse(buildGroupConflictResponse([]));
        setError(caughtError instanceof Error ? caughtError : new Error('Preflight failed'));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, stableInput]);

  return {
    response,
    isLoading,
    error,
    blocking: response.blocking,
  };
}
