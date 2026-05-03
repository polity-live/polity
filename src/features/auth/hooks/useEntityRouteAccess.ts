import { useEffect, useState } from 'react';
import {
  entityRouteAccessFn,
  type EntityRouteAccessInput,
  type EntityRouteAccessResult,
} from '@/server/entity-route-access';

interface EntityRouteAccessState {
  data: EntityRouteAccessResult | null;
  isLoading: boolean;
  error: Error | null;
}

export function useEntityRouteAccess(input: EntityRouteAccessInput): EntityRouteAccessState {
  const [state, setState] = useState<EntityRouteAccessState>({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    setState({ data: null, isLoading: true, error: null });

    void entityRouteAccessFn({ data: input })
      .then(result => {
        if (cancelled) {
          return;
        }

        setState({ data: result, isLoading: false, error: null });
      })
      .catch(error => {
        if (cancelled) {
          return;
        }

        setState({
          data: null,
          isLoading: false,
          error: error instanceof Error ? error : new Error('Failed to resolve route access'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [input.entityId, input.entityType, input.parentId, input.parentType]);

  return state;
}
