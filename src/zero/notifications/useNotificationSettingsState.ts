import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

/** Loads only the current viewer's notification settings. */
export function useNotificationSettingsState() {
  const [data, result] = useQuery(queries.notifications.settings({}));
  return {
    data,
    isLoading: result.type === 'unknown',
  };
}
