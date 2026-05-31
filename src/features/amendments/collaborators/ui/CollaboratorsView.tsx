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
        <h1 className="text-3xl font-bold">Manage Amendment Collaborators</h1>
        <p className="text-muted-foreground mt-2">
          {amendmentTitle} - Manage collaborators, requests, and invitations
        </p>
      </div>

      {activeTab !== 'roles' ? (
        <EntitySearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          placeholder="Search collaborators by name, role, or status..."
          className="mb-4"
        />
      ) : null}

      <MembershipTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showGuests={false}
        membershipsByUserLabel="Participants by user"
        membershipsByRoleLabel="Participants by role"
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
              title="Pending Collaboration Requests"
              description="Review and approve collaboration requests"
              roleColumnLabel="Requested Role"
              fallbackRoleLabel="Collaborator"
              secondaryActionLabel="Decline"
            />
            <PendingInvitationsTable
              invitations={pendingInvitations}
              onWithdraw={membershipId => mutations.withdrawInvitation(membershipId)}
              description="Users who have been invited to this amendment but have not accepted yet"
              fallbackRoleLabel="Collaborator"
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
              title="Active Collaborators"
              description="Current amendment collaborators and administrators"
              fallbackRoleLabel="Collaborator"
              manageRolesLabel="Manage Roles"
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
            secondaryActionLabel="Manage Roles"
            entityType="amendment"
            countLabel="collaborators"
            memberDescriptionFallback="Collaborators currently assigned to this role."
            emptyStateLabel="No collaborators currently carry this role."
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
        contextLabel="amendment"
        fallbackRoleLabel="Collaborator"
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
        title="Manage Collaborator Roles"
      />
    </div>
  );
}
