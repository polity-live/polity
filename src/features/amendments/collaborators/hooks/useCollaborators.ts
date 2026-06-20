/**
 * Hook for managing amendment collaborators data and permissions
 */

import { useMemo } from 'react';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import type { AmendmentCollaboratorRow, AmendmentRoleRow } from '@/zero/amendments/queries';

export type Collaborator = AmendmentCollaboratorRow & {
  role?: AmendmentRoleRow;
  roles?: AmendmentRoleRow[];
};
export type Role = AmendmentRoleRow;

const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = new Set([
  'active',
  'collaborator',
  'member',
  'admin',
]);

function isActiveAmendmentCollaboratorStatus(status: string | null | undefined): boolean {
  return status != null && ACTIVE_AMENDMENT_COLLABORATOR_STATUSES.has(status);
}

export interface CollaboratorsData {
  collaborators: Collaborator[];
  roles: Role[];
  pendingRequests: Collaborator[];
  activeCollaborators: Collaborator[];
  pendingInvitations: Collaborator[];
  isAdmin: boolean;
  currentUserCollaboration: Collaborator | undefined;
  isLoading: boolean;
}

export function useCollaborators(
  amendmentId: string,
  currentUserId: string | undefined,
  searchQuery = ''
): CollaboratorsData {
  // Query amendment with collaborators and roles
  const {
    collaborators: collabData,
    roles: rolesData,
    isLoading,
  } = useAmendmentState({
    amendmentId,
    includeRoles: true,
  });

  const baseCollaborators = collabData || [];
  const roles = rolesData || [];

  const collaborators = useMemo<Collaborator[]>(() => {
    return baseCollaborators.map(collaboration => {
      const matchedRole = roles.find(role => role.id === collaboration.role_id);
      return {
        ...collaboration,
        role: matchedRole,
        roles: matchedRole ? [matchedRole] : [],
      };
    });
  }, [baseCollaborators, roles]);

  // Check if current user is admin (has 'manage' action right for 'amendments')
  const currentUserCollaboration = collaborators.find(c => c.user?.id === currentUserId);
  const currentUserRole = roles.find(r => r.id === currentUserCollaboration?.role_id);
  const isAdmin = Boolean(
    isActiveAmendmentCollaboratorStatus(currentUserCollaboration?.status) &&
    currentUserRole?.action_rights?.some(
      right => right.resource === 'amendments' && right.action === 'manage'
    )
  );

  // Filter collaborators based on search query
  const filteredCollaborators = useMemo(() => {
    if (!searchQuery.trim()) return collaborators;

    const query = searchQuery.toLowerCase();
    return collaborators.filter(collaboration => {
      const firstName = collaboration.user?.first_name?.toLowerCase() || '';
      const lastName = collaboration.user?.last_name?.toLowerCase() || '';
      const userHandle = collaboration.user?.handle?.toLowerCase() || '';
      const matchedRole = roles.find(r => r.id === collaboration.role_id);
      const roleName = matchedRole?.name?.toLowerCase() || '';
      const status = collaboration.status?.toLowerCase() || '';
      return (
        firstName.includes(query) ||
        lastName.includes(query) ||
        userHandle.includes(query) ||
        roleName.includes(query) ||
        status.includes(query)
      );
    });
  }, [collaborators, roles, searchQuery]);

  // Separate by status
  const pendingRequests = useMemo(
    () => filteredCollaborators.filter(c => c.status === 'requested'),
    [filteredCollaborators]
  );

  const activeCollaborators = useMemo(
    () =>
      filteredCollaborators.filter(c => {
        const matchedRole = roles.find(r => r.id === c.role_id);
        return isActiveAmendmentCollaboratorStatus(c.status) || matchedRole?.name === 'Author';
      }),
    [filteredCollaborators, roles]
  );

  const pendingInvitations = useMemo(
    () => filteredCollaborators.filter(c => c.status === 'invited'),
    [filteredCollaborators]
  );

  return {
    collaborators: filteredCollaborators,
    roles,
    pendingRequests,
    activeCollaborators,
    pendingInvitations,
    isAdmin,
    currentUserCollaboration,
    isLoading,
  };
}
