import { useInviteDialogController } from '../hooks/useInviteDialogController';
import type { Collaborator, Role } from '../hooks/useCollaborators';
import { InviteDialogView } from './InviteDialogView';

interface InviteDialogProps {
  amendmentId: string;
  existingCollaborators: Collaborator[];
  roles: Role[];
  onInviteUsers: (userIds: string[], amendmentId: string, roleId: string) => void | Promise<void>;
}

export function InviteDialog(props: InviteDialogProps) {
  return <InviteDialogView {...useInviteDialogController(props)} />;
}
