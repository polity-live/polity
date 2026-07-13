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
  userId: string;
  searchQuery: string;
}

export function BlogRelationsTab({
  blogRelationsByStatus,
  onAcceptInvitation,
  onDeclineInvitation,
  onLeave,
  onWithdrawRequest,
  getBlogHref,
  userId,
  searchQuery,
}: BlogRelationsTabProps) {
  return (
    <div className="space-y-6">
      <MembershipStatusTable
        title={translateText('pages.user.memberships.sections.pendingInvitations', {
          count: blogRelationsByStatus.invited.length,
        })}
        description={translateText(
          'generated.inline.1186_blog_invitations_you_ve_received_6a4d03e8'
        )}
        icon={BookOpen}
        items={blogRelationsByStatus.invited}
        statusType="invited"
        entityKey="blog"
        fallbackIcon={BookOpen}
        userId={userId}
        searchQuery={searchQuery}
        onAccept={onAcceptInvitation}
        onDecline={onDeclineInvitation}
        getEntityHref={entity => (entity?.id ? getBlogHref(entity.id) : null)}
      />

      <MembershipStatusTable
        title={translateText('pages.user.memberships.sections.activeBlogs', {
          count: blogRelationsByStatus.active.length,
        })}
        description={translateText(
          'generated.inline.1187_blogs_you_re_currently_writing_for_69a83bab'
        )}
        icon={BookOpen}
        items={blogRelationsByStatus.active}
        statusType="active"
        entityKey="blog"
        fallbackIcon={BookOpen}
        userId={userId}
        searchQuery={searchQuery}
        onLeave={onLeave}
        getEntityHref={entity => (entity?.id ? getBlogHref(entity.id) : null)}
      />

      <MembershipStatusTable
        title={translateText('pages.user.memberships.sections.pendingRequests', {
          count: blogRelationsByStatus.requested.length,
        })}
        description={translateText(
          'generated.inline.1188_your_pending_requests_to_write_for_blogs_b0f2d976'
        )}
        icon={BookOpen}
        items={blogRelationsByStatus.requested}
        statusType="requested"
        entityKey="blog"
        fallbackIcon={BookOpen}
        userId={userId}
        searchQuery={searchQuery}
        onWithdraw={onWithdrawRequest}
        getEntityHref={entity => (entity?.id ? getBlogHref(entity.id) : null)}
      />
    </div>
  );
}
