import { useQuery } from '@/zero/observed-query';
import { queries } from '../queries';

export function useUserHashtagsState(userId?: string) {
  const [userHashtags, result] = useQuery(
    userId ? queries.common.userHashtags({ user_id: userId }) : undefined
  );

  return {
    userHashtags: userHashtags ?? [],
    isLoading: Boolean(userId) && result.type === 'unknown',
  };
}
