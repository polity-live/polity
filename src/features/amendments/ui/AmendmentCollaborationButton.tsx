import { Button } from '@/features/shared/ui/ui/button';
import { UserPlus, UserMinus, Clock, Check } from 'lucide-react';
import { CollaborationStatus } from '../hooks/useAmendmentCollaboration';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AmendmentCollaborationButtonProps {
  status: CollaborationStatus | null;
  isCollaborator: boolean;
  hasRequested: boolean;
  isInvited: boolean;
  onRequestCollaboration: () => void;
  onLeave: () => void;
  onAcceptInvitation: () => void;
  isLoading: boolean;
}

export function AmendmentCollaborationButton({
  isCollaborator,
  hasRequested,
  isInvited,
  onRequestCollaboration,
  onLeave,
  onAcceptInvitation,
  isLoading,
}: AmendmentCollaborationButtonProps) {
  if (isInvited) {
    return (
      <Button onClick={onAcceptInvitation} disabled={isLoading} variant="default">
        <Check className="mr-2 h-4 w-4" />
        {translateText('generated.inline.0165_accept_invitation_f41d2aa6')}
      </Button>
    );
  }

  if (hasRequested) {
    return (
      <Button onClick={onLeave} disabled={isLoading} variant="outline">
        <Clock className="mr-2 h-4 w-4" />
        {translateText('generated.inline.0166_request_pending_cdab22cf')}
      </Button>
    );
  }

  if (isCollaborator) {
    return (
      <Button onClick={onLeave} disabled={isLoading} variant="outline">
        <UserMinus className="mr-2 h-4 w-4" />
        {translateText('generated.inline.0167_leave_collaboration_183024a6')}
      </Button>
    );
  }

  return (
    <Button onClick={onRequestCollaboration} disabled={isLoading}>
      <UserPlus className="mr-2 h-4 w-4" />
      {translateText('generated.inline.0168_request_to_collaborate_4d4f2e47')}
    </Button>
  );
}
