/**
 * Main view for managing amendment collaborators.
 */

import { useMemo, useState } from 'react';
import { EntitySearchBar } from '@/features/shared/ui/typeahead';
import { MembershipTabs } from '@/features/groups/ui/MembershipTabs';
import {
  ParticipationRoleFilterBar,
  filterParticipationsByRole,
} from '@/features/shared/ui/participation';
import { PendingRequestsTable } from '@/features/groups/ui/PendingRequestsTable';
import { PendingInvitationsTable } from '@/features/groups/ui/PendingInvitationsTable';
import { ActiveMembersTable } from '@/features/groups/ui/ActiveMembersTable';
import { MembershipsByRoleTables } from '@/features/groups/ui/MembershipsByRoleTables';
import { ChangeRoleDialog } from '@/features/groups/ui/ChangeRoleDialog';
import { MemberRightsDialog } from '@/features/groups/ui/MemberRightsDialog';
import type {
  MembershipSort,
  MembershipSortField,
  MembershipTab,
} from '@/features/groups/types/group.types';
import { InviteDialog } from './InviteDialog.tsx';
import { RolesManagementCard } from './RolesManagementCard.tsx';
import type { Collaborator, Role } from '../hooks/useCollaborators';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ManagementToolbar, SettingsPage } from '@/features/shared/ui/form';
import { queries } from '@/zero/queries';

interface CollaboratorsViewProps {
  activeCollaborators: Collaborator[];
  activeTab: MembershipTab;
  amendmentId: string;
  amendmentTitle: string;
  collaborators: Collaborator[];
  changeRoleMembership: Collaborator | null;
  changeRoleOpen: boolean;
  memberRightsMembership: Collaborator | null;
  memberRightsOpen: boolean;
  membershipSort: MembershipSort;
  onActiveTabChange: (tab: MembershipTab) => void;
  onApproveRequest: (membershipId: string, userId: string) => void | Promise<void>;
  onChangeRoleOpenChange: (open: boolean) => void;
  onConfirmRoleChange: (newRoleIds: string[]) => void | Promise<void>;
  onCreateRole: (name: string, description: string, amendmentId: string) => void | Promise<void>;
  onDeleteRole: (roleId: string) => void | Promise<void>;
  onInviteUsers: (userIds: string[], amendmentId: string, roleId: string) => void | Promise<void>;
  onMemberRightsOpenChange: (open: boolean) => void;
  onMembershipSortChange: (field: MembershipSortField) => void;
  onNavigateToUser: (userId: string) => void;
  onOpenChangeRoleDialog: (membership: Collaborator) => void;
  onOpenMemberRightsDialog: (membership: Collaborator) => void;
  onRejectRequest: (membershipId: string, userId: string) => void | Promise<void>;
  onRemoveCollaborator: (membershipId: string, userId: string) => void | Promise<void>;
  onRemoveRoleFromByRoleView: (membership: Collaborator, roleId: string) => void | Promise<void>;
  onSearchQueryChange: (query: string) => void;
  onToggleActionRight: (
    roleId: string,
    resource: string,
    action: string,
    currentlyHas: boolean,
    roles: Role[],
    amendmentId: string
  ) => void | Promise<void>;
  onWithdrawInvitation: (membershipId: string, userId: string) => void | Promise<void>;
  pendingInvitations: Collaborator[];
  pendingRequests: Collaborator[];
  roles: Role[];
  searchQuery: string;
}

