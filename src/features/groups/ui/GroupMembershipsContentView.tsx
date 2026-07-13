import { useMemo, useState, type ReactNode } from 'react';
import { MembershipTabs } from '@/features/groups/ui/MembershipTabs';
import { ActiveMembersTable } from '@/features/groups/ui/ActiveMembersTable';
import { MembershipsByRoleTables } from '@/features/groups/ui/MembershipsByRoleTables';
import { MembershipCompositionPanel } from '@/features/groups/ui/MembershipCompositionPanel';
import { MembershipRightsAlignmentPanel } from '@/features/groups/ui/MembershipRightsAlignmentPanel';
import { OpenAssignmentsPanel } from '@/features/groups/ui/OpenAssignmentsPanel';
import { PendingRequestsTable } from '@/features/groups/ui/PendingRequestsTable';
import { PendingInvitationsTable } from '@/features/groups/ui/PendingInvitationsTable';
import { InviteMembersDialog } from '@/features/groups/ui/InviteMembersDialog';
import { GuestsTable } from '@/features/groups/ui/GuestsTable';
import { ChangeRoleDialog } from '@/features/groups/ui/ChangeRoleDialog';
import { MemberRightsDialog } from '@/features/groups/ui/MemberRightsDialog';
import { RolesPermissionsTable } from '@/features/groups/ui/RolesPermissionsTable';
import { RoleDetailsTable } from '@/features/groups/ui/RoleDetailsTable';
import { AddRoleDialog } from '@/features/groups/ui/AddRoleDialog';
import { AssignHolderDialog } from '@/features/groups/ui/AssignHolderDialog';
import { OfflineRosterCard } from '@/features/offline-roster/ui/OfflineRosterCard';
import { RoleHolderHistoryDialog } from '@/features/roles/ui/RoleHolderHistoryDialog';
import { EntitySearchBar } from '@/features/shared/ui/typeahead';
import {
  ParticipationRoleFilterBar,
  filterParticipationsByRole,
  getParticipationDisplayRoles,
} from '@/features/shared/ui/participation';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ManagementToolbar, SettingsPage } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { Plus } from 'lucide-react';
import { queries } from '@/zero/queries';

export interface GroupMembershipsContentViewProps {
  accessRoles: any;
  activeGuestAccesses: any;
  activeMembers: any;
  activeTab: any;
  addRoleOpen: any;
  allUserRows: any;
  approveGuestAccess: any;
  approveMembership: any;
  assignmentsAreLoading: any;
  assignmentsAreScheduling: any;
  authUser: any;
  availableEvents: any;
  canManageAssignments: any;
  canManageMembers: any;
  changeRoleMembership: any;
  changeRoleOpen: any;
  compositionBuckets: any;
  compositionIsLoading: any;
  connectedUserCandidates: any;
  createOfflineMember: any;
  deleteOfflineMember: any;
  editingRole: any;
  editRoleForm: any;
  editRoleOpen: any;
  existingMemberIds: any;
  focusAssignmentId?: string;
  group: any;
  groupId: any;
  groupName: any;
  groupRoleHook: any;
  guestOnlyMembershipFlow: any;
  guestRoles: any;
  handleAddRole: any;
  handleConfirmRoleChange: any;
  handleInvite: any;
  handleInviteGuests: any;
  handleMembershipSortChange: any;
  handleOpenChangeRoleDialog: any;
  handleOpenEditRole: any;
  handleOpenMemberRights: any;
  handleRemoveRoleFromMembershipTypeView: any;
  handleSaveEditedRole: any;
  handleTogglePermission: any;
  importOfflineMembers: any;
  invitedGuestAccesses: any;
  inviteMembershipPreflight: any;
  inviteOpen: any;
  isInviting: any;
  isInvitingGuests: any;
  memberRightsMembership: any;
  memberRightsOpen: any;
  memberRoles: any;
  memberSearchQuery: any;
  membershipsByRoleMembers: any;
  membershipSort: any;
  navigate: any;
  newRoleForm: any;
  offlineMembershipsById: any;
  openAssignments: any;
  pendingInvitations: any;
  pendingRequests: any;
  rejectMembership: any;
  removeMember: any;
  reorderRoles: any;
  requestedGuestAccesses: any;
  revokeGuest: any;
  rightsAlignmentRows: any;
  scheduleDelegateElection: any;
  scheduleProcessTask: any;
  scheduleRoleRenewal: any;
  selectedGuestRoleIds: any;
  selectedGuestUserIds: any;
  selectedInviteRoleIds: any;
  selectedUserIds: any;
  setActiveTab: any;
  setAddRoleOpen: any;
  setChangeRoleOpen: any;
  setEditingRole: any;
  setEditRoleForm: any;
  setEditRoleOpen: any;
  setInviteOpen: any;
  setMemberRightsOpen: any;
  setMemberSearchQuery: any;
  setNewRoleForm: any;
  setSelectedGuestRoleIds: any;
  setSelectedGuestUserIds: any;
  setSelectedInviteRoleIds: any;
  setSelectedUserIds: any;
  showComposition: any;
  showRightsAlignment: any;
  t: any;
  updateOfflineMember: any;
}

