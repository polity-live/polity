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
  const accessKey = JSON.stringify([
    input.entityType,
    input.entityId,
    input.parentType,
    input.parentId,
    session?.user.id,
  ]);
  const pendingState: EntityRouteAccessState = {
    data: null,
    isLoading: true,
    error: null,
    recoveryDraft: null,
  };
  const [storedState, setState] = useState({ ...pendingState, accessKey });
  // Never expose the previous entity or account's access decision, even for
  // the render before the effect starts the next request.
  const state = storedState.accessKey === accessKey ? storedState : pendingState;

  useEffect(() => {
    let cancelled = false;

    // Refreshing a token for the same account revalidates access in place.
    // Unmounting the route here discards forms and security confirmation dialogs.
    setState(previous =>
      previous.accessKey === accessKey && previous.data
        ? previous
        : { data: null, isLoading: true, error: null, recoveryDraft: null, accessKey }
    );

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

        setState({ data: result, isLoading: false, error: null, recoveryDraft: null, accessKey });
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
          accessKey,
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
    accessKey,
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
