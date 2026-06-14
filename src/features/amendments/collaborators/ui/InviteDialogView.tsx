import { Loader2, UserPlus } from 'lucide-react';

import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';

interface InviteDialogViewProps {
  inviteDialogOpen: boolean;
  isInviting: boolean;
  isLoading: boolean;
  selectedUsers: string[];
  typeaheadItems: React.ComponentProps<typeof TypeaheadSearch>['items'];
  onInviteDialogOpenChange: (open: boolean) => void;
  onInviteUsersClick: () => void;
  onSelectedUsersChange: (userIds: string[]) => void;
}

export function InviteDialogView({
  inviteDialogOpen,
  isInviting,
  isLoading,
  selectedUsers,
  typeaheadItems,
  onInviteDialogOpenChange,
  onInviteUsersClick,
  onSelectedUsersChange,
}: InviteDialogViewProps) {
  return (
    <Dialog open={inviteDialogOpen} onOpenChange={onInviteDialogOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0109_invite_collaborator_aea80de5')}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {translateText('generated.inline.0110_invite_collaborators_b801b9cc')}
          </DialogTitle>
          <DialogDescription>
            {translateText(
              'generated.inline.0111_search_and_select_users_to_invite_to_collabor_eeb25776'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
            <TypeaheadSearch
              items={typeaheadItems}
              multiple
              values={selectedUsers}
              onValuesChange={onSelectedUsersChange}
              placeholder={translateText(
                'generated.inline.0112_search_by_name_handle_or_email_9cdde6ce'
              )}
              disablePortal
            />
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onInviteDialogOpenChange(false)}
            disabled={isInviting}
          >
            {translateText('generated.inline.0065_cancel_77dfd213')}
          </Button>
          <Button onClick={onInviteUsersClick} disabled={selectedUsers.length === 0 || isInviting}>
            {isInviting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {translateText('generated.inline.0113_inviting_dc7a6e8b')}
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                {translateText('generated.inline.0114_invite_b136609f')}
                {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
