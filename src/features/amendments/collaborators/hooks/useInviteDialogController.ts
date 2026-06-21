import { useMemo, useState } from 'react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useActionSubmission } from '@/features/shared/ui/action-submission';
import { toast } from '@/features/shared/ui/ui/sonner';

import type { Collaborator, Role } from './useCollaborators';
import { useUserSearch } from './useUserSearch';

interface UseInviteDialogControllerProps {
  amendmentId: string;
  existingCollaborators: Collaborator[];
  roles: Role[];
  onInviteUsers: (userIds: string[], amendmentId: string, roleId: string) => void | Promise<void>;
}

export function useInviteDialogController({
  amendmentId,
  existingCollaborators = [],
  roles,
  onInviteUsers,
}: UseInviteDialogControllerProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const actionSubmission = useActionSubmission('invite');

  const existingCollaboratorIds = existingCollaborators
    .map(collaborator => collaborator.user?.id)
    .filter(Boolean) as string[];

  const { users, isLoading } = useUserSearch(existingCollaboratorIds);

  const typeaheadItems = useMemo(
    () =>
      toTypeaheadItems(
        users,
        'user',
        user => user.name || 'Unnamed User',
        user => (user.handle ? `@${user.handle}` : user.contactEmail),
        user => user.avatar,
        user => `/user/${user.id}`
      ),
    [users]
  );

  const handleInviteUsers = async () => {
    if (selectedUsers.length === 0) return;

    const collaboratorRole = roles.find(role => role.name === 'Collaborator');
    if (!collaboratorRole) {
      toast.error(translateText('generated.inline.0108_collaborator_role_not_found_4f7a7cfe'));
      return;
    }

    setIsInviting(true);
    void actionSubmission
      .runActionWithSubmission(
        async () => onInviteUsers(selectedUsers, amendmentId, collaboratorRole.id),
        {
          onSuccess: () => {
            setSelectedUsers([]);
            setIsInviting(false);
            actionSubmission.reset();
            setInviteDialogOpen(false);
          },
        }
      )
      .catch(error => {
        console.error('Failed to invite collaborators:', error);
        setIsInviting(false);
      });
  };

  return {
    actionSubmission,
    inviteDialogOpen,
    isInviting,
    isLoading,
    selectedUsers,
    typeaheadItems,
    onInviteDialogOpenChange: setInviteDialogOpen,
    onInviteUsersClick: handleInviteUsers,
    onSelectedUsersChange: setSelectedUsers,
  };
}
