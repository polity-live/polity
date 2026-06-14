import { useAuth } from '@/providers/auth-provider';

export function useRequiredUser() {
  const { user } = useAuth();
  if (!user) {
    throw new Error('useRequiredUser must be used inside EnsureUser');
  }
  return user;
}