export function GroupMembershipsContentView({
  accessRoles,
  activeGuestAccesses,
  activeMembers,
  activeTab,
  addRoleOpen,
  allUserRows,
  approveGuestAccess,
  approveMembership,
  assignmentsAreLoading,
  assignmentsAreScheduling,
  authUser,
  availableEvents,
  canManageAssignments,
  canManageMembers,
  changeRoleMembership,
  changeRoleOpen,
  compositionBuckets,
  compositionIsLoading,
  connectedUserCandidates,
  createOfflineMember,
  deleteOfflineMember,
  editingRole,
  editRoleForm,
  editRoleOpen,
  existingMemberIds,
  focusAssignmentId,
  group,
  groupId,
  groupName,
  groupRoleHook,
  guestOnlyMembershipFlow,
  guestRoles,
  handleAddRole,
  handleConfirmRoleChange,
  handleInvite,
  handleInviteGuests,
  handleMembershipSortChange,
  handleOpenChangeRoleDialog,
  handleOpenEditRole,
  handleOpenMemberRights,
  handleRemoveRoleFromMembershipTypeView,
  handleSaveEditedRole,
  handleTogglePermission,
  importOfflineMembers,
  invitedGuestAccesses,
  inviteMembershipPreflight,
  inviteOpen,
  isInviting,
  isInvitingGuests,
  memberRightsMembership,
  memberRightsOpen,
  memberRoles,
  memberSearchQuery,
  membershipsByRoleMembers,
  membershipSort,
  navigate,
  newRoleForm,
  offlineMembershipsById,
  openAssignments,
  pendingInvitations,
  pendingRequests,
  rejectMembership,
  removeMember,
  reorderRoles,
  requestedGuestAccesses,
  revokeGuest,
  rightsAlignmentRows,
  scheduleDelegateElection,
  scheduleProcessTask,
  scheduleRoleRenewal,
  selectedGuestRoleIds,
  selectedGuestUserIds,
  selectedInviteRoleIds,
  selectedUserIds,
  setActiveTab,
  setAddRoleOpen,
  setChangeRoleOpen,
  setEditingRole,
  setEditRoleForm,
  setEditRoleOpen,
  setInviteOpen,
  setMemberRightsOpen,
  setMemberSearchQuery,
  setNewRoleForm,
  setSelectedGuestRoleIds,
  setSelectedGuestUserIds,
  setSelectedInviteRoleIds,
  setSelectedUserIds,
  showComposition,
  showRightsAlignment,
  t,
  updateOfflineMember,
}: GroupMembershipsContentViewProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleConfigurationTab, setRoleConfigurationTab] = useState<'roles' | 'actionRights'>(
    'roles'
  );
  const showMembershipSearch =
    canManageMembers &&
    activeTab !== 'roles' &&
    activeTab !== 'composition' &&
    activeTab !== 'rightsAlignment' &&
    activeTab !== 'openAssignments';
  const displayMemberRoles = useMemo(() => {
    const roleById = new Map<string, any>();
    const addRole = (role: any) => {
      if (role?.id && !roleById.has(role.id)) {
        roleById.set(role.id, role);
      }
    };

    memberRoles.forEach(addRole);
    [...activeMembers, ...membershipsByRoleMembers].forEach((membership: any) =>
      getParticipationDisplayRoles(membership).forEach(addRole)
    );

    return [...roleById.values()].sort(
      (left, right) =>
        (right.sort_order ?? -1) - (left.sort_order ?? -1) ||
        (left.name ?? '').localeCompare(right.name ?? '', undefined, { sensitivity: 'base' })
    );
  }, [activeMembers, memberRoles, membershipsByRoleMembers]);
  const roleFilterRoles = useMemo(
    () => (activeTab === 'guests' ? [...guestRoles] : [...displayMemberRoles]),
    [activeTab, displayMemberRoles, guestRoles]
  );
  const roleFilterRoleIds = useMemo(
    () => new Set(roleFilterRoles.map((role: any) => role.id).filter(Boolean)),
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
  const filteredActiveMembers = useMemo(
    () => filterParticipationsByRole(activeMembers, activeRoleFilterIds),
    [activeMembers, activeRoleFilterIds]
  );
  const filteredMembershipsByRoleMembers = useMemo(
    () => filterParticipationsByRole(membershipsByRoleMembers, activeRoleFilterIds),
    [activeRoleFilterIds, membershipsByRoleMembers]
  );
  const filteredGuestAccesses = useMemo(
    () =>
      filterParticipationsByRole(
        [...requestedGuestAccesses, ...activeGuestAccesses, ...invitedGuestAccesses],
        activeRoleFilterIds
      ),
    [activeGuestAccesses, activeRoleFilterIds, invitedGuestAccesses, requestedGuestAccesses]
  );
  const membershipRowsById = useMemo(
    () =>
      new Map(
        [...activeMembers, ...pendingRequests, ...pendingInvitations].map((membership: any) => [
          membership.id,
          membership,
        ])
      ),
    [activeMembers, pendingInvitations, pendingRequests]
  );
  const membershipVirtualSources = useMemo(() => {
    const makeSource = (statuses: string[], suffix: string, roleIds = activeRoleFilterIds) => ({
      context: { groupId, statuses, query: memberSearchQuery, roleIds },
      historyKey: `group-${groupId}-memberships-${suffix}`,
      getPageQuery: ({ limit, start, dir, settled }: any) => ({
        query: queries.groups.membershipPage({
          groupId,
          statuses,
          roleIds,
          query: memberSearchQuery,
          limit,
          start,
          dir,
        }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getSingleQuery: ({ id, settled }: any) => ({
        query: queries.groups.membershipById({ id }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getRowKey: (row: any) => row.id,
      toStartRow: (row: any) => ({ created_at: row.created_at, id: row.id }),
      mapRow: (row: any) => membershipRowsById.get(row.id) ?? row,
    });
    return {
      requested: makeSource(['requested'], 'requested'),
      invited: makeSource(['invited'], 'invited'),
      active: makeSource(['active', 'member', 'admin', 'confirmed', 'owner'], 'active'),
      byRole: (roleId: string) =>
        makeSource(['active', 'member', 'admin', 'confirmed', 'owner'], `role-${roleId}`, [roleId]),
    };
  }, [activeRoleFilterIds, groupId, memberSearchQuery, membershipRowsById]);
  const guestRowsById = useMemo(
    () => new Map(filteredGuestAccesses.map((guest: any) => [guest.id, guest])),
    [filteredGuestAccesses]
  );
  const guestVirtualSource = useMemo(
    () => ({
      context: {
        groupId,
        statuses: ['requested', 'invited', 'active'],
        query: memberSearchQuery,
        roleIds: activeRoleFilterIds,
      },
      historyKey: `group-${groupId}-guest-accesses`,
      getPageQuery: ({ limit, start, dir, settled }: any) => ({
        query: queries.groups.guestAccessPage({
          groupId,
          statuses: ['requested', 'invited', 'active'],
          roleIds: activeRoleFilterIds,
          query: memberSearchQuery,
          limit,
          start,
          dir,
        }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getSingleQuery: ({ id, settled }: any) => ({
        query: queries.groups.guestAccessById({ id }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getRowKey: (row: any) => row.id,
      toStartRow: (row: any) => ({ created_at: row.created_at, id: row.id }),
      mapRow: (row: any) => guestRowsById.get(row.id) ?? row,
    }),
    [activeRoleFilterIds, groupId, guestRowsById, memberSearchQuery]
  );
  const roleFilterContent =
    showMembershipSearch && roleFilterRoles.length > 0 ? (
      <ParticipationRoleFilterBar
        roles={roleFilterRoles}
        selectedRoleIds={activeRoleFilterIds}
        onSelectedRoleIdsChange={setSelectedRoleIds}
      />
    ) : null;

  return (
    <GroupMembershipsPageView
      title={t('features.groups.memberships.manage')}
      showSearch={showMembershipSearch}
      searchQuery={memberSearchQuery}
      onSearchQueryChange={setMemberSearchQuery}
      searchPlaceholder={t('features.groups.memberships.searchPlaceholder')}
      secondaryFilterContent={roleFilterContent}
    >
      <MembershipTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabBarAction={
          !canManageMembers ? null : activeTab === 'guests' ? (
            <InviteMembersDialog
              isOpen={inviteOpen}
              onOpenChange={setInviteOpen}
              selectedUsers={selectedGuestUserIds}
              onSelectedUsersChange={setSelectedGuestUserIds}
              excludeUserIds={[
                ...existingMemberIds,
                ...activeGuestAccesses
                  .map((guestAccess: any) => guestAccess.user?.id)
                  .filter((userId: any): userId is string => Boolean(userId)),
              ]}
              excludeUserId={authUser?.id}
              roles={[...guestRoles]}
              selectedRoleIds={selectedGuestRoleIds}
              onSelectedRoleIdsChange={setSelectedGuestRoleIds}
              onInvite={handleInviteGuests}
              isInviting={isInvitingGuests}
              triggerLabel={t('features.groups.memberships.inviteGuest')}
              dialogTitle={t('features.groups.memberships.inviteGuests')}
              dialogDescription={t('features.groups.memberships.inviteGuestsDescription')}
              roleSectionDescription={t('features.groups.memberships.inviteGuestsRoleDescription')}
              emptyRolesLabel={t('features.groups.memberships.inviteGuestsEmptyRoles')}
            />
          ) : activeTab === 'membershipsByUser' || activeTab === 'membershipsByRole' ? (
            <InviteMembersDialog
              isOpen={inviteOpen}
              onOpenChange={setInviteOpen}
              selectedUsers={guestOnlyMembershipFlow ? selectedGuestUserIds : selectedUserIds}
              onSelectedUsersChange={
                guestOnlyMembershipFlow ? setSelectedGuestUserIds : setSelectedUserIds
              }
              excludeUserIds={
                guestOnlyMembershipFlow
                  ? [
                      ...existingMemberIds,
                      ...activeGuestAccesses
                        .map((guestAccess: any) => guestAccess.user?.id)
                        .filter((userId: any): userId is string => Boolean(userId)),
                      ...requestedGuestAccesses
                        .map((guestAccess: any) => guestAccess.user?.id)
                        .filter((userId: any): userId is string => Boolean(userId)),
                      ...invitedGuestAccesses
                        .map((guestAccess: any) => guestAccess.user?.id)
                        .filter((userId: any): userId is string => Boolean(userId)),
                    ]
                  : existingMemberIds
              }
              excludeUserId={authUser?.id}
              roles={guestOnlyMembershipFlow ? [...guestRoles] : [...memberRoles]}
              selectedRoleIds={
                guestOnlyMembershipFlow ? selectedGuestRoleIds : selectedInviteRoleIds
              }
              onSelectedRoleIdsChange={
                guestOnlyMembershipFlow ? setSelectedGuestRoleIds : setSelectedInviteRoleIds
              }
              onInvite={guestOnlyMembershipFlow ? handleInviteGuests : handleInvite}
              isInviting={guestOnlyMembershipFlow ? isInvitingGuests : isInviting}
              submitDisabled={!guestOnlyMembershipFlow && inviteMembershipPreflight.blocking}
              submitDisabledReason={
                !guestOnlyMembershipFlow && inviteMembershipPreflight.blocking
                  ? (inviteMembershipPreflight.response.summary ??
                    inviteMembershipPreflight.response.conflicts[0]?.summary ??
                    'Diese Einladung ist aktuell blockiert.')
                  : undefined
              }
              submitConflictResponse={
                !guestOnlyMembershipFlow && inviteMembershipPreflight.blocking
                  ? inviteMembershipPreflight.response
                  : null
              }
              submitConflictLoading={
                !guestOnlyMembershipFlow && inviteMembershipPreflight.isLoading
              }
              disabled={group?.group_type === 'hierarchical'}
              disabledReason="Members join through subgroups"
              triggerLabel={
                guestOnlyMembershipFlow
                  ? t('features.groups.memberships.inviteGuest')
                  : t('features.groups.memberships.invite')
              }
              dialogTitle={
                guestOnlyMembershipFlow
                  ? t('features.groups.memberships.inviteGuests')
                  : t('features.groups.memberships.inviteMembers')
              }
              dialogDescription={
                guestOnlyMembershipFlow
                  ? t('features.groups.memberships.guestOnlyInviteDescription')
                  : t('features.groups.memberships.inviteMembersDescription')
              }
              roleSectionDescription={
                guestOnlyMembershipFlow
                  ? t('features.groups.memberships.guestOnlyRoleDescription')
                  : t('features.groups.memberships.inviteRoleDescription')
              }
              emptyRolesLabel={
                guestOnlyMembershipFlow
                  ? t('features.groups.memberships.guestOnlyEmptyRoles')
                  : t('features.groups.memberships.inviteMembersEmptyRoles')
              }
            />
          ) : null
        }
        showMembershipsByUser={canManageMembers}
        showMembershipsByRole={canManageMembers}
        membershipsByUserContent={
          <div className="space-y-4">
            <PendingRequestsTable
              requests={filteredPendingRequests}
              virtualSource={membershipVirtualSources.requested}
              getApprovePreflightInput={membership => ({
                kind: 'membership_activation',
                membership_id: membership.id,
              })}
              onApprove={(membershipId, userId) => {
                console.info('Accept button clicked in memberships.tsx', {
                  flow: 'group-membership-request-approve',
                  membershipId,
                  groupId,
                  actorUserId: authUser?.id ?? null,
                  membershipUserId: userId,
                });

                return approveMembership(
                  membershipId,
                  userId,
                  undefined,
                  authUser?.id ?? undefined,
                  undefined,
                  groupName
                );
              }}
              onReject={(membershipId, userId) => {
                console.info('Delete button clicked', {
                  flow: 'group-membership-request-reject',
                  membershipId,
                  groupId,
                  actorUserId: authUser?.id ?? null,
                  membershipUserId: userId,
                });

                return rejectMembership(
                  membershipId,
                  userId,
                  authUser?.id ?? undefined,
                  undefined,
                  groupName
                );
              }}
            />
            <PendingInvitationsTable
              invitations={filteredPendingInvitations}
              virtualSource={membershipVirtualSources.invited}
              onWithdraw={(membershipId, userId) => {
                console.info('Delete button clicked', {
                  flow: 'group-membership-invitation-withdraw',
                  membershipId,
                  groupId,
                  actorUserId: authUser?.id ?? null,
                  membershipUserId: userId,
                });

                return rejectMembership(
                  membershipId,
                  userId,
                  authUser?.id ?? undefined,
                  undefined,
                  groupName
                );
              }}
            />
            <ActiveMembersTable
              members={filteredActiveMembers}
              virtualSource={membershipVirtualSources.active}
              sort={membershipSort}
              onSortChange={handleMembershipSortChange}
              onOpenRightsDialog={handleOpenMemberRights}
              onOpenChangeRoleDialog={handleOpenChangeRoleDialog}
              showProvenanceColumns={showComposition}
              onRemove={(membershipId, userId) => {
                console.info('Delete button clicked', {
                  flow: 'group-member-remove',
                  membershipId,
                  groupId,
                  actorUserId: authUser?.id ?? null,
                  membershipUserId: userId,
                });

                return removeMember(
                  membershipId,
                  userId,
                  undefined,
                  authUser?.id ?? undefined,
                  undefined,
                  groupName
                );
              }}
            />
            {activeRoleFilterIds.length === 0 ? (
              <OfflineRosterCard
                title={t('features.groups.memberships.offlineRoster.title')}
                description={t('features.groups.memberships.offlineRoster.description')}
                rows={allUserRows}
                connectedUserCandidates={connectedUserCandidates}
                tableVariant="membership"
                fallbackRoleLabel={translateText('generated.inline.1266_no_user_role_c1541334')}
                showManageButton={canManageMembers && !showComposition}
                showProvenanceColumns={showComposition}
                onOpenRightsDialog={row => {
                  if (!row.effectiveMembershipId) {
                    return;
                  }

                  const membership = offlineMembershipsById.get(row.effectiveMembershipId);
                  if (membership) {
                    handleOpenMemberRights(membership);
                  }
                }}
                onOpenChangeRoleDialog={row => {
                  if (!row.effectiveMembershipId) {
                    return;
                  }

                  const membership = offlineMembershipsById.get(row.effectiveMembershipId);
                  if (membership) {
                    handleOpenChangeRoleDialog(membership);
                  }
                }}
                manageDialogTitle={t('features.groups.memberships.offlineRoster.manageDialogTitle')}
                manageDialogDescription={t(
                  'features.groups.memberships.offlineRoster.manageDialogDescription'
                )}
                onCreate={(entry, correlationId) =>
                  waitForClientApply(
                    createOfflineMember({
                      id: crypto.randomUUID(),
                      group_id: groupId,
                      first_name: entry.firstName,
                      last_name: entry.lastName,
                      reason_not_signed_up: entry.reasonNotSignedUp || null,
                      connected_user_id: null,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onImport={(entries, correlationId) =>
                  waitForClientApply(
                    importOfflineMembers({
                      group_id: groupId,
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
                    updateOfflineMember({
                      id: row.id,
                      connected_user_id: userId,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
                onEdit={(row, entry, correlationId) =>
                  waitForClientApply(
                    updateOfflineMember({
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
                    deleteOfflineMember({
                      id: row.id,
                      debug_correlation_id: correlationId,
                    })
                  )
                }
              />
            ) : null}
          </div>
        }
        membershipsByRoleContent={
          <div className="space-y-4">
            <MembershipsByRoleTables
              roles={[...displayMemberRoles]}
              members={filteredMembershipsByRoleMembers}
              onOpenRightsDialog={handleOpenMemberRights}
              onRemoveRole={handleRemoveRoleFromMembershipTypeView}
              onSecondaryAction={handleOpenChangeRoleDialog}
              secondaryActionLabel={translateText('generated.inline.0012_manage_roles_5f9b8531')}
              showProvenanceColumns={showComposition}
              hideEmptyRoleSections
              getVirtualSource={membershipVirtualSources.byRole}
            />
          </div>
        }
        compositionContent={
          <MembershipCompositionPanel
            buckets={compositionBuckets}
            isLoading={compositionIsLoading}
          />
        }
        rightsAlignmentContent={
          <MembershipRightsAlignmentPanel
            rows={rightsAlignmentRows}
            isLoading={compositionIsLoading}
            onOpenRightsDialog={handleOpenMemberRights}
            onOpenChangeRoleDialog={handleOpenChangeRoleDialog}
          />
        }
        openAssignmentsContent={
          <OpenAssignmentsPanel
            groupId={groupId}
            groupName={group?.name}
            assignments={openAssignments}
            availableEvents={availableEvents}
            isLoading={assignmentsAreLoading}
            isScheduling={assignmentsAreScheduling}
            focusAssignmentId={focusAssignmentId}
            onScheduleRoleRenewal={scheduleRoleRenewal}
            onScheduleDelegateElection={scheduleDelegateElection}
            onScheduleProcessTask={scheduleProcessTask}
          />
        }
        guestsContent={
          <div className="space-y-4">
            <GuestsTable
              guests={filteredGuestAccesses}
              virtualSource={guestVirtualSource}
              onApprove={guestAccessId => void approveGuestAccess(guestAccessId)}
              onRevoke={guestAccessId => void revokeGuest(guestAccessId)}
            />
          </div>
        }
        showComposition={showComposition}
        showRightsAlignment={showRightsAlignment}
        showOpenAssignments={canManageAssignments}
        membershipsByUserLabel={t('features.groups.memberships.tabs.membershipsByUser')}
        membershipsByRoleLabel={t('features.groups.memberships.tabs.membershipsByRole')}
        compositionLabel={t('features.groups.memberships.tabs.composition')}
        rightsAlignmentLabel={t('features.groups.memberships.tabs.rightsAlignment')}
        openAssignmentsLabel={t('features.groups.memberships.tabs.openAssignments')}
        guestsLabel={t('features.groups.memberships.tabs.guests')}
        rolesLabel={t('features.groups.memberships.tabs.roles')}
        showGuests={canManageMembers}
        showRoles={canManageMembers}
        rolesContent={
          <Tabs
            value={roleConfigurationTab}
            onValueChange={value =>
              setRoleConfigurationTab(value === 'actionRights' ? 'actionRights' : 'roles')
            }
            className="space-y-4"
          >
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="roles">
                {translateText('features.groups.roleConfiguration.rolesTab', 'Roles')}
              </TabsTrigger>
              <TabsTrigger value="actionRights">
                {translateText(
                  'features.groups.roleConfiguration.actionRightsTab',
                  'Action rights'
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="roles" className="mt-0">
              <RoleDetailsTable
                roles={groupRoleHook.roles}
                onEdit={handleOpenEditRole}
                onDelete={roleId => groupRoleHook.actions.delete(roleId)}
                onAssignHolder={groupRoleHook.actions.openAssignHolder}
                onViewHistory={groupRoleHook.actions.openHistory}
                onOpenElectionAssignment={roleId =>
                  navigate({
                    to: '/group/$id/memberships',
                    params: { id: groupId },
                    search: { tab: 'openAssignments', assignmentId: `role:${roleId}` },
                  })
                }
                addRoleButton={
                  <Button type="button" onClick={() => setAddRoleOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {translateText('generated.inline.0125_add_role_82d0afcc')}
                  </Button>
                }
              />
            </TabsContent>
            <TabsContent value="actionRights" className="mt-0">
              <RolesPermissionsTable
                roles={[...accessRoles]}
                onTogglePermission={handleTogglePermission}
                onReorderRoles={reorderRoles}
                addRoleButton={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8"
                    title={translateText('generated.inline.0125_add_role_82d0afcc')}
                    aria-label={translateText('generated.inline.0125_add_role_82d0afcc')}
                    onClick={() => setAddRoleOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                }
              />
            </TabsContent>
          </Tabs>
        }
      />

      <AddRoleDialog
        isOpen={addRoleOpen}
        onOpenChange={setAddRoleOpen}
        form={newRoleForm}
        onFormChange={patch => setNewRoleForm((current: any) => ({ ...current, ...patch }))}
        onSubmit={handleAddRole}
        trigger={null}
        guestOnlyMembershipFlow={guestOnlyMembershipFlow}
      />

      <MemberRightsDialog
        isOpen={memberRightsOpen}
        onOpenChange={setMemberRightsOpen}
        membership={memberRightsMembership}
        onNavigateToUser={userId => navigate({ to: '/user/$id', params: { id: userId } })}
      />

      <ChangeRoleDialog
        isOpen={changeRoleOpen}
        onOpenChange={setChangeRoleOpen}
        memberName={
          changeRoleMembership
            ? [changeRoleMembership.user?.first_name, changeRoleMembership.user?.last_name]
                .filter(Boolean)
                .join(' ') || translateText('components.memberRightsDialog.unknownUser')
            : ''
        }
        currentRoles={
          changeRoleMembership?.roles ??
          (changeRoleMembership?.role ? [changeRoleMembership.role] : [])
        }
        roles={[...memberRoles]}
        onConfirm={handleConfirmRoleChange}
      />

      <AddRoleDialog
        isOpen={editRoleOpen}
        onOpenChange={open => {
          setEditRoleOpen(open);
          if (!open) {
            setEditingRole(null);
          }
        }}
        form={editRoleForm}
        onFormChange={patch => setEditRoleForm((current: any) => ({ ...current, ...patch }))}
        onSubmit={handleSaveEditedRole}
        title={
          editingRole?.name
            ? translateText('features.groups.roleDetails.editRoleWithName', {
                roleName: editingRole.name,
              })
            : translateText('features.groups.roleDetails.editRoleTitle')
        }
        description={translateText(
          'generated.inline.1267_adjust_how_this_role_is_assigned_who_can_see__d7945376'
        )}
        submitLabel={translateText('generated.inline.1107_save_role_2f46bd88')}
        trigger={null}
        guestOnlyMembershipFlow={guestOnlyMembershipFlow}
      />

      {groupRoleHook.selectedRole ? (
        <AssignHolderDialog
          open={groupRoleHook.dialogs.assignHolder.open}
          onOpenChange={groupRoleHook.dialogs.assignHolder.setOpen}
          role={groupRoleHook.selectedRole}
          groupId={groupId}
          onAssign={(userId, reason) => {
            const selectedRole = groupRoleHook.selectedRole;
            if (!selectedRole) return Promise.resolve();
            return groupRoleHook.actions.assignHolder(selectedRole.id, userId, reason);
          }}
        />
      ) : null}

      {groupRoleHook.selectedRole ? (
        <RoleHolderHistoryDialog
          open={groupRoleHook.dialogs.history.open}
          onOpenChange={groupRoleHook.dialogs.history.setOpen}
          role={groupRoleHook.selectedRole}
        />
      ) : null}
    </GroupMembershipsPageView>
  );
}

interface GroupMembershipsPageViewProps {
  title: string;
  showSearch: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchPlaceholder: string;
  secondaryFilterContent?: ReactNode;
  children: ReactNode;
}

export function GroupMembershipsPageView({
  title,
  showSearch,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  secondaryFilterContent,
  children,
}: GroupMembershipsPageViewProps) {
  return (
    <SettingsPage title={title} size="wide" headingMode="sr-only">
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
