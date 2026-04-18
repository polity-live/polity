import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUserMemberships } from '@/features/users/hooks/useUserMemberships'
import { useUserMembershipsFilters } from '@/features/users/hooks/useUserMembershipsFilters'
import { useUserData } from '@/features/users/hooks/useUserData'
import { GroupMembershipsTab } from '@/features/users/ui/GroupMembershipsTab'
import { EventParticipationsTab } from '@/features/users/ui/EventParticipationsTab'
import { AmendmentCollaborationsTab } from '@/features/users/ui/AmendmentCollaborationsTab'
import { BlogRelationsTab } from '@/features/users/ui/BlogRelationsTab'
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs'
import { ScrollableTabsList } from '@/features/shared/ui/ui/scrollable-tabs'
import { EntitySearchBar } from '@/features/shared/ui/ui/entity-search-bar'
import { Users, Calendar, FileEdit, BookOpen } from 'lucide-react'

export const Route = createFileRoute('/_authed/user/$id/memberships')({
  component: UserMembershipsPage,
})

function UserMembershipsPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { user } = useUserData(id)
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || ''

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
  } = useUserMemberships(id, userName)

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
  } = useUserMembershipsFilters({ memberships, participations, collaborations, blogRelations })

  const allMembershipCount =
    filteredMemberships.length +
    filteredParticipations.length +
    filteredCollaborations.length +
    filteredBlogRelations.length

  const handleLeaveGroup = (membershipId: string) => {
    const membership = memberships.find((item) => item.id === membershipId)
    if (membership) {
      leaveGroup(membershipId, membership.group?.id || '')
    }
  }

  const handleLeaveEvent = (participationId: string) => {
    const participation = participations.find((item) => item.id === participationId)
    if (participation) {
      withdrawFromEvent(participationId, participation.event?.id || '')
    }
  }

  const handleLeaveCollaboration = (collaborationId: string) => {
    const collaboration = collaborations.find((item) => item.id === collaborationId)
    if (collaboration) {
      leaveCollaboration(collaborationId, collaboration.amendment?.id || '')
    }
  }

  const renderGroupMembershipsTab = () => (
    <GroupMembershipsTab
      membershipsByStatus={membershipsByStatus}
      onAcceptInvitation={acceptGroupInvitation}
      onDeclineInvitation={declineGroupInvitation}
      onLeave={handleLeaveGroup}
      onWithdrawRequest={withdrawGroupRequest}
      onNavigate={(groupId) => navigate({ to: `/group/${groupId}` })}
    />
  )

  const renderEventParticipationsTab = () => (
    <EventParticipationsTab
      participationsByStatus={participationsByStatus}
      onAcceptInvitation={acceptEventInvitation}
      onDeclineInvitation={declineEventInvitation}
      onLeave={handleLeaveEvent}
      onWithdrawRequest={withdrawEventRequest}
      onNavigate={(eventId) => navigate({ to: `/event/${eventId}` })}
    />
  )

  const renderAmendmentCollaborationsTab = () => (
    <AmendmentCollaborationsTab
      collaborationsByStatus={collaborationsByStatus}
      onAcceptInvitation={acceptCollaborationInvitation}
      onDeclineInvitation={declineCollaborationInvitation}
      onLeave={handleLeaveCollaboration}
      onWithdrawRequest={withdrawCollaborationRequest}
      onNavigate={(amendmentId) => navigate({ to: `/amendment/${amendmentId}` })}
    />
  )

  const renderBlogRelationsTab = () => (
    <BlogRelationsTab
      blogRelationsByStatus={blogRelationsByStatus}
      onAcceptInvitation={acceptBlogInvitation}
      onDeclineInvitation={declineBlogInvitation}
      onLeave={leaveBlog}
      onWithdrawRequest={withdrawBlogRequest}
      onNavigate={(blogId) => navigate({ to: '/user/$id/blog/$entryId', params: { id, entryId: blogId } })}
    />
  )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Memberships</h1>
      <EntitySearchBar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        placeholder="Search memberships..."
      />
      <Tabs defaultValue="all">
        <ScrollableTabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            All ({allMembershipCount})
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Groups ({filteredMemberships.length})
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Events ({filteredParticipations.length})
          </TabsTrigger>
          <TabsTrigger value="amendments" className="flex items-center gap-2">
            <FileEdit className="h-4 w-4" />
            Amendments ({filteredCollaborations.length})
          </TabsTrigger>
          <TabsTrigger value="blogs" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Blogs ({filteredBlogRelations.length})
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="all">
          <div className="space-y-6">
            {renderGroupMembershipsTab()}
            {renderEventParticipationsTab()}
            {renderAmendmentCollaborationsTab()}
            {renderBlogRelationsTab()}
          </div>
        </TabsContent>

        <TabsContent value="groups">
          {renderGroupMembershipsTab()}
        </TabsContent>

        <TabsContent value="events">
          {renderEventParticipationsTab()}
        </TabsContent>

        <TabsContent value="amendments">
          {renderAmendmentCollaborationsTab()}
        </TabsContent>

        <TabsContent value="blogs">
          {renderBlogRelationsTab()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