export function CollaboratorsView({
  activeCollaborators,
  activeTab,
  amendmentId,
  amendmentTitle,
  collaborators = [],
  changeRoleMembership,
  changeRoleOpen,
  memberRightsMembership,
  memberRightsOpen,
  membershipSort,
  onActiveTabChange,
  onApproveRequest,
  onChangeRoleOpenChange,
  onConfirmRoleChange,
  onCreateRole,
  onDeleteRole,
  onInviteUsers,
  onMemberRightsOpenChange,
  onMembershipSortChange,
  onNavigateToUser,
  onOpenChangeRoleDialog,
  onOpenMemberRightsDialog,
  onRejectRequest,
  onRemoveCollaborator,
  onRemoveRoleFromByRoleView,
  onSearchQueryChange,
  onToggleActionRight,
  onWithdrawInvitation,
  pendingInvitations,
  pendingRequests,
  roles,
  searchQuery,
}: CollaboratorsViewProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const showCollaboratorFilters = activeTab !== 'roles' && roles.length > 0;
  const roleFilterRoleIds = useMemo(
    () => new Set(roles.map(role => role.id).filter(Boolean)),
    [roles]
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
  const filteredActiveCollaborators = useMemo(
    () => filterParticipationsByRole(activeCollaborators, activeRoleFilterIds),
    [activeCollaborators, activeRoleFilterIds]
  );
  const collaboratorRowsById = useMemo(
    () => new Map(collaborators.map(collaborator => [collaborator.id, collaborator])),
    [collaborators]
  );
  const collaboratorVirtualSources = useMemo(() => {
    const makeSource = (statuses: string[], suffix: string, roleIds = activeRoleFilterIds) => ({
      context: { amendmentId, statuses, query: searchQuery, roleIds },
      historyKey: `amendment-${amendmentId}-collaborators-${suffix}`,
      getPageQuery: ({ limit, start, dir, settled }: any) => ({
        query: queries.amendments.collaboratorPage({
          amendmentId,
          statuses,
          roleIds,
          query: searchQuery,
          limit,
          start,
          dir,
        }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getSingleQuery: ({ id, settled }: any) => ({
        query: queries.amendments.collaboratorById({ id }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getRowKey: (row: any) => row.id,
      toStartRow: (row: any) => ({ created_at: row.created_at, id: row.id }),
      mapRow: (row: any) => collaboratorRowsById.get(row.id) ?? row,
    });
    return {
      requested: makeSource(['requested'], 'requested'),
      invited: makeSource(['invited'], 'invited'),
      active: makeSource(['active', 'member', 'admin', 'collaborator'], 'active'),
      byRole: (roleId: string) =>
        makeSource(['active', 'member', 'admin', 'collaborator'], `role-${roleId}`, [roleId]),
    };
  }, [activeRoleFilterIds, amendmentId, collaboratorRowsById, searchQuery]);

  return (
    <SettingsPage
      title={translateText('generated.inline.0097_manage_amendment_collaborators_1a87c60d')}
      description={`${amendmentTitle}${translateText(
        'generated.inline.0098_manage_collaborators_requests_and_invitations_b304a0db'
      )}`}
      size="wide"
      headingMode="sr-only"
    >
      {activeTab !== 'roles' ? (
        <ManagementToolbar className="mb-6">
          <EntitySearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            placeholder={translateText(
              'generated.inline.0099_search_collaborators_by_name_role_or_status_c0a4b06d'
            )}
            className="flex-1"
          />
          {showCollaboratorFilters ? (
            <ParticipationRoleFilterBar
              roles={roles}
              selectedRoleIds={activeRoleFilterIds}
              onSelectedRoleIdsChange={setSelectedRoleIds}
            />
          ) : null}
        </ManagementToolbar>
      ) : null}

      <MembershipTabs
        activeTab={activeTab}
        onTabChange={onActiveTabChange}
        showGuests={false}
        membershipsByUserLabel={translateText(
          'generated.inline.0100_participants_by_user_99abf1d2'
        )}
        membershipsByRoleLabel={translateText(
          'generated.inline.0101_participants_by_role_79dd6508'
        )}
        tabBarAction={
          activeTab !== 'roles' ? (
            <InviteDialog
              amendmentId={amendmentId}
              existingCollaborators={collaborators}
              roles={roles}
              onInviteUsers={onInviteUsers}
            />
          ) : null
        }
        membershipsByUserContent={
          <div className="space-y-4">
            <PendingRequestsTable
              requests={filteredPendingRequests}
              virtualSource={collaboratorVirtualSources.requested}
              onApprove={onApproveRequest}
              onReject={onRejectRequest}
              title={translateText('generated.inline.0102_pending_collaboration_requests_59419bb4')}
              description={translateText(
                'generated.inline.0103_review_and_approve_collaboration_requests_0cd489d8'
              )}
              roleColumnLabel={translateText('generated.inline.0010_requested_role_599518e7')}
              fallbackRoleLabel={translateText('generated.inline.0104_collaborator_794b34c1')}
              secondaryActionLabel={translateText('generated.inline.0011_decline_b59cf9ed')}
            />
            <PendingInvitationsTable
              invitations={filteredPendingInvitations}
              virtualSource={collaboratorVirtualSources.invited}
              onWithdraw={onWithdrawInvitation}
              description={translateText(
                'generated.inline.0105_users_who_have_been_invited_to_this_amendment_525eacce'
              )}
              fallbackRoleLabel={translateText('generated.inline.0104_collaborator_794b34c1')}
            />
            <ActiveMembersTable
              members={filteredActiveCollaborators}
              virtualSource={collaboratorVirtualSources.active}
              sort={membershipSort}
              onSortChange={onMembershipSortChange}
              onOpenRightsDialog={onOpenMemberRightsDialog}
              onOpenChangeRoleDialog={onOpenChangeRoleDialog}
              onRemove={onRemoveCollaborator}
              title={translateText('generated.inline.0106_active_collaborators_6a0c51e8')}
              description={translateText(
                'generated.inline.0088_current_amendment_collaborators_and_administr_a73f4579'
              )}
              fallbackRoleLabel={translateText('generated.inline.0104_collaborator_794b34c1')}
              manageRolesLabel={translateText('generated.inline.0012_manage_roles_5f9b8531')}
            />
          </div>
        }
        membershipsByRoleContent={
          <MembershipsByRoleTables
            roles={roles}
            members={filteredActiveCollaborators}
            onOpenRightsDialog={onOpenMemberRightsDialog}
            onRemoveRole={onRemoveRoleFromByRoleView}
            onSecondaryAction={onOpenChangeRoleDialog}
            secondaryActionLabel={translateText('generated.inline.0012_manage_roles_5f9b8531')}
            entityType="amendment"
            countLabel={translateText('generated.inline.0014_collaborators_8a37fa6f')}
            memberDescriptionFallback={translateText(
              'generated.inline.0013_collaborators_currently_assigned_to_this_role_37977ca0'
            )}
            emptyStateLabel={translateText(
              'generated.inline.0014_no_collaborators_currently_carry_this_role_c0b5b930'
            )}
            hideEmptyRoleSections={activeRoleFilterIds.length > 0}
            getVirtualSource={collaboratorVirtualSources.byRole}
          />
        }
        rolesContent={
          <RolesManagementCard
            amendmentId={amendmentId}
            roles={roles}
            onCreateRole={onCreateRole}
            onDeleteRole={onDeleteRole}
            onToggleActionRight={onToggleActionRight}
          />
        }
      />

      <MemberRightsDialog
        isOpen={memberRightsOpen}
        onOpenChange={onMemberRightsOpenChange}
        membership={memberRightsMembership}
        onNavigateToUser={onNavigateToUser}
        entityType="amendment"
        contextLabel={translateText('generated.inline.0015_amendment_61b2c1cd')}
        fallbackRoleLabel={translateText('generated.inline.0104_collaborator_794b34c1')}
      />

      <ChangeRoleDialog
        isOpen={changeRoleOpen}
        onOpenChange={onChangeRoleOpenChange}
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
        roles={roles}
        onConfirm={onConfirmRoleChange}
        title={translateText('generated.inline.0107_manage_collaborator_roles_f0c3f76e')}
      />
    </SettingsPage>
  );
}
