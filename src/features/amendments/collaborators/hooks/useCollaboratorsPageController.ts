import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { getMembershipDisplayRoles } from '@/features/groups/logic/buildMembershipRightsSummary';
import { useMembershipSearch } from '@/features/groups/hooks/useMembershipSearch';
import type {
  MembershipSort,
  MembershipSortField,
  MembershipTab,
} from '@/features/groups/types/group.types';
import { useCollaboratorMutations } from './useCollaboratorMutations';
import { useCollaborators, type Collaborator } from './useCollaborators';

interface UseCollaboratorsPageControllerOptions {
  amendmentId: string;
  currentUserId: string | undefined;
}

export function useCollaboratorsPageController({
  amendmentId,
  currentUserId,
}: UseCollaboratorsPageControllerOptions) {
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
  const mutations = useCollaboratorMutations();

  const {
    activeMembers: activeCollaborators,
    pendingRequests,
    pendingInvitations,
  } = useMembershipSearch(collaborators, searchQuery, membershipSort, {
    activeStatuses: ['member', 'admin'],
    activeRoleNames: ['Author'],
  });

  const handleNavigateToUser = (userId: string) => {
    void navigate({ to: '/user/$id', params: { id: userId } });
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

  const handleOpenMemberRightsDialog = (membership: Collaborator) => {
    setMemberRightsMembership(membership);
    setMemberRightsOpen(true);
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

  return {
    activeCollaborators,
    activeTab,
    changeRoleMembership,
    changeRoleOpen,
    memberRightsMembership,
    memberRightsOpen,
    membershipSort,
    pendingInvitations,
    pendingRequests,
    roles,
    searchQuery,
    onActiveTabChange: setActiveTab,
    onApproveRequest: mutations.approveRequest,
    onChangeRoleOpenChange: setChangeRoleOpen,
    onConfirmRoleChange: handleConfirmRoleChange,
    onCreateRole: mutations.createRole,
    onDeleteRole: mutations.deleteRole,
    onInviteUsers: mutations.inviteUsers,
    onMemberRightsOpenChange: setMemberRightsOpen,
    onMembershipSortChange: handleMembershipSortChange,
    onNavigateToUser: handleNavigateToUser,
    onOpenChangeRoleDialog: handleOpenChangeRoleDialog,
    onOpenMemberRightsDialog: handleOpenMemberRightsDialog,
    onRejectRequest: mutations.rejectRequest,
    onRemoveCollaborator: mutations.removeCollaborator,
    onRemoveRoleFromByRoleView: handleRemoveRoleFromByRoleView,
    onSearchQueryChange: setSearchQuery,
    onToggleActionRight: mutations.toggleActionRight,
    onWithdrawInvitation: mutations.withdrawInvitation,
  };
}
