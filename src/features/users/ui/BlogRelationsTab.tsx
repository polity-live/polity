import { BookOpen } from 'lucide-react';
import { MembershipStatusTable } from './MembershipStatusTable';
import type { MembershipsByStatus } from '../hooks/useUserMembershipsFilters';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface BlogRelationsTabProps {
  blogRelationsByStatus: MembershipsByStatus;
  onAcceptInvitation: (id: string) => void;
  onDeclineInvitation: (id: string) => void;
  onLeave: (id: string) => void;
  onWithdrawRequest: (id: string) => void;
  getBlogHref: (id: string) => string;
}

export function BlogRelationsTab({
  blogRelationsByStatus,
  onAcceptInvitation,
  onDeclineInvitation,
  onLeave,
  onWithdrawRequest,
  getBlogHref,
}: BlogRelationsTabProps) {
  return (
    <div className="space-y-6">
      <MembershipStatusTable
        title={`Pending Invitations (${blogRelationsByStatus.invited.length})`}
        description={translateText(
          'generated.inline.1186_blog_invitations_you_ve_received_6a4d03e8'
        )}
        icon={BookOpen}
        items={blogRelationsByStatus.invited}
        statusType="invited"
        entityKey="blog"
        fallbackIcon={BookOpen}
        onAccept={onAcceptInvitation}
        onDecline={onDeclineInvitation}
        getEntityHref={entity => (entity?.id ? getBlogHref(entity.id) : null)}
      />

      <MembershipStatusTable
        title={`Active Blogs (${blogRelationsByStatus.active.length})`}
        description={translateText(
          'generated.inline.1187_blogs_you_re_currently_writing_for_69a83bab'
        )}
        icon={BookOpen}
        items={blogRelationsByStatus.active}
        statusType="active"
        entityKey="blog"
        fallbackIcon={BookOpen}
        onLeave={onLeave}
        getEntityHref={entity => (entity?.id ? getBlogHref(entity.id) : null)}
      />

      <MembershipStatusTable
        title={`Pending Requests (${blogRelationsByStatus.requested.length})`}
        description={translateText(
          'generated.inline.1188_your_pending_requests_to_write_for_blogs_b0f2d976'
        )}
        icon={BookOpen}
        items={blogRelationsByStatus.requested}
        statusType="requested"
        entityKey="blog"
        fallbackIcon={BookOpen}
        onWithdraw={onWithdrawRequest}
        getEntityHref={entity => (entity?.id ? getBlogHref(entity.id) : null)}
      />
    </div>
  );
}
