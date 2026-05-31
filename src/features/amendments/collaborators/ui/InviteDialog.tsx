/**
 * Dialog for inviting collaborators
 */

import { useMemo, useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { UserPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { toast } from 'sonner';
import { useUserSearch } from '../hooks/useUserSearch';
import type { Collaborator, Role } from '../hooks/useCollaborators';

interface InviteDialogProps {
  amendmentId: string;
  existingCollaborators: Collaborator[];
  roles: Role[];
  onInviteUsers: (userIds: string[], amendmentId: string, roleId: string) => Promise<void>;
}

export function InviteDialog({
  amendmentId,
  existingCollaborators,
  roles,
  onInviteUsers,
}: InviteDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Get existing collaborator IDs to exclude from search
  const existingCollaboratorIds = existingCollaborators
    .map(c => c.user?.id)
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

    // Find the Collaborator role
    const collaboratorRole = roles.find(r => r.name === 'Collaborator');
    if (!collaboratorRole) {
      toast.error('Collaborator role not found');
      return;
    }

    setIsInviting(true);
    try {
      await onInviteUsers(selectedUsers, amendmentId, collaboratorRole.id);

      // Reset state
      setSelectedUsers([]);
      setInviteDialogOpen(false);
    } catch (error) {
      console.error('Failed to invite collaborators:', error);
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Collaborator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Collaborators</DialogTitle>
          <DialogDescription>
            Search and select users to invite to collaborate on this amendment. They will receive an
            invitation to join.
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
              onValuesChange={setSelectedUsers}
              placeholder="Search by name, handle, or email..."
              disablePortal
            />
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setInviteDialogOpen(false)}
            disabled={isInviting}
          >
            Cancel
          </Button>
          <Button onClick={handleInviteUsers} disabled={selectedUsers.length === 0 || isInviting}>
            {isInviting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
