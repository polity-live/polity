import { useEffect, useMemo, useState } from 'react';

import { ARIA_KAI_USER_ID } from '@/features/auth/constants';
import { useUserState } from '@/zero/users/useUserState';

interface UseNewConversationDialogControllerOptions {
  open: boolean;
  currentUserId?: string;
  initialSearchQuery?: string;
  existingConversationUserIds: string[];
}

export function useNewConversationDialogController({
  open,
  currentUserId,
  initialSearchQuery,
  existingConversationUserIds,
}: UseNewConversationDialogControllerOptions) {
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const { publicUsers: allUsers } = useUserState({ includePublicUsers: true });

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

    if (!userSearchQuery.trim()) {
      return allUsers.filter(baseFilter);
    }

    return allUsers.filter(baseFilter).filter(user => {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ').toLowerCase();
      const handle = user.handle?.toLowerCase() || '';
      const query = userSearchQuery.toLowerCase();
      return name.includes(query) || handle.includes(query);
    });
  }, [allUsers, userSearchQuery, currentUserId, existingConversationUserIds]);

  return {
    userSearchQuery,
    onUserSearchQueryChange: setUserSearchQuery,
    filteredUsers,
  };
}
