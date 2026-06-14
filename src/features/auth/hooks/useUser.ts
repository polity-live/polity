import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';

export function useUser() {
  const { user, loading } = useAuth();
  const { currentUser, isLoading: userStateLoading } = useUserState();

  const isLoading = loading || (user?.id ? userStateLoading : false);

  return {
    user: currentUser || user,
    isLoading,
    error: null,
  };
}
