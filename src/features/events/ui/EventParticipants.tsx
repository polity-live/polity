import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import {
  useEventData,
  useEventParticipants as useEventParticipantsData,
} from '../hooks/useEventData';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAccessRoles, useEventOfflineParticipants } from '@/zero/events/useEventState';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { EntitySearchBar } from '@/features/shared/ui/typeahead';
import { MembershipTabs } from '@/features/groups/ui/MembershipTabs';
import {
  ParticipationRoleFilterBar,
  filterParticipationsByRole,
} from '@/features/shared/ui/participation';
import { ActiveMembersTable } from '@/features/groups/ui/ActiveMembersTable';
import { MembershipsByRoleTables } from '@/features/groups/ui/MembershipsByRoleTables';
import { PendingRequestsTable } from '@/features/groups/ui/PendingRequestsTable';
import { PendingInvitationsTable } from '@/features/groups/ui/PendingInvitationsTable';
import { InviteMembersDialog } from '@/features/groups/ui/InviteMembersDialog';
import { GuestsTable } from '@/features/groups/ui/GuestsTable';
import { ChangeRoleDialog } from '@/features/groups/ui/ChangeRoleDialog';
import { MemberRightsDialog } from '@/features/groups/ui/MemberRightsDialog';
import { EventRoles } from '@/features/roles/ui/EventRoles';
import {
  OfflineRosterCard,
  type OfflineRosterCandidateUser,
} from '@/features/offline-roster/ui/OfflineRosterCard';
import { useMembershipSearch } from '@/features/groups/hooks/useMembershipSearch';
import { getMembershipDisplayRoles } from '@/features/groups/logic/buildMembershipRightsSummary';
import type {
  MembershipSort,
  MembershipSortField,
  MembershipTab,
} from '@/features/groups/types/group.types';
import { EVENT_ACTION_RIGHTS } from '@/zero/rbac/constants';
import { useEventParticipantsComposition } from '../hooks/useDelegateAssemblyParticipantsComposition';
import { DelegateAssemblyCompositionPanel } from './DelegateAssemblyCompositionPanel';
import { MembershipCompositionPanel } from '@/features/groups/ui/MembershipCompositionPanel';
import { useEventActions } from '@/zero/events/useEventActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ManagementToolbar, SettingsPage } from '@/features/shared/ui/form';
import { buildEventParticipantCompositionBuckets } from '../logic/eventParticipantComposition';
import { buildOfflineRosterRowsForEvent } from '../logic/offlineParticipantRows';
import { queries } from '@/zero/queries';

type EventParticipantRow = ReturnType<typeof useEventParticipantsData>['participants'][number];

interface DelegateRepresentedGroup {
  id: string;
  name: string;
  seatCount: number;
}

function resolveAttendanceMode(event: {
  attendance_mode?: string | null;
  location_type?: string | null;
}) {
  if (event.attendance_mode === 'online' || event.attendance_mode === 'hybrid') {
    return event.attendance_mode;
  }

  return event.location_type === 'online' ? 'online' : 'offline';
}

function isAssemblyEventType(eventType: string | null | undefined) {
  return eventType === 'general_assembly' || eventType === 'delegate_assembly';
}

