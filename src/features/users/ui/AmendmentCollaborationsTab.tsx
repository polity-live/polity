import { FileEdit } from 'lucide-react';
import { MembershipStatusTable } from './MembershipStatusTable';
import type { MembershipsByStatus } from '../hooks/useUserMembershipsFilters';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AmendmentCollaborationsTabProps {
  collaborationsByStatus: MembershipsByStatus;
  onAcceptInvitation: (id: string) => void;
  onDeclineInvitation: (id: string) => void;
  onLeave: (id: string) => void;
  onWithdrawRequest: (id: string) => void;
  userId: string;
  searchQuery: string;
}

export function AmendmentCollaborationsTab({
  collaborationsByStatus,
  onAcceptInvitation,
  onDeclineInvitation,
  onLeave,
  onWithdrawRequest,
  userId,
  searchQuery,
}: AmendmentCollaborationsTabProps) {
  return (
    <div className="space-y-6">
      <MembershipStatusTable
        title={translateText('pages.user.memberships.sections.pendingInvitations', {
          count: collaborationsByStatus.invited.length,
        })}
        description={translateText(
          'generated.inline.1183_amendment_collaboration_invitations_you_ve_re_733278ff'
        )}
        icon={FileEdit}
        items={collaborationsByStatus.invited}
        statusType="invited"
        entityKey="amendment"
        fallbackIcon={FileEdit}
        userId={userId}
        searchQuery={searchQuery}
        onAccept={onAcceptInvitation}
        onDecline={onDeclineInvitation}
      />

      <MembershipStatusTable
        title={translateText('pages.user.memberships.sections.activeCollaborations', {
          count: collaborationsByStatus.active.length,
        })}
        description={translateText(
          'generated.inline.1184_amendments_you_re_currently_collaborating_on_94c9c05b'
        )}
        icon={FileEdit}
        items={collaborationsByStatus.active}
        statusType="active"
        entityKey="amendment"
        fallbackIcon={FileEdit}
        userId={userId}
        searchQuery={searchQuery}
        onLeave={onLeave}
      />

      <MembershipStatusTable
        title={translateText('pages.user.memberships.sections.pendingRequests', {
          count: collaborationsByStatus.requested.length,
        })}
        description={translateText(
          'generated.inline.1185_your_pending_requests_to_collaborate_on_amend_55663da4'
        )}
        icon={FileEdit}
        items={collaborationsByStatus.requested}
        statusType="requested"
        entityKey="amendment"
        fallbackIcon={FileEdit}
        userId={userId}
        searchQuery={searchQuery}
        onWithdraw={onWithdrawRequest}
      />
    </div>
  );
}
