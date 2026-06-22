import { Calendar } from 'lucide-react';
import { MembershipStatusTable } from './MembershipStatusTable';
import type { MembershipsByStatus } from '../hooks/useUserMembershipsFilters';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface EventParticipationsTabProps {
  participationsByStatus: MembershipsByStatus;
  onAcceptInvitation: (id: string) => void;
  onDeclineInvitation: (id: string) => void;
  onLeave: (id: string) => void;
  onWithdrawRequest: (id: string) => void;
}

export function EventParticipationsTab({
  participationsByStatus,
  onAcceptInvitation,
  onDeclineInvitation,
  onLeave,
  onWithdrawRequest,
}: EventParticipationsTabProps) {
  return (
    <div className="space-y-6">
      <MembershipStatusTable
        title={translateText('pages.user.memberships.sections.pendingInvitations', {
          count: participationsByStatus.invited.length,
        })}
        description={translateText(
          'generated.inline.1189_event_invitations_you_ve_received_984bbca0'
        )}
        icon={Calendar}
        items={participationsByStatus.invited}
        statusType="invited"
        entityKey="event"
        fallbackIcon={Calendar}
        onAccept={onAcceptInvitation}
        onDecline={onDeclineInvitation}
      />

      <MembershipStatusTable
        title={translateText('pages.user.memberships.sections.activeParticipations', {
          count: participationsByStatus.active.length,
        })}
        description={translateText(
          'generated.inline.1190_events_you_re_currently_participating_in_709d8ac2'
        )}
        icon={Calendar}
        items={participationsByStatus.active}
        statusType="active"
        entityKey="event"
        fallbackIcon={Calendar}
        onLeave={onLeave}
      />

      <MembershipStatusTable
        title={translateText('pages.user.memberships.sections.pendingRequests', {
          count: participationsByStatus.requested.length,
        })}
        description={translateText(
          'generated.inline.1191_your_pending_requests_to_join_events_935cc392'
        )}
        icon={Calendar}
        items={participationsByStatus.requested}
        statusType="requested"
        entityKey="event"
        fallbackIcon={Calendar}
        onWithdraw={onWithdrawRequest}
      />
    </div>
  );
}
