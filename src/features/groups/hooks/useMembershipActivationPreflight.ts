import { useEffect, useMemo, useState } from 'react';
import { groupConflictPreflightFn } from '@/server/group-conflict-preflight';
import {
  buildGroupConflictResponse,
  mergeGroupConflictResponses,
  toGroupConflictError,
  type GroupConflictResponse,
} from '@/features/groups/logic/groupConflict';

interface UseMembershipActivationPreflightOptions {
  enabled?: boolean;
}

export function useMembershipActivationPreflight(
  groupId: string | null | undefined,
  userIds: readonly string[],
  options?: UseMembershipActivationPreflightOptions
) {
  const enabled = options?.enabled ?? true;
  const [response, setResponse] = useState<GroupConflictResponse>(() =>
    buildGroupConflictResponse([])
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const normalizedUserIds = useMemo(() => [...new Set(userIds.filter(Boolean))].sort(), [userIds]);
  const serializedRequest = useMemo(
    () =>
      enabled && groupId && normalizedUserIds.length > 0
        ? JSON.stringify({ groupId, userIds: normalizedUserIds })
        : null,
    [enabled, groupId, normalizedUserIds]
  );
  const stableRequest = useMemo<{ groupId: string; userIds: string[] } | null>(
    () =>
      serializedRequest
        ? (JSON.parse(serializedRequest) as { groupId: string; userIds: string[] })
        : null,
    [serializedRequest]
  );

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !stableRequest) {
      setResponse(buildGroupConflictResponse([]));
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    void Promise.all(
      stableRequest.userIds.map(async userId => {
        try {
          return await groupConflictPreflightFn({
            data: {
              kind: 'membership_activation',
              group_id: stableRequest.groupId,
              user_id: userId,
            },
          });
        } catch (caughtError) {
          const conflictError = toGroupConflictError(caughtError);
          if (conflictError) {
            return conflictError.response;
          }
          throw caughtError;
        }
      })
    )
      .then(responses => {
        if (cancelled) {
          return;
        }
        setResponse(mergeGroupConflictResponses(responses));
      })
      .catch(caughtError => {
        if (cancelled) {
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
  }, [enabled, stableRequest]);

  return {
    response,
    isLoading,
    error,
    blocking: response.blocking,
  };
}
