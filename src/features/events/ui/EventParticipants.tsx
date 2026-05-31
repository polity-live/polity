import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import {
  useEventData,
  useEventParticipants as useEventParticipantsData,
} from '../hooks/useEventData';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAccessRoles } from '@/zero/events/useEventState';
import { Button } from '@/features/shared/ui/ui/button';
import { EntitySearchBar } from '@/features/shared/ui/ui/entity-search-bar';
import { MembershipTabs } from '@/features/groups/ui/MembershipTabs';
import { ActiveMembersTable } from '@/features/groups/ui/ActiveMembersTable';
import { MembershipsByRoleTables } from '@/features/groups/ui/MembershipsByRoleTables';
import { MembershipCompositionPanel } from '@/features/groups/ui/MembershipCompositionPanel';
import { PendingRequestsTable } from '@/features/groups/ui/PendingRequestsTable';
import { PendingInvitationsTable } from '@/features/groups/ui/PendingInvitationsTable';
import { InviteMembersDialog } from '@/features/groups/ui/InviteMembersDialog';
import { ChangeRoleDialog } from '@/features/groups/ui/ChangeRoleDialog';
import { MemberRightsDialog } from '@/features/groups/ui/MemberRightsDialog';
import { EventRoles } from '@/features/roles/ui/EventRoles';
import { useMembershipSearch } from '@/features/groups/hooks/useMembershipSearch';
import { getMembershipDisplayRoles } from '@/features/groups/logic/buildMembershipRightsSummary';
import type {
  MembershipSort,
  MembershipSortField,
  MembershipTab,
} from '@/features/groups/types/group.types';
import { EVENT_ACTION_RIGHTS } from '@/zero/rbac/constants';
import { useDelegateAssemblyParticipantsComposition } from '../hooks/useDelegateAssemblyParticipantsComposition';

type EventParticipantRow = ReturnType<typeof useEventParticipantsData>['participants'][number];

