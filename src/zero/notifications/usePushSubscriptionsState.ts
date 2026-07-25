import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

/** Loads only the current viewer's registered push subscriptions. */
export function usePushSubscriptionsState() {
  const [data, result] = useQuery(queries.notifications.pushSubscriptions({}));
  return {
    data,
    isLoading: result.type === 'unknown',
  };
}
