import { FormControlInput } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Search } from 'lucide-react';
import { useUserState } from '@/zero/users/useUserState';
import { ARIA_KAI_USER_ID } from '@/features/auth/constants';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  onUserSelect: (userId: string) => void;
  initialSearchQuery?: string;
  existingConversationUserIds?: string[]; // User IDs that already have a direct conversation
}

export function NewConversationDialog({
  open,
  onOpenChange,
  currentUserId,
  onUserSelect,
  initialSearchQuery,
  existingConversationUserIds = [],
}: NewConversationDialogProps) {
  const { t } = useTranslation();
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const { publicUsers: allUsers } = useUserState({ includePublicUsers: true });

  useEffect(() => {
    if (open) {
      setUserSearchQuery(initialSearchQuery ?? '');
    }
  }, [initialSearchQuery, open]);

  // Filter users in search dialog
  const filteredUsers = useMemo(() => {
    // Base filter: exclude current user, Aria & Kai, and users with existing conversations
    const baseFilter = (u: (typeof allUsers)[number]) =>
      u.id !== currentUserId &&
      u.id !== ARIA_KAI_USER_ID &&
      !existingConversationUserIds.includes(u.id);

    if (!userSearchQuery.trim()) {
      return allUsers.filter(baseFilter);
    }
    return allUsers.filter(baseFilter).filter(u => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').toLowerCase();
      const handle = u.handle?.toLowerCase() || '';
      return (
        name.includes(userSearchQuery.toLowerCase()) ||
        handle.includes(userSearchQuery.toLowerCase())
      );
    });
  }, [allUsers, userSearchQuery, currentUserId, existingConversationUserIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('features.messages.compose.startNew')}</DialogTitle>
          <DialogDescription>{t('features.messages.compose.searchDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <FormControlInput
              placeholder={t('features.messages.compose.searchUsersPlaceholder')}
              value={userSearchQuery}
              onChange={e => setUserSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  {userSearchQuery
                    ? t('features.messages.compose.noUsersFound')
                    : t('features.messages.compose.startTyping')}
                </p>
              </div>
            ) : (
              filteredUsers.map(searchUser => (
                <Button
                  key={searchUser.id}
                  type="button"
                  variant="ghost"
                  onClick={() => onUserSelect(searchUser.id)}
                  className="h-auto w-full justify-start gap-3 rounded-lg p-3 text-left whitespace-normal transition-colors"
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={searchUser.avatar ?? undefined} />
                    <AvatarFallback>
                      {searchUser.first_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {[searchUser.first_name, searchUser.last_name].filter(Boolean).join(' ') ||
                        t('common.labels.unspecifiedUser')}
                    </p>
                    {searchUser.handle && (
                      <p className="text-muted-foreground truncate text-sm">@{searchUser.handle}</p>
                    )}
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>
      </ScrollableDialogContent>
    </Dialog>
  );
}
