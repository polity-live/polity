import { useEffect, useState } from 'react';
import {
  entityRouteAccessFn,
  type EntityRouteAccessInput,
  type EntityRouteAccessResult,
} from '@/server/entity-route-access';
import {
  useCreateRecoveryDraft,
  type CreateRecoveryDraft,
} from '@/features/create/logic/createFinalization';
import type { ContentType } from '@/features/timeline/constants/content-type-config';
import { useAuth } from '@/providers/auth-provider';

interface EntityRouteAccessState {
  data: EntityRouteAccessResult | null;
  isLoading: boolean;
  error: Error | null;
  recoveryDraft: CreateRecoveryDraft | null;
}

function toCreateRecoveryEntityType(
  entityType: EntityRouteAccessInput['entityType']
): ContentType | null {
  if (
    entityType === 'group' ||
    entityType === 'event' ||
    entityType === 'amendment' ||
    entityType === 'blog'
  ) {
    return entityType;
  }

  return null;
}

export function useEntityRouteAccess(input: EntityRouteAccessInput): EntityRouteAccessState {
  const { session, loading: authLoading } = useAuth();
  const recoveryDraft = useCreateRecoveryDraft(
    toCreateRecoveryEntityType(input.entityType),
    input.entityId
  );
  const [state, setState] = useState<EntityRouteAccessState>({
    data: null,
    isLoading: true,
    error: null,
    recoveryDraft: null,
  });

  useEffect(() => {
    let cancelled = false;

    setState({ data: null, isLoading: true, error: null, recoveryDraft: null });

    if (authLoading) {
      return () => {
        cancelled = true;
      };
    }

    const accessToken = session?.access_token;

    void entityRouteAccessFn({
      data: input,
      ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
    })
      .then(result => {
        if (cancelled) {
          return;
        }

        setState({ data: result, isLoading: false, error: null, recoveryDraft: null });
      })
      .catch(error => {
        if (cancelled) {
          return;
        }

        setState({
          data: null,
          isLoading: false,
          error: error instanceof Error ? error : new Error('Failed to resolve route access'),
          recoveryDraft: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    input.entityId,
    input.entityType,
    input.parentId,
    input.parentType,
    authLoading,
    recoveryDraft?.status,
    recoveryDraft?.submittedAt,
    session?.access_token,
  ]);

  if (authLoading) {
    return {
      data: null,
      isLoading: true,
      error: null,
      recoveryDraft,
    };
  }

  if (recoveryDraft?.status === 'pending' && !state.data?.exists) {
    return {
      data: {
        exists: true,
        visibilities: ['private'],
        canAccessPrivate: true,
      },
      isLoading: false,
      error: null,
      recoveryDraft,
    };
  }

  return { ...state, recoveryDraft };
}
