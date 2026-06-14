import { type ReactNode } from 'react';
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
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  return (
    <GroupMembershipsPageView
      title={t('features.groups.memberships.manage')}
      showSearch={
        canManageMembers &&
        activeTab !== 'roles' &&
        activeTab !== 'composition' &&
        activeTab !== 'rightsAlignment' &&
        activeTab !== 'openAssignments'
      }
      searchQuery={memberSearchQuery}
      onSearchQueryChange={setMemberSearchQuery}
      searchPlaceholder={t('features.groups.memberships.searchPlaceholder')}
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
              requests={pendingRequests}
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
              invitations={pendingInvitations}
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
              members={activeMembers}
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
                serverConfirmed(
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
                serverConfirmed(
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
                serverConfirmed(
                  updateOfflineMember({
                    id: row.id,
                    connected_user_id: userId,
                    debug_correlation_id: correlationId,
                  })
                )
              }
              onEdit={(row, entry, correlationId) =>
                serverConfirmed(
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
                serverConfirmed(
                  deleteOfflineMember({
                    id: row.id,
                    debug_correlation_id: correlationId,
                  })
                )
              }
            />
          </div>
        }
        membershipsByRoleContent={
          <div className="space-y-4">
            <MembershipsByRoleTables
              roles={[...memberRoles]}
              members={membershipsByRoleMembers}
              onOpenRightsDialog={handleOpenMemberRights}
              onRemoveRole={handleRemoveRoleFromMembershipTypeView}
              onSecondaryAction={handleOpenChangeRoleDialog}
              secondaryActionLabel={translateText('generated.inline.0012_manage_roles_5f9b8531')}
              showProvenanceColumns={showComposition}
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
            onScheduleRoleRenewal={scheduleRoleRenewal}
            onScheduleDelegateElection={scheduleDelegateElection}
            onScheduleProcessTask={scheduleProcessTask}
          />
        }
        guestsContent={
          <div className="space-y-4">
            <GuestsTable
              guests={[...requestedGuestAccesses, ...activeGuestAccesses, ...invitedGuestAccesses]}
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
          <>
            <RoleDetailsTable
              roles={groupRoleHook.roles}
              onEdit={handleOpenEditRole}
              onDelete={roleId => groupRoleHook.actions.delete(roleId)}
              onAssignHolder={groupRoleHook.actions.openAssignHolder}
              onViewHistory={groupRoleHook.actions.openHistory}
              onCreateElection={roleId => groupRoleHook.actions.createElection(roleId)}
              addRoleButton={
                <AddRoleDialog
                  isOpen={addRoleOpen}
                  onOpenChange={setAddRoleOpen}
                  form={newRoleForm}
                  onFormChange={patch =>
                    setNewRoleForm((current: any) => ({ ...current, ...patch }))
                  }
                  onSubmit={handleAddRole}
                  guestOnlyMembershipFlow={guestOnlyMembershipFlow}
                />
              }
            />
            <RolesPermissionsTable
              roles={[...accessRoles]}
              onTogglePermission={handleTogglePermission}
              onReorderRoles={reorderRoles}
            />
          </>
        }
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
                .join(' ') || 'Unknown User'
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
        title={editingRole?.name ? `Edit ${editingRole.name}` : 'Edit Role'}
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
  children: ReactNode;
}

export function GroupMembershipsPageView({
  title,
  showSearch,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  children,
}: GroupMembershipsPageViewProps) {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">{title}</h1>

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
