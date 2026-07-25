import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import type { UserProfile } from '../types/user.types';

/**
 * Hook to fetch user profile data from Zero.
 * Returns the raw FullProfileRow directly — no transformation layer.
 */
export function useUserData(userId?: string) {
  const [baseUser, userResult] = useQuery(userId ? queries.users.byId({ id: userId }) : undefined);
  const [userHashtags, hashtagResult] = useQuery(
    userId ? queries.common.userHashtags({ user_id: userId }) : undefined
  );

  const isLoading =
    userId !== undefined && (userResult.type === 'unknown' || hashtagResult.type === 'unknown');
  const user = useMemo<UserProfile | null>(() => {
    if (!userId || isLoading || !baseUser) return null;

    return {
      ...baseUser,
      user_hashtags: userHashtags ?? [],
    };
  }, [baseUser, isLoading, userHashtags, userId]);

  return {
    user,
    userId,
    isLoading,
    error: null,
  };
}
