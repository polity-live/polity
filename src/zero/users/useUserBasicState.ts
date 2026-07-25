import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

export function useUserBasicState(userId?: string) {
  const [user, result] = useQuery(userId ? queries.users.byId({ id: userId }) : undefined);

  return {
    user,
    isLoading: Boolean(userId) && result.type === 'unknown',
  };
}
