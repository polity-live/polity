import { Search } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { FormControlInput } from '@/features/shared/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import type { useNewConversationDialogController } from '../hooks/useNewConversationDialogController';

type FilteredUser = ReturnType<typeof useNewConversationDialogController>['filteredUsers'][number];

interface NewConversationDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserSelect: (userId: string) => void;
  userSearchQuery: string;
  onUserSearchQueryChange: (query: string) => void;
  filteredUsers: FilteredUser[];
  isTargetedSearch: boolean;
}

export function NewConversationDialogView({
  open,
  onOpenChange,
  onUserSelect,
  userSearchQuery,
  onUserSearchQueryChange,
  filteredUsers,
  isTargetedSearch,
}: NewConversationDialogViewProps) {
  const { t } = useTranslation();

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
              onChange={event => onUserSearchQueryChange(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  {isTargetedSearch || userSearchQuery
                    ? t('features.messages.compose.noUsersFound')
                    : t('features.messages.compose.startTyping')}
                </p>
              </div>
            ) : (
              filteredUsers.map((searchUser: any) => (
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
