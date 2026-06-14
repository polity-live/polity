/**
 * Main view for managing amendment collaborators
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { EntitySearchBar } from '@/features/shared/ui/ui/entity-search-bar';
import { MembershipTabs } from '@/features/groups/ui/MembershipTabs';
import { PendingRequestsTable } from '@/features/groups/ui/PendingRequestsTable';
import { PendingInvitationsTable } from '@/features/groups/ui/PendingInvitationsTable';
import { ActiveMembersTable } from '@/features/groups/ui/ActiveMembersTable';
import { MembershipsByRoleTables } from '@/features/groups/ui/MembershipsByRoleTables';
import { ChangeRoleDialog } from '@/features/groups/ui/ChangeRoleDialog';
import { MemberRightsDialog } from '@/features/groups/ui/MemberRightsDialog';
import { useMembershipSearch } from '@/features/groups/hooks/useMembershipSearch';
import { getMembershipDisplayRoles } from '@/features/groups/logic/buildMembershipRightsSummary';
import type {
  MembershipSort,
  MembershipSortField,
  MembershipTab,
} from '@/features/groups/types/group.types';
import { useCollaborators } from '../hooks/useCollaborators';
import { useCollaboratorMutations } from '../hooks/useCollaboratorMutations';
import { InviteDialog } from './InviteDialog.tsx';
import { RolesManagementCard } from './RolesManagementCard.tsx';
import type { Collaborator } from '../hooks/useCollaborators';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface CollaboratorsViewProps {
  amendmentId: string;
  amendmentTitle: string;
  currentUserId: string | undefined;
}

export function CollaboratorsView({
  amendmentId,
  amendmentTitle,
  currentUserId,
}: CollaboratorsViewProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<MembershipTab>('membershipsByUser');
  const [membershipSort, setMembershipSort] = useState<MembershipSort>({
    field: 'user',
    direction: 'asc',
  });
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [changeRoleMembership, setChangeRoleMembership] = useState<Collaborator | null>(null);
  const [memberRightsOpen, setMemberRightsOpen] = useState(false);
  const [memberRightsMembership, setMemberRightsMembership] = useState<Collaborator | null>(null);

  const { collaborators, roles } = useCollaborators(amendmentId, currentUserId, '');

  const {
    activeMembers: activeCollaborators,
    pendingRequests,
    pendingInvitations,
  } = useMembershipSearch(collaborators, searchQuery, membershipSort, {
    activeStatuses: ['member', 'admin'],
    activeRoleNames: ['Author'],
  });

  const mutations = useCollaboratorMutations();

  const navigateToUser = (userId: string) => {
    navigate({ to: '/user/$id', params: { id: userId } });
  };

  const handleMembershipSortChange = (field: MembershipSortField) => {
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

  const handleOpenChangeRoleDialog = (membership: Collaborator) => {
    setChangeRoleMembership(membership);
    setChangeRoleOpen(true);
  };

  const handleConfirmRoleChange = async (newRoleIds: string[]) => {
    if (!changeRoleMembership) return;

    await mutations.changeCollaboratorRoles(changeRoleMembership.id, newRoleIds, roles);
  };

  const handleRemoveRoleFromByRoleView = async (membership: Collaborator, roleId: string) => {
    const nextRoleIds = getMembershipDisplayRoles(membership)
      .filter(role => role.id !== roleId)
      .map(role => role.id);

    await mutations.changeCollaboratorRoles(membership.id, nextRoleIds, roles);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {translateText('generated.inline.0097_manage_amendment_collaborators_1a87c60d')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {amendmentTitle}
          {translateText(
            'generated.inline.0098_manage_collaborators_requests_and_invitations_b304a0db'
          )}
        </p>
      </div>

      {activeTab !== 'roles' ? (
        <EntitySearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          placeholder={translateText(
            'generated.inline.0099_search_collaborators_by_name_role_or_status_c0a4b06d'
          )}
          className="mb-4"
        />
      ) : null}

      <MembershipTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
              existingCollaborators={activeCollaborators}
              roles={roles}
              onInviteUsers={mutations.inviteUsers}
            />
          ) : null
        }
        membershipsByUserContent={
          <div className="space-y-4">
            <PendingRequestsTable
              requests={pendingRequests}
              onApprove={membershipId => mutations.approveRequest(membershipId)}
              onReject={membershipId => mutations.rejectRequest(membershipId)}
              title={translateText('generated.inline.0102_pending_collaboration_requests_59419bb4')}
              description={translateText(
                'generated.inline.0103_review_and_approve_collaboration_requests_0cd489d8'
              )}
              roleColumnLabel={translateText('generated.inline.0010_requested_role_599518e7')}
              fallbackRoleLabel={translateText('generated.inline.0104_collaborator_794b34c1')}
              secondaryActionLabel={translateText('generated.inline.0011_decline_b59cf9ed')}
            />
            <PendingInvitationsTable
              invitations={pendingInvitations}
              onWithdraw={membershipId => mutations.withdrawInvitation(membershipId)}
              description={translateText(
                'generated.inline.0105_users_who_have_been_invited_to_this_amendment_525eacce'
              )}
              fallbackRoleLabel={translateText('generated.inline.0104_collaborator_794b34c1')}
            />
            <ActiveMembersTable
              members={activeCollaborators}
              sort={membershipSort}
              onSortChange={handleMembershipSortChange}
              onOpenRightsDialog={membership => {
                setMemberRightsMembership(membership);
                setMemberRightsOpen(true);
              }}
              onOpenChangeRoleDialog={handleOpenChangeRoleDialog}
              onRemove={membershipId => mutations.removeCollaborator(membershipId)}
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
            members={activeCollaborators}
            onOpenRightsDialog={membership => {
              setMemberRightsMembership(membership);
              setMemberRightsOpen(true);
            }}
            onRemoveRole={handleRemoveRoleFromByRoleView}
            onSecondaryAction={handleOpenChangeRoleDialog}
            secondaryActionLabel={translateText('generated.inline.0012_manage_roles_5f9b8531')}
            entityType="amendment"
            countLabel={translateText('generated.inline.0014_collaborators_8a37fa6f')}
            memberDescriptionFallback={translateText(
              'generated.inline.0013_collaborators_currently_assigned_to_this_role_37977ca0'
            )}
            emptyStateLabel={translateText(
              'generated.inline.0014_no_collaborators_currently_carry_this_role_c0b5b930'
            )}
          />
        }
        rolesContent={
          <RolesManagementCard
            amendmentId={amendmentId}
            roles={roles}
            onCreateRole={mutations.createRole}
            onDeleteRole={mutations.deleteRole}
            onToggleActionRight={mutations.toggleActionRight}
          />
        }
      />

      <MemberRightsDialog
        isOpen={memberRightsOpen}
        onOpenChange={setMemberRightsOpen}
        membership={memberRightsMembership}
        onNavigateToUser={navigateToUser}
        entityType="amendment"
        contextLabel={translateText('generated.inline.0015_amendment_61b2c1cd')}
        fallbackRoleLabel={translateText('generated.inline.0104_collaborator_794b34c1')}
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
        roles={roles}
        onConfirm={handleConfirmRoleChange}
        title={translateText('generated.inline.0107_manage_collaborator_roles_f0c3f76e')}
      />
    </div>
  );
}
