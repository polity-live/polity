import { Button } from '@/features/shared/ui/ui/button';
import { UserPlus, UserMinus, Clock, Check } from 'lucide-react';
import { ParticipationStatus } from '../hooks/useEventParticipation';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface EventParticipationButtonProps {
  status: ParticipationStatus | null;
  isParticipant: boolean;
  hasRequested: boolean;
  isInvited: boolean;
  onRequestParticipation: () => void;
  onLeave: () => void;
  onAcceptInvitation: () => void;
  isLoading: boolean;
}

export function EventParticipationButton({
  isParticipant,
  hasRequested,
  isInvited,
  onRequestParticipation,
  onLeave,
  onAcceptInvitation,
  isLoading,
}: EventParticipationButtonProps) {
  if (isInvited) {
    return (
      <Button
        data-action-id="events.participation.accept-invitation"
        onClick={onAcceptInvitation}
        disabled={isLoading}
        variant="default"
      >
        <Check className="mr-2 h-4 w-4" />
        {translateText('generated.inline.0165_accept_invitation_f41d2aa6')}
      </Button>
    );
  }

  if (hasRequested) {
    return (
      <Button
        data-action-id="events.participation.cancel-request"
        onClick={onLeave}
        disabled={isLoading}
        variant="outline"
      >
        <Clock className="mr-2 h-4 w-4" />
        {translateText('generated.inline.0166_request_pending_cdab22cf')}
      </Button>
    );
  }

  if (isParticipant) {
    return (
      <Button
        data-action-id="events.participation.leave"
        onClick={onLeave}
        disabled={isLoading}
        variant="outline"
      >
        <UserMinus className="mr-2 h-4 w-4" />
        {translateText('generated.inline.0517_leave_event_dd3851a6')}
      </Button>
    );
  }

  return (
    <Button
      data-action-id="events.participation.request"
      onClick={onRequestParticipation}
      disabled={isLoading}
    >
      <UserPlus className="mr-2 h-4 w-4" />
      {translateText('generated.inline.0518_request_to_participate_6a191730')}
    </Button>
  );
}