export function EventParticipants({
  eventId,
  defaultTab = 'membershipsByUser',
}: {
  eventId: string;
  defaultTab?: MembershipTab;
}) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { event, isLoading, error } = useEventData(eventId);
  const { participants } = useEventParticipantsData(eventId);
  const { roles: accessRoles } = useEventAccessRoles(eventId);
  const {
    inviteParticipants,
    approveParticipation,
    rejectParticipation,
    removeParticipant,
    changeParticipantRoles,
  } = useEventMutations(eventId);

  const [activeTab, setActiveTab] = useState<MembershipTab>(defaultTab);
  const [membershipSort, setMembershipSort] = useState<MembershipSort>({
    field: 'user',
    direction: 'asc',
  });
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedInviteRoleIds, setSelectedInviteRoleIds] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [changeRoleMembership, setChangeRoleMembership] = useState<EventParticipantRow | null>(
    null
  );
  const [memberRightsOpen, setMemberRightsOpen] = useState(false);
  const [memberRightsMembership, setMemberRightsMembership] = useState<EventParticipantRow | null>(
    null
  );

  const {
    activeMembers: activeParticipants,
    pendingRequests,
    pendingInvitations,
  } = useMembershipSearch(participants, participantSearchQuery, membershipSort, {
    activeStatuses: ['active', 'member', 'admin', 'confirmed'],
    activeRoleNames: ['Organizer'],
  });
  const {
    showComposition,
    participantsWithProvenance,
    compositionBuckets,
    isLoading: compositionIsLoading,
  } = useDelegateAssemblyParticipantsComposition(event, activeParticipants);
  const activeParticipantsForTables = showComposition
    ? participantsWithProvenance
    : activeParticipants;

  useEffect(() => {
    if (activeTab === 'composition' && !showComposition) {
      setActiveTab('membershipsByUser');
    }
  }, [activeTab, showComposition]);

  const existingParticipantIds = Array.from(
    new Set(
      participants
        .map(participant => participant.user?.id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const eventTitle = event?.title || 'Event';

  const handleParticipantSortChange = (field: MembershipSortField) => {
    setMembershipSort(currentSort => {
      if (currentSort.field === field) {
        return {
          field,
          direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        field,
        direction: 'asc',
      };
    });
  };

  const handleInvite = async () => {
    if (selectedUserIds.length === 0) return;

    setIsInviting(true);
    try {
      await inviteParticipants(
        selectedUserIds,
        selectedInviteRoleIds,
        authUser?.id ?? undefined,
        eventTitle
      );
      setSelectedUserIds([]);
      setSelectedInviteRoleIds([]);
      setInviteOpen(false);
    } finally {
      setIsInviting(false);
    }
  };

  const handleOpenChangeRoleDialog = (membership: EventParticipantRow) => {
    setChangeRoleMembership(membership);
    setChangeRoleOpen(true);
  };

  const handleConfirmRoleChange = async (newRoleIds: string[]) => {
    if (!changeRoleMembership) return;

    const userId = changeRoleMembership.user?.id;

    await changeParticipantRoles(
      changeRoleMembership.id,
      newRoleIds,
      userId,
      authUser?.id ?? undefined,
      eventTitle
    );
  };

  const handleRemoveRoleFromParticipantTypeView = async (
    membership: EventParticipantRow,
    roleId: string
  ) => {
    const userId = membership.user?.id;

    const nextRoleIds = getMembershipDisplayRoles(membership)
      .filter(role => role.id !== roleId)
      .map(role => role.id);

    await changeParticipantRoles(
      membership.id,
      nextRoleIds,
      userId,
      authUser?.id ?? undefined,
      eventTitle
    );
  };

  if (isLoading) {
    return <div>Loading event participants...</div>;
  }

  if (error || !event) {
    return <div>Event not found.</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate({ to: '..' })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Event Participants</h1>
        <p className="text-muted-foreground">{eventTitle}</p>
      </div>

      {activeTab !== 'roles' && activeTab !== 'composition' ? (
        <EntitySearchBar
          searchQuery={participantSearchQuery}
          onSearchQueryChange={setParticipantSearchQuery}
          placeholder="Search participants..."
          className="mb-4"
        />
      ) : null}

      <MembershipTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        membershipsByUserLabel="Participants by user"
        membershipsByRoleLabel="Participants by role"
        tabBarAction={
          activeTab !== 'roles' ? (
            <InviteMembersDialog
              isOpen={inviteOpen}
              onOpenChange={setInviteOpen}
              selectedUsers={selectedUserIds}
              onSelectedUsersChange={setSelectedUserIds}
              excludeUserIds={existingParticipantIds}
              excludeUserId={authUser?.id}
              roles={[...accessRoles]}
              selectedRoleIds={selectedInviteRoleIds}
              onSelectedRoleIdsChange={setSelectedInviteRoleIds}
              onInvite={handleInvite}
              isInviting={isInviting}
              triggerLabel="Invite Participant"
              dialogTitle="Invite Participants"
              dialogDescription="Search and select users to invite to this event, then choose which roles they should start with."
              roleSectionTitle="Participant roles"
              roleSectionDescription="Tick one or more roles for invited participants. The default invite role is preselected."
              defaultRoleFallbackName="Participant"
              emptyRolesLabel="Create an event role first before inviting participants."
            />
          ) : null
        }
        membershipsByUserContent={
          <div className="space-y-4">
            <PendingRequestsTable
              requests={pendingRequests}
              onApprove={(membershipId, userId) =>
                approveParticipation(membershipId, userId, authUser?.id ?? undefined, eventTitle)
              }
              onReject={(membershipId, userId) =>
                rejectParticipation(membershipId, userId, authUser?.id ?? undefined, eventTitle)
              }
              title="Pending Participation Requests"
              description="Review and approve participation requests"
              fallbackRoleLabel="Participant"
            />
            <PendingInvitationsTable
              invitations={pendingInvitations}
              onWithdraw={(membershipId, userId) =>
                rejectParticipation(membershipId, userId, authUser?.id ?? undefined, eventTitle)
              }
              description="Users who have been invited to this event but have not accepted yet"
              fallbackRoleLabel="Participant"
            />
            <ActiveMembersTable
              members={activeParticipantsForTables}
              sort={membershipSort}
              onSortChange={handleParticipantSortChange}
              onOpenRightsDialog={membership => {
                setMemberRightsMembership(membership);
                setMemberRightsOpen(true);
              }}
              onOpenChangeRoleDialog={handleOpenChangeRoleDialog}
              onRemove={(membershipId, userId) =>
                removeParticipant(membershipId, userId, authUser?.id ?? undefined, eventTitle)
              }
              title="Active Participants"
              description="Current event participants and organizers"
              fallbackRoleLabel="Participant"
              showProvenanceColumns={showComposition}
            />
          </div>
        }
        membershipsByRoleContent={
          <MembershipsByRoleTables
            roles={[...accessRoles]}
            members={activeParticipantsForTables}
            onOpenRightsDialog={membership => {
              setMemberRightsMembership(membership);
              setMemberRightsOpen(true);
            }}
            onRemoveRole={handleRemoveRoleFromParticipantTypeView}
            onSecondaryAction={handleOpenChangeRoleDialog}
            secondaryActionLabel="Manage Roles"
            entityType="event"
            countLabel="participants"
            memberDescriptionFallback="Participants currently assigned to this role."
            emptyStateLabel="No participants currently carry this role."
            showProvenanceColumns={showComposition}
          />
        }
        compositionContent={
          <MembershipCompositionPanel
            buckets={compositionBuckets}
            isLoading={compositionIsLoading}
          />
        }
        rolesContent={<EventRoles eventId={eventId} />}
        showComposition={showComposition}
        showGuests={false}
      />

      <MemberRightsDialog
        isOpen={memberRightsOpen}
        onOpenChange={setMemberRightsOpen}
        membership={memberRightsMembership}
        onNavigateToUser={userId => navigate({ to: '/user/$id', params: { id: userId } })}
        entityType="event"
        contextLabel="event"
        fallbackRoleLabel="Participant"
        emptyRightsLabel="No explicit action rights are currently assigned through this participant's roles."
        actionRightsCatalog={EVENT_ACTION_RIGHTS}
      />

      <ChangeRoleDialog
        isOpen={changeRoleOpen}
        onOpenChange={setChangeRoleOpen}
        memberName={
          changeRoleMembership
            ? [changeRoleMembership.user?.first_name, changeRoleMembership.user?.last_name]
                .filter(Boolean)
                .join(' ') || 'Unknown User'
            : ''
        }
        currentRoles={
          changeRoleMembership?.roles ??
          (changeRoleMembership?.role ? [changeRoleMembership.role] : [])
        }
        roles={[...accessRoles]}
        onConfirm={handleConfirmRoleChange}
        title="Manage Participant Roles"
      />
    </div>
  );
}