export function EventParticipants({
  eventId,
  defaultTab = 'membershipsByUser',
  onTabChange,
}: {
  eventId: string;
  defaultTab?: MembershipTab;
  onTabChange?: (tab: MembershipTab) => void;
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
  useEffect(() => setActiveTab(defaultTab), [defaultTab]);
  const handleTabChange = (tab: MembershipTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };
  const [membershipSort, setMembershipSort] = useState<MembershipSort>({
    field: 'user',
    direction: 'asc',
  });
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedInviteRoleIds, setSelectedInviteRoleIds] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [selectedGuestUserIds, setSelectedGuestUserIds] = useState<string[]>([]);
  const [selectedGuestRoleIds, setSelectedGuestRoleIds] = useState<string[]>([]);
  const [isInvitingGuests, setIsInvitingGuests] = useState(false);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [changeRoleMembership, setChangeRoleMembership] = useState<EventParticipantRow | null>(
    null
  );
  const [memberRightsOpen, setMemberRightsOpen] = useState(false);
  const [memberRightsMembership, setMemberRightsMembership] = useState<EventParticipantRow | null>(
    null
  );

  const {
    showComposition: showParticipantComposition,
    participantsWithProvenance,
    isLoading: compositionIsLoading,
    isDelegateAssembly: showDelegateComposition,
  } = useEventParticipantsComposition(event, participants);
  const showBaseGroupColumn = true;
  const {
    activeMembers: activeParticipants,
    pendingRequests,
    pendingInvitations,
  } = useMembershipSearch(participantsWithProvenance, participantSearchQuery, membershipSort, {
    activeStatuses: ['active', 'member', 'admin', 'confirmed'],
    activeRoleNames: ['Organizer'],
  });
  const delegateRepresentedGroupsByUserId = useMemo(() => {
    const groupsByUserId = new Map<string, Map<string, DelegateRepresentedGroup>>();

    if (!showDelegateComposition) {
      return new Map<string, DelegateRepresentedGroup[]>();
    }

    for (const delegate of event?.delegates || []) {
      if (delegate.status !== 'confirmed' || !delegate.user_id) {
        continue;
      }

      const groupId = delegate.group_id || delegate.group?.id;
      if (!groupId) {
        continue;
      }

      const userGroups =
        groupsByUserId.get(delegate.user_id) ?? new Map<string, DelegateRepresentedGroup>();
      const existingGroup = userGroups.get(groupId);
      const seatCount = Math.max(1, delegate.seat_count ?? 1);

      if (existingGroup) {
        existingGroup.seatCount += seatCount;
      } else {
        userGroups.set(groupId, {
          id: groupId,
          name: delegate.group?.name || groupId,
          seatCount,
        });
      }

      groupsByUserId.set(delegate.user_id, userGroups);
    }

    return new Map(
      [...groupsByUserId.entries()].map(([userId, representedGroups]) => [
        userId,
        [...representedGroups.values()].sort((left, right) =>
          left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
        ),
      ])
    );
  }, [event?.delegates, showDelegateComposition]);
  const activeParticipantsWithDelegateRepresentation = useMemo(
    () =>
      activeParticipants.map(participant => {
        const userId = participant.user_id || participant.user?.id;
        const delegateRepresentedGroups = userId
          ? (delegateRepresentedGroupsByUserId.get(userId) ?? [])
          : [];

        return {
          ...participant,
          delegateRepresentedGroups,
        };
      }),
    [activeParticipants, delegateRepresentedGroupsByUserId]
  );

  const existingParticipantIds = Array.from(
    new Set(
      participants
        .map(participant => participant.user?.id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const eventTitle = event?.title || 'Event';
  const assemblyEvent = isAssemblyEventType(event?.event_type);
  const attendanceMode = resolveAttendanceMode(event || {});
  const showOfflineRoster = attendanceMode !== 'online';
  const guestRoles = useMemo(
    () => accessRoles.filter(role => role.assignee_kind === 'guest'),
    [accessRoles]
  );
  const inviteRoles = useMemo(
    () =>
      assemblyEvent ? accessRoles.filter(role => role.assignee_kind === 'guest') : [...accessRoles],
    [accessRoles, assemblyEvent]
  );
  const guestParticipants = useMemo(
    () =>
      participantsWithProvenance
        .filter(participant =>
          getMembershipDisplayRoles(participant).some(role => role.assignee_kind === 'guest')
        )
        .map(participant => ({
          id: participant.id,
          status: participant.status,
          user: participant.user,
          roles: getMembershipDisplayRoles(participant).filter(
            role => role.assignee_kind === 'guest'
          ),
          partGroup: participant.partGroup ?? null,
          baseGroup: participant.baseGroup ?? null,
          provenanceBucketLabel: participant.provenanceBucketLabel ?? null,
        })),
    [participantsWithProvenance]
  );
  const showParticipantSearch = activeTab !== 'roles' && activeTab !== 'composition';
  const roleFilterRoles = useMemo(
    () => (activeTab === 'guests' ? guestRoles : accessRoles),
    [accessRoles, activeTab, guestRoles]
  );
  const roleFilterRoleIds = useMemo(
    () => new Set(roleFilterRoles.map(role => role.id).filter(Boolean)),
    [roleFilterRoles]
  );
  const activeRoleFilterIds = useMemo(
    () => selectedRoleIds.filter(roleId => roleFilterRoleIds.has(roleId)),
    [roleFilterRoleIds, selectedRoleIds]
  );
  const filteredPendingRequests = useMemo(
    () => filterParticipationsByRole(pendingRequests, activeRoleFilterIds),
    [activeRoleFilterIds, pendingRequests]
  );
  const filteredPendingInvitations = useMemo(
    () => filterParticipationsByRole(pendingInvitations, activeRoleFilterIds),
    [activeRoleFilterIds, pendingInvitations]
  );
  const filteredActiveParticipantsForTables = useMemo(
    () =>
      filterParticipationsByRole(activeParticipantsWithDelegateRepresentation, activeRoleFilterIds),
    [activeParticipantsWithDelegateRepresentation, activeRoleFilterIds]
  );
  const participantRowsById = useMemo(
    () =>
      new Map(
        [
          ...activeParticipantsWithDelegateRepresentation,
          ...pendingRequests,
          ...pendingInvitations,
        ].map((participant: any) => [participant.id, participant])
      ),
    [activeParticipantsWithDelegateRepresentation, pendingInvitations, pendingRequests]
  );
  const participantVirtualSources = useMemo(() => {
    const makeSource = (statuses: string[], suffix: string, roleIds = activeRoleFilterIds) => ({
      context: {
        eventId,
        statuses,
        query: participantSearchQuery,
        roleIds,
      },
      historyKey: `event-${eventId}-participants-${suffix}`,
      getPageQuery: ({ limit, start, dir, settled }: any) => ({
        query: queries.events.participantPage({
          eventId,
          statuses,
          roleIds,
          query: participantSearchQuery,
          limit,
          start,
          dir,
        }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getSingleQuery: ({ id, settled }: any) => ({
        query: queries.events.participantById({ id }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getRowKey: (row: any) => row.id,
      toStartRow: (row: any) => ({ created_at: row.created_at, id: row.id }),
      mapRow: (row: any) => participantRowsById.get(row.id) ?? row,
    });
    return {
      requested: makeSource(['requested'], 'requested'),
      invited: makeSource(['invited'], 'invited'),
      active: makeSource(['active', 'member', 'admin', 'confirmed'], 'active'),
      byRole: (roleId: string) =>
        makeSource(['active', 'member', 'admin', 'confirmed'], `role-${roleId}`, [roleId]),
    };
  }, [activeRoleFilterIds, eventId, participantRowsById, participantSearchQuery]);
  const filteredGuestParticipants = useMemo(
    () => filterParticipationsByRole(guestParticipants, activeRoleFilterIds),
    [activeRoleFilterIds, guestParticipants]
  );
  const guestParticipantRowsById = useMemo(
    () =>
      new Map(filteredGuestParticipants.map((participant: any) => [participant.id, participant])),
    [filteredGuestParticipants]
  );
  const guestParticipantVirtualSource = useMemo(
    () => ({
      context: {
        eventId,
        statuses: ['requested', 'invited', 'active', 'confirmed'],
        query: participantSearchQuery,
        roleIds: guestRoles.map((role: any) => role.id),
      },
      historyKey: `event-${eventId}-guest-participants`,
      getPageQuery: ({ limit, start, dir, settled }: any) => ({
        query: queries.events.participantPage({
          eventId,
          statuses: ['requested', 'invited', 'active', 'confirmed'],
          roleIds: guestRoles.map((role: any) => role.id),
          query: participantSearchQuery,
          limit,
          start,
          dir,
        }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getSingleQuery: ({ id, settled }: any) => ({
        query: queries.events.participantById({ id }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getRowKey: (row: any) => row.id,
      toStartRow: (row: any) => ({ created_at: row.created_at, id: row.id }),
      mapRow: (row: any) => guestParticipantRowsById.get(row.id) ?? row,
    }),
    [eventId, guestParticipantRowsById, guestRoles, participantSearchQuery]
  );
  const activePlatformParticipants = useMemo(
    () =>
      participantsWithProvenance.filter(
        participant =>
          participant.status === 'active' ||
          participant.status === 'member' ||
          participant.status === 'admin' ||
          participant.status === 'confirmed'
      ),
    [participantsWithProvenance]
  );

  useEffect(() => {
    setSelectedInviteRoleIds(currentRoleIds =>
      currentRoleIds.filter(roleId => inviteRoles.some(role => role.id === roleId))
    );
  }, [inviteRoles]);

  useEffect(() => {
    setSelectedGuestRoleIds(currentRoleIds =>
      currentRoleIds.filter(roleId => guestRoles.some(role => role.id === roleId))
    );
  }, [guestRoles]);

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
    } finally {
      setIsInviting(false);
    }
  };

  const handleInviteGuests = async () => {
    if (selectedGuestUserIds.length === 0) return;

    setIsInvitingGuests(true);
    try {
      await inviteParticipants(
        selectedGuestUserIds,
        selectedGuestRoleIds,
        authUser?.id ?? undefined,
        eventTitle
      );
      setSelectedGuestUserIds([]);
      setSelectedGuestRoleIds([]);
    } finally {
      setIsInvitingGuests(false);
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

  const eventBaseGroupReference = useMemo(
    () =>
      event?.group?.group_type === 'base' && event.group.id
        ? {
            id: event.group.id,
            name: event.group.name ?? null,
          }
        : null,
    [event?.group?.group_type, event?.group?.id, event?.group?.name]
  );

  const offlineRosterRowModel = useMemo(
    () =>
      buildOfflineRosterRowsForEvent({
        attendanceMode,
        activeParticipants: activeParticipantsWithDelegateRepresentation,
        offlineParticipants,
        eventBaseGroupReference,
        showParticipantComposition,
        showBaseGroupColumn,
      }),
    [
      activeParticipantsWithDelegateRepresentation,
      attendanceMode,
      eventBaseGroupReference,
      offlineParticipants,
      showBaseGroupColumn,
      showParticipantComposition,
    ]
  );
  const activeRosterRows = offlineRosterRowModel.activeRows;
  const offlineRosterRows = offlineRosterRowModel.offlineRows;

  const filteredOfflineRows = useMemo(
    () =>
      offlineRosterRows.filter(offlineRow => {
        if (!participantSearchQuery.trim()) {
          return true;
        }

        const haystack = [
          offlineRow.firstName,
          offlineRow.lastName,
          offlineRow.reasonNotSignedUp,
          offlineRow.connectedUser?.first_name,
          offlineRow.connectedUser?.last_name,
          offlineRow.connectedUser?.handle,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(participantSearchQuery.trim().toLowerCase());
      }),
    [offlineRosterRows, participantSearchQuery]
  );

  const allParticipantRows = useMemo(
    () => [...activeRosterRows, ...filteredOfflineRows],
    [activeRosterRows, filteredOfflineRows]
  );

  const participantRowsForComposition = useMemo(
    () => [
      ...activePlatformParticipants,
      ...offlineRosterRows.map(offlineRow => ({
        id: `offline:${offlineRow.id}`,
        user_id: offlineRow.connectedUser?.id ?? null,
        user: offlineRow.connectedUser
          ? {
              id: offlineRow.connectedUser.id,
              first_name: offlineRow.connectedUser.first_name ?? offlineRow.firstName,
              last_name: offlineRow.connectedUser.last_name ?? offlineRow.lastName,
              handle: offlineRow.connectedUser.handle ?? null,
              avatar: offlineRow.connectedUser.avatar ?? null,
              email: offlineRow.connectedUser.email ?? null,
            }
          : null,
        status: 'active',
        roles: offlineRow.roles ?? [],
        role: offlineRow.roles?.[0] ?? null,
        partGroup: offlineRow.partGroup
          ? {
              id: offlineRow.partGroup.id,
              name: offlineRow.partGroup.name || offlineRow.partGroup.id,
            }
          : null,
        baseGroup: offlineRow.baseGroup
          ? {
              id: offlineRow.baseGroup.id,
              name: offlineRow.baseGroup.name || offlineRow.baseGroup.id,
            }
          : null,
        provenanceBucketLabel: null,
      })),
    ],
    [activePlatformParticipants, offlineRosterRows]
  );
  const eventCompositionNoBaseGroupLabel = translateText(
    'features.events.participants.participantComposition.noBaseGroup',
    'No base group'
  );

  const eventCompositionBuckets = useMemo(
    () =>
      buildEventParticipantCompositionBuckets(participantRowsForComposition, {
        missingProvenanceLabel: eventCompositionNoBaseGroupLabel,
      }),
    [eventCompositionNoBaseGroupLabel, participantRowsForComposition]
  );

  if (isLoading) {
    return <PageSkeleton label={translateText('common.loading.pageSkeleton.entity')} />;
  }

  if (error || !event) {
    return <div>{translateText('generated.inline.0492_event_not_found_0f7c1f48')}</div>;
  }

  return (
    <EventParticipantsView
      title={translateText('generated.inline.0441_event_participants_df407348')}
      subtitle={eventTitle}
      showSearch={showParticipantSearch}
      searchQuery={participantSearchQuery}
      onSearchQueryChange={setParticipantSearchQuery}
      searchPlaceholder={translateText('generated.inline.0494_search_participants_1b38c2ef')}
      secondaryFilterContent={
        showParticipantSearch && roleFilterRoles.length > 0 ? (
          <ParticipationRoleFilterBar
            roles={roleFilterRoles}
            selectedRoleIds={activeRoleFilterIds}
            onSelectedRoleIdsChange={setSelectedRoleIds}
          />
        ) : null
      }
    >
      <MembershipTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        membershipsByUserLabel={translateText(
          'generated.inline.0100_participants_by_user_99abf1d2'
        )}
        membershipsByRoleLabel={translateText(
          'generated.inline.0101_participants_by_role_79dd6508'
        )}
        tabBarAction={
          activeTab === 'guests' ? (
            <InviteMembersDialog
              isOpen={inviteOpen}
              onOpenChange={setInviteOpen}
              selectedUsers={selectedGuestUserIds}
              onSelectedUsersChange={setSelectedGuestUserIds}
              excludeUserIds={existingParticipantIds}
              excludeUserId={authUser?.id}
              roles={[...guestRoles]}
              selectedRoleIds={selectedGuestRoleIds}
              onSelectedRoleIdsChange={setSelectedGuestRoleIds}
              onInvite={handleInviteGuests}
              isInviting={isInvitingGuests}
              triggerLabel={translateText('generated.inline.0495_invite_guest_a2db715e')}
              dialogTitle={translateText('generated.inline.0496_invite_guests_5bae717f')}
              dialogDescription={translateText(
                'generated.inline.0497_invite_users_as_guests_with_guest_roles_for_t_b6b9cdac'
              )}
              roleSectionTitle={translateText('generated.inline.0112_guest_roles_987ebdbe')}
              roleSectionDescription={translateText(
                'generated.inline.0498_guest_invitations_must_always_include_at_leas_407f8685'
              )}
              defaultRoleFallbackName="Gast"
              emptyRolesLabel={translateText(
                'generated.inline.0499_create_a_guest_role_first_before_inviting_gue_13882d1d'
              )}
            />
          ) : activeTab !== 'roles' && activeTab !== 'composition' ? (
            <InviteMembersDialog
              isOpen={inviteOpen}
              onOpenChange={setInviteOpen}
              selectedUsers={selectedUserIds}
              onSelectedUsersChange={setSelectedUserIds}
              excludeUserIds={existingParticipantIds}
              excludeUserId={authUser?.id}
              roles={inviteRoles}
              selectedRoleIds={selectedInviteRoleIds}
              onSelectedRoleIdsChange={setSelectedInviteRoleIds}
              onInvite={handleInvite}
              isInviting={isInviting}
              disabled={assemblyEvent}
              disabledReason="For assembly events, official member invites are disabled here. Use the Guests tab to invite guests."
              triggerLabel={translateText('generated.inline.0500_invite_participant_7843ba08')}
              dialogTitle={translateText('generated.inline.0501_invite_participants_aabb6cba')}
              dialogDescription={translateText(
                'generated.inline.0502_search_and_select_users_to_invite_to_this_eve_9e8bdab7'
              )}
              roleSectionTitle={translateText('generated.inline.0113_participant_roles_4e1d1173')}
              roleSectionDescription={
                assemblyEvent
                  ? 'Assembly events only allow guest roles for invited participants. The default guest invite role is preselected.'
                  : 'Tick one or more roles for invited participants. The default invite role is preselected.'
              }
              defaultRoleFallbackName={assemblyEvent ? 'Gast' : 'Participant'}
              emptyRolesLabel={translateText(
                'generated.inline.0503_create_an_event_role_first_before_inviting_pa_a92494f3'
              )}
            />
          ) : null
        }
        membershipsByUserContent={
          <div className="space-y-4">
            <PendingRequestsTable
              requests={filteredPendingRequests}
              virtualSource={participantVirtualSources.requested}
              onApprove={(membershipId, userId) =>
                approveParticipation(membershipId, userId, authUser?.id ?? undefined, eventTitle)
              }
              onReject={(membershipId, userId) =>
                rejectParticipation(membershipId, userId, authUser?.id ?? undefined, eventTitle)
              }
              title={translateText('generated.inline.0504_pending_participation_requests_3a5ff856')}
              description={translateText(
                'generated.inline.0505_review_and_approve_participation_requests_2cf88534'
              )}
              fallbackRoleLabel={translateText('generated.inline.0506_participant_a77366e9')}
              showBaseGroupColumn={showBaseGroupColumn}
            />
            <PendingInvitationsTable
              invitations={filteredPendingInvitations}
              virtualSource={participantVirtualSources.invited}
              onWithdraw={(membershipId, userId) =>
                rejectParticipation(membershipId, userId, authUser?.id ?? undefined, eventTitle)
              }
              description={translateText(
                'generated.inline.0507_users_who_have_been_invited_to_this_event_but_d947b292'
              )}
              fallbackRoleLabel={translateText('generated.inline.0506_participant_a77366e9')}
              showBaseGroupColumn={showBaseGroupColumn}
            />
            <ActiveMembersTable
              members={filteredActiveParticipantsForTables}
              virtualSource={participantVirtualSources.active}
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
              title={translateText('generated.inline.0508_active_participants_8e5af26b')}
              description={translateText(
                'generated.inline.0509_current_event_participants_and_organizers_cf1218e5'
              )}
              fallbackRoleLabel={translateText('generated.inline.0506_participant_a77366e9')}
              showPartGroupColumn={showParticipantComposition}
              showBaseGroupColumn={showBaseGroupColumn}
              showDelegateRepresentationColumn={showDelegateComposition}
            />
            {showOfflineRoster && activeRoleFilterIds.length === 0 ? (
              <OfflineRosterCard
                title={translateText(
                  'generated.inline.0510_all_participants_incl_offline_hybrid_particip_12560f8c'
                )}
                description={translateText(
                  'generated.inline.0511_some_participants_may_attend_or_be_represente_f48d916e'
                )}
                rows={allParticipantRows}
                connectedUserCandidates={connectedUserCandidates}
                showManageButton
                showPartGroupColumn={showParticipantComposition}
                showBaseGroupColumn={showBaseGroupColumn}
                manageDialogTitle={translateText(
                  'generated.inline.0512_manage_offline_and_hybrid_participants_32ec2f90'
                )}
                manageDialogDescription={translateText(
                  'generated.inline.0513_add_extra_offline_or_hybrid_participants_for__6da70f71'
                )}
                emptyStateLabel={translateText(
                  'generated.inline.0114_no_offline_or_hybrid_participants_have_been_a_3fda5da7'
                )}
                onCreate={(entry, correlationId) =>
                  waitForClientApply(
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
                  waitForClientApply(
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
                  waitForClientApply(
                    updateOfflineParticipant({
                      id: row.id,
                      connected_user_id: userId,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onEdit={(row, entry, correlationId) =>
                  waitForClientApply(
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
                  waitForClientApply(
                    deleteOfflineParticipant({
                      id: row.attendanceParticipantId ?? row.id,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onSetParticipationStatus={async (row, nextStatus, correlationId) => {
                  if (row.attendanceParticipantId) {
                    return waitForClientApply(
                      updateOfflineParticipant({
                        id: row.attendanceParticipantId,
                        attendance_status: nextStatus,
                        debug_correlation_id: correlationId,
                      })
                    );
                  }

                  if (row.kind !== 'active' || !row.user?.id || nextStatus !== 'confirmed') {
                    return undefined;
                  }

                  return waitForClientApply(
                    createOfflineParticipant({
                      id: crypto.randomUUID(),
                      event_id: eventId,
                      group_offline_member_id: null,
                      source_type: 'event_extra',
                      first_name: row.firstName || row.user.email || 'Participant',
                      last_name: row.lastName || '-',
                      reason_not_signed_up: null,
                      connected_user_id: row.user.id,
                      attendance_status: 'confirmed',
                      participation_channel: 'offline',
                      debug_correlation_id: correlationId,
                    })
                  );
                }}
                onToggleChannel={(row, nextChannel, correlationId) =>
                  waitForClientApply(
                    updateOfflineParticipant({
                      id: row.attendanceParticipantId ?? row.id,
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
            members={filteredActiveParticipantsForTables}
            onOpenRightsDialog={membership => {
              setMemberRightsMembership(membership);
              setMemberRightsOpen(true);
            }}
            onRemoveRole={handleRemoveRoleFromParticipantTypeView}
            onSecondaryAction={handleOpenChangeRoleDialog}
            secondaryActionLabel={translateText('generated.inline.0012_manage_roles_5f9b8531')}
            entityType="event"
            countLabel={translateText('generated.inline.0057_participants_a94a46cc')}
            memberDescriptionFallback={translateText(
              'generated.inline.0115_participants_currently_assigned_to_this_role_16e23493'
            )}
            emptyStateLabel={translateText(
              'generated.inline.0116_no_participants_currently_carry_this_role_18087ba6'
            )}
            showPartGroupColumn={showParticipantComposition}
            showBaseGroupColumn={showBaseGroupColumn}
            showDelegateRepresentationColumn={showDelegateComposition}
            hideEmptyRoleSections={activeRoleFilterIds.length > 0}
            getVirtualSource={participantVirtualSources.byRole}
          />
        }
        compositionContent={
          <div className="space-y-8">
            <MembershipCompositionPanel
              buckets={eventCompositionBuckets}
              isLoading={compositionIsLoading}
              labelOverrides={{
                membersTitle: translateText(
                  'features.events.participants.participantComposition.participantsTitle',
                  'Participants'
                ),
                membersDescription: translateText(
                  'features.events.participants.participantComposition.participantsDescription',
                  'Share of part groups across all active/offline event participants.'
                ),
                membersEmpty: translateText(
                  'features.events.participants.participantComposition.participantsEmpty',
                  'No participants found.'
                ),
              }}
            />
            {showDelegateComposition ? (
              <DelegateAssemblyCompositionPanel eventId={eventId} />
            ) : null}
          </div>
        }
        guestsContent={
          <div className="space-y-4">
            <GuestsTable
              guests={filteredGuestParticipants}
              virtualSource={guestParticipantVirtualSource}
              onApprove={guestAccessId => {
                const guest = guestParticipants.find(
                  participant => participant.id === guestAccessId
                );
                if (!guest) {
                  return;
                }

                void approveParticipation(
                  guest.id,
                  guest.user?.id ?? undefined,
                  authUser?.id ?? undefined,
                  eventTitle
                );
              }}
              onRevoke={guestAccessId => {
                const guest = guestParticipants.find(
                  participant => participant.id === guestAccessId
                );
                if (!guest) {
                  return;
                }

                if (guest.status === 'requested') {
                  void rejectParticipation(
                    guest.id,
                    guest.user?.id ?? undefined,
                    authUser?.id ?? undefined,
                    eventTitle
                  );
                  return;
                }

                void removeParticipant(
                  guest.id,
                  guest.user?.id ?? undefined,
                  authUser?.id ?? undefined,
                  eventTitle
                );
              }}
              title={translateText('generated.inline.0514_guest_participants_8d6eb693')}
              description={translateText(
                'generated.inline.0515_users_with_guest_roles_in_this_event_includin_77e18f41'
              )}
              showBaseGroupColumn={showBaseGroupColumn}
            />
          </div>
        }
        rolesContent={<EventRoles eventId={eventId} />}
        showComposition
        compositionLabel={translateText('features.events.participants.tabs.composition')}
        showGuests
      />

      <MemberRightsDialog
        isOpen={memberRightsOpen}
        onOpenChange={setMemberRightsOpen}
        membership={memberRightsMembership}
        onNavigateToUser={userId => navigate({ to: '/user/$id', params: { id: userId } })}
        entityType="event"
        contextLabel={translateText('generated.inline.0058_event_5006ed02')}
        fallbackRoleLabel={translateText('generated.inline.0506_participant_a77366e9')}
        emptyRightsLabel={translateText(
          'generated.inline.0117_no_explicit_action_rights_are_currently_assig_eb5ab2a3'
        )}
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
        title={translateText('generated.inline.0516_manage_participant_roles_eddec16c')}
      />
    </EventParticipantsView>
  );
}

interface EventParticipantsViewProps {
  title: string;
  subtitle: string;
  showSearch: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchPlaceholder: string;
  secondaryFilterContent?: ReactNode;
  children: ReactNode;
}

export function EventParticipantsView({
  title,
  subtitle,
  showSearch,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  secondaryFilterContent,
  children,
}: EventParticipantsViewProps) {
  return (
    <SettingsPage title={title} description={subtitle} size="wide" headingMode="sr-only">
      {showSearch || secondaryFilterContent ? (
        <ManagementToolbar className="mb-6">
          {showSearch ? (
            <EntitySearchBar
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              placeholder={searchPlaceholder}
              className="flex-1"
            />
          ) : null}
          {secondaryFilterContent}
        </ManagementToolbar>
      ) : null}
      {children}
    </SettingsPage>
  );
}
