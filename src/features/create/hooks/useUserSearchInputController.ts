import { useMemo } from 'react';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useUserState } from '@/zero/users/useUserState';

interface UseUserSearchInputControllerProps {
  excludeUserId?: string;
  excludeUserIds: string[];
}

export function useUserSearchInputController({
  excludeUserId,
  excludeUserIds,
}: UseUserSearchInputControllerProps) {
  const { allUsers } = useUserState({ includeAllUsers: true });

  const filteredUsers = useMemo(() => {
    const excludedIds = new Set(excludeUserIds);
    if (excludeUserId) {
      excludedIds.add(excludeUserId);
    }

    return (allUsers ?? []).filter(user => !excludedIds.has(user.id));
  }, [allUsers, excludeUserId, excludeUserIds]);

  const items = useMemo(
    () =>
      toTypeaheadItems(
        filteredUsers,
        'user',
        user => `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.handle || 'User',
        user => (user.handle ? `@${user.handle}` : user.email),
        user => user.avatar,
        user => `/user/${user.id}`
      ),
    [filteredUsers]
  );

  return { items };
}
