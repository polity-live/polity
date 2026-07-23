import { useEffect, useMemo, useState } from 'react';

import { ARIA_KAI_USER_ID } from '@/features/auth/constants';
import { useUserState } from '@/zero/users/useUserState';

interface UseNewConversationDialogControllerOptions {
  open: boolean;
  currentUserId?: string;
  initialSearchQuery?: string;
  initialUserId?: string;
  existingConversationUserIds: string[];
}

export function useNewConversationDialogController({
  open,
  currentUserId,
  initialSearchQuery,
  initialUserId,
  existingConversationUserIds,
}: UseNewConversationDialogControllerOptions) {
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const { publicUsers: allUsers, user: initialUser } = useUserState({
    includePublicUsers: true,
    userId: initialUserId,
  });

  useEffect(() => {
    if (open) {
      setUserSearchQuery(initialSearchQuery ?? '');
    }
  }, [initialSearchQuery, open]);

  const filteredUsers = useMemo(() => {
    const baseFilter = (user: (typeof allUsers)[number]) =>
      user.id !== currentUserId &&
      user.id !== ARIA_KAI_USER_ID &&
      !existingConversationUserIds.includes(user.id);

    if (initialUserId) {
      return initialUser?.id === initialUserId && baseFilter(initialUser) ? [initialUser] : [];
    }

    if (!userSearchQuery.trim()) {
      return allUsers.filter(baseFilter);
    }

    return allUsers.filter(baseFilter).filter(user => {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ').toLowerCase();
      const handle = user.handle?.toLowerCase() || '';
      const query = userSearchQuery.toLowerCase();
      return name.includes(query) || handle.includes(query);
    });
  }, [
    allUsers,
    currentUserId,
    existingConversationUserIds,
    initialUser,
    initialUserId,
    userSearchQuery,
  ]);

  return {
    userSearchQuery,
    onUserSearchQueryChange: setUserSearchQuery,
    filteredUsers,
    isTargetedSearch: Boolean(initialUserId),
  };
}
