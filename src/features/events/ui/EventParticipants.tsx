import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import {
  useEventData,
  useEventParticipants as useEventParticipantsData,
} from '../hooks/useEventData';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAccessRoles, useEventOfflineParticipants } from '@/zero/events/useEventState';
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
import {
  OfflineRosterCard,
  type OfflineRosterCandidateUser,
  type OfflineRosterRow,
} from '@/features/offline-roster/ui/OfflineRosterCard';
import { useMembershipSearch } from '@/features/groups/hooks/useMembershipSearch';
import { getMembershipDisplayRoles } from '@/features/groups/logic/buildMembershipRightsSummary';
import type {
  MembershipSort,
  MembershipSortField,
  MembershipTab,
} from '@/features/groups/types/group.types';
import { EVENT_ACTION_RIGHTS } from '@/zero/rbac/constants';
import { useDelegateAssemblyParticipantsComposition } from '../hooks/useDelegateAssemblyParticipantsComposition';
import { useEventActions } from '@/zero/events/useEventActions';
import { serverConfirmed } from '@/zero/mutate-with-server-check';

type EventParticipantRow = ReturnType<typeof useEventParticipantsData>['participants'][number];

function resolveAttendanceMode(event: {
  attendance_mode?: string | null;
  location_type?: string | null;
}) {
  if (event.attendance_mode === 'online' || event.attendance_mode === 'hybrid') {
    return event.attendance_mode;
  }

  return event.location_type === 'online' ? 'online' : 'offline';
}

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
  const { offlineParticipants } = useEventOfflineParticipants(eventId);
  const { roles: accessRoles } = useEventAccessRoles(eventId);
  const {
    inviteParticipants,
    approveParticipation,
    rejectParticipation,
    removeParticipant,
    changeParticipantRoles,
  } = useEventMutations(eventId);
  const {
    createOfflineParticipant,
    updateOfflineParticipant,
    deleteOfflineParticipant,
    importOfflineParticipants,
  } = useEventActions();

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
  const attendanceMode = resolveAttendanceMode(event || {});
  const showOfflineRoster = attendanceMode !== 'online';
  const activePlatformParticipants = useMemo(
    () =>
      participants.filter(
        participant =>
          participant.status === 'active' ||
          participant.status === 'member' ||
          participant.status === 'admin' ||
          participant.status === 'confirmed'
      ),
    [participants]
  );

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

  const offlineConnectedUserIds = useMemo(
    () =>
      new Set(
        offlineParticipants
          .map(participant => participant.connected_user_id)
          .filter((candidate): candidate is string => Boolean(candidate))
      ),
    [offlineParticipants]
  );

  const connectedUserCandidates = useMemo<OfflineRosterCandidateUser[]>(
    () =>
      activePlatformParticipants
        .map(participant => participant.user)
        .filter(
          (user): user is NonNullable<(typeof activePlatformParticipants)[number]['user']> =>
            Boolean(user?.id) && !offlineConnectedUserIds.has(user?.id ?? '')
        ),
    [activePlatformParticipants, offlineConnectedUserIds]
  );

  const filteredOfflineRows = useMemo(
    () =>
      offlineParticipants
        .filter(offlineParticipant => {
          if (!participantSearchQuery.trim()) {
            return true;
          }

          const haystack = [
            offlineParticipant.first_name,
            offlineParticipant.last_name,
            offlineParticipant.reason_not_signed_up,
            offlineParticipant.connected_user?.first_name,
            offlineParticipant.connected_user?.last_name,
            offlineParticipant.connected_user?.handle,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(participantSearchQuery.trim().toLowerCase());
        })
        .map<OfflineRosterRow>(offlineParticipant => ({
          id: offlineParticipant.id,
          kind: 'offline',
          firstName: offlineParticipant.first_name,
          lastName: offlineParticipant.last_name,
          isActiveUser: false,
          reasonNotSignedUp: offlineParticipant.reason_not_signed_up,
          connectedUser: offlineParticipant.connected_user ?? null,
          partGroup:
            showComposition && offlineParticipant.group_offline_member?.group
              ? {
                  id: offlineParticipant.group_offline_member.group.id,
                  name: offlineParticipant.group_offline_member.group.name ?? null,
                }
              : null,
          baseGroup:
            showComposition && offlineParticipant.group_offline_member?.group
              ? {
                  id: offlineParticipant.group_offline_member.group.id,
                  name: offlineParticipant.group_offline_member.group.name ?? null,
                }
              : null,
          readOnlyIdentity: offlineParticipant.source_type === 'group_member',
          canConnect: offlineParticipant.source_type === 'event_extra',
          canEdit: offlineParticipant.source_type === 'event_extra',
          canDelete: offlineParticipant.source_type === 'event_extra',
          canConfirmParticipation: offlineParticipant.attendance_status !== 'confirmed',
          canWithdrawParticipation: offlineParticipant.attendance_status === 'confirmed',
          canToggleChannel:
            attendanceMode === 'hybrid' && Boolean(offlineParticipant.connected_user_id),
          attendanceStatus:
            offlineParticipant.attendance_status === 'confirmed' ? 'confirmed' : 'listed',
          participationChannel:
            offlineParticipant.participation_channel === 'online' ? 'online' : 'offline',
        })),
    [attendanceMode, offlineParticipants, participantSearchQuery, showComposition]
  );

  const allParticipantRows = useMemo(
    () => [
      ...activeParticipantsForTables.map<OfflineRosterRow>(participant => ({
        id: `active:${participant.id}`,
        kind: 'active',
        firstName: participant.user?.first_name || '',
        lastName: participant.user?.last_name || '',
        isActiveUser: true,
        connectedUser: null,
        reasonNotSignedUp: null,
        partGroup:
          showComposition &&
          'partGroup' in participant &&
          participant.partGroup &&
          typeof participant.partGroup === 'object' &&
          'id' in participant.partGroup &&
          typeof participant.partGroup.id === 'string'
            ? {
                id: participant.partGroup.id,
                name:
                  'name' in participant.partGroup && typeof participant.partGroup.name === 'string'
                    ? participant.partGroup.name
                    : null,
              }
            : null,
        baseGroup:
          showComposition &&
          'baseGroup' in participant &&
          participant.baseGroup &&
          typeof participant.baseGroup === 'object' &&
          'id' in participant.baseGroup &&
          typeof participant.baseGroup.id === 'string'
            ? {
                id: participant.baseGroup.id,
                name:
                  'name' in participant.baseGroup && typeof participant.baseGroup.name === 'string'
                    ? participant.baseGroup.name
                    : null,
              }
            : null,
      })),
      ...filteredOfflineRows,
    ],
    [activeParticipantsForTables, filteredOfflineRows, showComposition]
  );

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
            {showOfflineRoster ? (
              <OfflineRosterCard
                title="All participants (incl. offline/hybrid participants)"
                description="Some participants may attend or be represented without using the platform directly. This roster keeps those offline or hybrid participants visible for invitations, confirmations, vote caps, and final result aggregation."
                rows={allParticipantRows}
                connectedUserCandidates={connectedUserCandidates}
                showManageButton
                showProvenanceColumns={showComposition}
                manageDialogTitle="Manage offline and hybrid participants"
                manageDialogDescription="Add extra offline or hybrid participants for this event one by one or via CSV."
                emptyStateLabel="No offline or hybrid participants have been added yet."
                onCreate={(entry, correlationId) =>
                  serverConfirmed(
                    createOfflineParticipant({
                      id: crypto.randomUUID(),
                      event_id: eventId,
                      group_offline_member_id: null,
                      source_type: 'event_extra',
                      first_name: entry.firstName,
                      last_name: entry.lastName,
                      reason_not_signed_up: entry.reasonNotSignedUp || null,
                      connected_user_id: null,
                      attendance_status: 'listed',
                      participation_channel: 'offline',
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onImport={(entries, correlationId) =>
                  serverConfirmed(
                    importOfflineParticipants({
                      event_id: eventId,
                      entries: entries.map(entry => ({
                        first_name: entry.firstName,
                        last_name: entry.lastName,
                        reason_not_signed_up: entry.reasonNotSignedUp || null,
                      })),
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onConnect={(row, userId, correlationId) =>
                  serverConfirmed(
                    updateOfflineParticipant({
                      id: row.id,
                      connected_user_id: userId,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onEdit={(row, entry, correlationId) =>
                  serverConfirmed(
                    updateOfflineParticipant({
                      id: row.id,
                      first_name: entry.firstName,
                      last_name: entry.lastName,
                      reason_not_signed_up: entry.reasonNotSignedUp || null,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onDelete={(row, correlationId) =>
                  serverConfirmed(
                    deleteOfflineParticipant({
                      id: row.id,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onSetParticipationStatus={(row, nextStatus, correlationId) =>
                  serverConfirmed(
                    updateOfflineParticipant({
                      id: row.id,
                      attendance_status: nextStatus,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onToggleChannel={(row, nextChannel, correlationId) =>
                  serverConfirmed(
                    updateOfflineParticipant({
                      id: row.id,
                      participation_channel: nextChannel,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
              />
            ) : null}
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
