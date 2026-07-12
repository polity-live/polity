import { UserPlus } from 'lucide-react';

import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  ActionSubmissionOverlay,
  type ActionSubmissionController,
} from '@/features/shared/ui/action-submission';
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
  actionSubmission: ActionSubmissionController;
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
  actionSubmission,
  inviteDialogOpen,
  isInviting,
  isLoading,
  selectedUsers,
  typeaheadItems,
  onInviteDialogOpenChange,
  onInviteUsersClick,
  onSelectedUsersChange,
}: InviteDialogViewProps) {
  const submissionActive = actionSubmission.isActive;
  const selectedPeople = (typeaheadItems ?? [])
    .filter(item => selectedUsers.includes(item.id))
    .map(item => ({
      id: item.id,
      name: item.label,
      avatar: item.avatar,
    }));

  return (
    <Dialog open={inviteDialogOpen} onOpenChange={onInviteDialogOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0109_invite_collaborator_aea80de5')}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent
        management={!submissionActive}
        showCloseButton={!submissionActive}
        className={
          submissionActive
            ? 'h-dvh max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none'
            : 'h-[min(680px,calc(100dvh-2rem))] sm:max-w-[500px]'
        }
      >
        {!submissionActive ? (
          <>
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
                <SectionSkeleton rows={3} density="compact" />
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
              <Button
                onClick={onInviteUsersClick}
                disabled={selectedUsers.length === 0 || isInviting}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {translateText('generated.inline.0114_invite_b136609f')}
                {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
              </Button>
            </DialogFooter>
          </>
        ) : null}
        <ActionSubmissionOverlay
          kind="invite"
          status={actionSubmission.status}
          steps={actionSubmission.progressSteps}
          error={actionSubmission.error}
          preview={{
            entityLabel: translateText('generated.inline.0109_invite_collaborator_aea80de5'),
            title: translateText('generated.inline.0110_invite_collaborators_b801b9cc'),
            description: translateText(
              'generated.inline.0111_search_and_select_users_to_invite_to_collabor_eeb25776'
            ),
            people: selectedPeople,
            badges: ['Collaborator'],
          }}
          target={{
            label: translateText('common.done', 'Fertig'),
            onClick: actionSubmission.reset,
          }}
          onBack={actionSubmission.reset}
          onRetry={() => void actionSubmission.retry()}
        />
      </ScrollableDialogContent>
    </Dialog>
  );
}
