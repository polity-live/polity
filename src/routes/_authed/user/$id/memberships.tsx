import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { createFileRoute } from '@tanstack/react-router';
import { useUserMemberships } from '@/features/users/hooks/useUserMemberships';
import { useUserMembershipsFilters } from '@/features/users/hooks/useUserMembershipsFilters';
import { useUserData } from '@/features/users/hooks/useUserData';
import { GroupMembershipsTab } from '@/features/users/ui/GroupMembershipsTab';
import { EventParticipationsTab } from '@/features/users/ui/EventParticipationsTab';
import { AmendmentCollaborationsTab } from '@/features/users/ui/AmendmentCollaborationsTab';
import { BlogRelationsTab } from '@/features/users/ui/BlogRelationsTab';
import { TabsContent } from '@/features/shared/ui/ui/tabs';
import { EntitySearchBar } from '@/features/shared/ui/ui/entity-search-bar';
import { Users, Calendar, FileEdit, BookOpen } from 'lucide-react';
import { z } from 'zod';
import {
  ManagementToolbar,
  SettingsPage,
  SettingsTabs,
  type SettingsTab,
} from '@/features/shared/ui/form';
import { CountBadge } from '@/features/shared/ui/status';

export const membershipsSearchSchema = z.object({
  tab: z.enum(['all', 'groups', 'events', 'amendments', 'blogs']).catch('all').optional(),
});

export const Route = createFileRoute('/_authed/user/$id/memberships')({
  validateSearch: membershipsSearchSchema,
  component: UserMembershipsPage,
});

function UserMembershipsPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useUserData(id);
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

  const {
    memberships,
    participations,
    collaborations,
    blogRelations,
    leaveGroup,
    acceptGroupInvitation,
    declineGroupInvitation,
    withdrawGroupRequest,
    withdrawFromEvent,
    acceptEventInvitation,
    declineEventInvitation,
    withdrawEventRequest,
    leaveCollaboration,
    acceptCollaborationInvitation,
    declineCollaborationInvitation,
    withdrawCollaborationRequest,
    leaveBlog,
    acceptBlogInvitation,
    declineBlogInvitation,
    withdrawBlogRequest,
  } = useUserMemberships(id, userName);

  const {
    searchQuery,
    setSearchQuery,
    membershipsByStatus,
    participationsByStatus,
    collaborationsByStatus,
    blogRelationsByStatus,
    filteredMemberships,
    filteredParticipations,
    filteredCollaborations,
    filteredBlogRelations,
  } = useUserMembershipsFilters({ memberships, participations, collaborations, blogRelations });

  const allMembershipCount =
    filteredMemberships.length +
    filteredParticipations.length +
    filteredCollaborations.length +
    filteredBlogRelations.length;
  const activeTab = tab ?? 'all';
  const tabs: SettingsTab<typeof activeTab>[] = [
    {
      value: 'all',
      label: (
        <span className="flex items-center gap-2">
          {translateText('pages.user.memberships.tabs.all')}
          <CountBadge count={allMembershipCount} />
        </span>
      ),
    },
    {
      value: 'groups',
      label: (
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {translateText('pages.user.memberships.tabs.groups')}
          <CountBadge count={filteredMemberships.length} />
        </span>
      ),
    },
    {
      value: 'events',
      label: (
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {translateText('pages.user.memberships.tabs.events')}
          <CountBadge count={filteredParticipations.length} />
        </span>
      ),
    },
    {
      value: 'amendments',
      label: (
        <span className="flex items-center gap-2">
          <FileEdit className="h-4 w-4" />
          {translateText('pages.user.memberships.tabs.amendments')}
          <CountBadge count={filteredCollaborations.length} />
        </span>
      ),
    },
    {
      value: 'blogs',
      label: (
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          {translateText('pages.user.memberships.tabs.blogs')}
          <CountBadge count={filteredBlogRelations.length} />
        </span>
      ),
    },
  ];

  const handleLeaveGroup = (membershipId: string) => {
    leaveGroup(membershipId);
  };

  const handleLeaveEvent = (participationId: string) => {
    withdrawFromEvent(participationId);
  };

  const handleLeaveCollaboration = (collaborationId: string) => {
    leaveCollaboration(collaborationId);
  };

  const renderGroupMembershipsTab = () => (
    <GroupMembershipsTab
      membershipsByStatus={membershipsByStatus}
      onAcceptInvitation={acceptGroupInvitation}
      onDeclineInvitation={declineGroupInvitation}
      onLeave={handleLeaveGroup}
      onWithdrawRequest={withdrawGroupRequest}
    />
  );

  const renderEventParticipationsTab = () => (
    <EventParticipationsTab
      participationsByStatus={participationsByStatus}
      onAcceptInvitation={acceptEventInvitation}
      onDeclineInvitation={declineEventInvitation}
      onLeave={handleLeaveEvent}
      onWithdrawRequest={withdrawEventRequest}
    />
  );

  const renderAmendmentCollaborationsTab = () => (
    <AmendmentCollaborationsTab
      collaborationsByStatus={collaborationsByStatus}
      onAcceptInvitation={acceptCollaborationInvitation}
      onDeclineInvitation={declineCollaborationInvitation}
      onLeave={handleLeaveCollaboration}
      onWithdrawRequest={withdrawCollaborationRequest}
    />
  );

  const renderBlogRelationsTab = () => (
    <BlogRelationsTab
      blogRelationsByStatus={blogRelationsByStatus}
      onAcceptInvitation={acceptBlogInvitation}
      onDeclineInvitation={declineBlogInvitation}
      onLeave={leaveBlog}
      onWithdrawRequest={withdrawBlogRequest}
      getBlogHref={blogId => `/user/${id}/blog/${blogId}`}
    />
  );

  return (
    <SettingsPage
      title={translateText('pages.user.memberships.title')}
      description={translateText('pages.user.memberships.description')}
      size="wide"
      headingMode="sr-only"
    >
      <SettingsTabs
        tabs={tabs}
        value={activeTab}
        onValueChange={nextTab =>
          navigate({ search: previous => ({ ...previous, tab: nextTab }), replace: true })
        }
      >
        <ManagementToolbar>
          <EntitySearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            placeholder={translateText('generated.inline.1270_search_memberships_e98729da')}
            className="flex-1"
          />
        </ManagementToolbar>
        <TabsContent value="all">
          <div className="space-y-6">
            {renderGroupMembershipsTab()}
            {renderEventParticipationsTab()}
            {renderAmendmentCollaborationsTab()}
            {renderBlogRelationsTab()}
          </div>
        </TabsContent>

        <TabsContent value="groups">{renderGroupMembershipsTab()}</TabsContent>

        <TabsContent value="events">{renderEventParticipationsTab()}</TabsContent>

        <TabsContent value="amendments">{renderAmendmentCollaborationsTab()}</TabsContent>

        <TabsContent value="blogs">{renderBlogRelationsTab()}</TabsContent>
      </SettingsTabs>
    </SettingsPage>
  );
}
