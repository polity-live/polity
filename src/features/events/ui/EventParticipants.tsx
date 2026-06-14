import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { EntitySearchBar } from '@/features/shared/ui/typeahead';
import { MembershipTabs } from '@/features/groups/ui/MembershipTabs';
import { ActiveMembersTable } from '@/features/groups/ui/ActiveMembersTable';
import { MembershipsByRoleTables } from '@/features/groups/ui/MembershipsByRoleTables';
import { MembershipCompositionPanel } from '@/features/groups/ui/MembershipCompositionPanel';
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
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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

function isAssemblyEventType(eventType: string | null | undefined) {
  return eventType === 'general_assembly' || eventType === 'delegate_assembly';
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
      participants
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
        })),
    [participants]
  );
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
      setInviteOpen(false);
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
      setInviteOpen(false);
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
    return <div>{translateText('generated.inline.0491_loading_event_participants_4216bb13')}</div>;
  }

  if (error || !event) {
    return <div>{translateText('generated.inline.0492_event_not_found_0f7c1f48')}</div>;
  }

  return (
    <EventParticipantsView
      title={translateText('generated.inline.0441_event_participants_df407348')}
      subtitle={eventTitle}
      backLabel={translateText('generated.inline.0493_back_b52b36b7')}
      onBack={() => navigate({ to: '..' })}
      showSearch={activeTab !== 'roles' && activeTab !== 'composition'}
      searchQuery={participantSearchQuery}
      onSearchQueryChange={setParticipantSearchQuery}
      searchPlaceholder={translateText('generated.inline.0494_search_participants_1b38c2ef')}
    >
      <MembershipTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
          ) : activeTab !== 'roles' ? (
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
              requests={pendingRequests}
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
            />
            <PendingInvitationsTable
              invitations={pendingInvitations}
              onWithdraw={(membershipId, userId) =>
                rejectParticipation(membershipId, userId, authUser?.id ?? undefined, eventTitle)
              }
              description={translateText(
                'generated.inline.0507_users_who_have_been_invited_to_this_event_but_d947b292'
              )}
              fallbackRoleLabel={translateText('generated.inline.0506_participant_a77366e9')}
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
              title={translateText('generated.inline.0508_active_participants_8e5af26b')}
              description={translateText(
                'generated.inline.0509_current_event_participants_and_organizers_cf1218e5'
              )}
              fallbackRoleLabel={translateText('generated.inline.0506_participant_a77366e9')}
              showProvenanceColumns={showComposition}
            />
            {showOfflineRoster ? (
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
                showProvenanceColumns={showComposition}
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
            secondaryActionLabel={translateText('generated.inline.0012_manage_roles_5f9b8531')}
            entityType="event"
            countLabel={translateText('generated.inline.0057_participants_a94a46cc')}
            memberDescriptionFallback={translateText(
              'generated.inline.0115_participants_currently_assigned_to_this_role_16e23493'
            )}
            emptyStateLabel={translateText(
              'generated.inline.0116_no_participants_currently_carry_this_role_18087ba6'
            )}
            showProvenanceColumns={showComposition}
          />
        }
        compositionContent={
          <MembershipCompositionPanel
            buckets={compositionBuckets}
            isLoading={compositionIsLoading}
          />
        }
        guestsContent={
          <div className="space-y-4">
            <GuestsTable
              guests={guestParticipants}
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
            />
          </div>
        }
        rolesContent={<EventRoles eventId={eventId} />}
        showComposition={showComposition}
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
  backLabel: string;
  onBack: () => void;
  showSearch: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchPlaceholder: string;
  children: ReactNode;
}

export function EventParticipantsView({
  title,
  subtitle,
  backLabel,
  onBack,
  showSearch,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  children,
}: EventParticipantsViewProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      {showSearch ? (
        <EntitySearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          placeholder={searchPlaceholder}
          className="mb-4"
        />
      ) : null}

      {children}
    </div>
  );
}
