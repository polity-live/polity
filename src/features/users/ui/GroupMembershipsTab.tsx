import { Users } from 'lucide-react';
import { MembershipStatusTable } from './MembershipStatusTable';
import type { MembershipsByStatus } from '../hooks/useUserMembershipsFilters';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface GroupMembershipsTabProps {
  membershipsByStatus: MembershipsByStatus;
  onAcceptInvitation: (id: string) => void;
  onDeclineInvitation: (id: string) => void;
  onLeave: (id: string) => void;
  onWithdrawRequest: (id: string) => void;
}

export function GroupMembershipsTab({
  membershipsByStatus,
  onAcceptInvitation,
  onDeclineInvitation,
  onLeave,
  onWithdrawRequest,
}: GroupMembershipsTabProps) {
  return (
    <div className="space-y-6">
      <MembershipStatusTable
        title={`Pending Invitations (${membershipsByStatus.invited.length})`}
        description={translateText(
          'generated.inline.1192_group_invitations_you_ve_received_39d8159e'
        )}
        icon={Users}
        items={membershipsByStatus.invited}
        statusType="invited"
        entityKey="group"
        fallbackIcon={Users}
        onAccept={onAcceptInvitation}
        onDecline={onDeclineInvitation}
        getAcceptPreflightInput={membership => ({
          kind: 'membership_activation',
          membership_id: membership.id,
        })}
      />

      <MembershipStatusTable
        title={`Active Memberships (${membershipsByStatus.active.length})`}
        description={translateText(
          'generated.inline.1193_groups_you_re_currently_a_member_of_6c478da9'
        )}
        icon={Users}
        items={membershipsByStatus.active}
        statusType="active"
        entityKey="group"
        fallbackIcon={Users}
        onLeave={onLeave}
      />

      <MembershipStatusTable
        title={`Pending Requests (${membershipsByStatus.requested.length})`}
        description={translateText(
          'generated.inline.1194_your_pending_requests_to_join_groups_8c9f7a5b'
        )}
        icon={Users}
        items={membershipsByStatus.requested}
        statusType="requested"
        entityKey="group"
        fallbackIcon={Users}
        onWithdraw={onWithdrawRequest}
      />
    </div>
  );
}
