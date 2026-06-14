/**
 * Card for managing roles and permissions
 */

import { useState } from 'react';

import type { Role } from '../hooks/useCollaborators';

interface RolesManagementCardProps {
  amendmentId: string;
  roles: Role[];
  onCreateRole: (name: string, description: string, amendmentId: string) => void | Promise<void>;
  onDeleteRole: (roleId: string) => void | Promise<void>;
  onToggleActionRight: (
    roleId: string,
    resource: string,
    action: string,
    currentlyHas: boolean,
    roles: Role[],
    amendmentId: string
  ) => void | Promise<void>;
}
export function useRolesManagementCardController({
  amendmentId,
  roles,
  onCreateRole,
  onDeleteRole,
  onToggleActionRight,
}: RolesManagementCardProps) {
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      await onCreateRole(newRoleName, newRoleDescription, amendmentId);

      setNewRoleName('');
      setNewRoleDescription('');
      setAddRoleDialogOpen(false);
    } catch (error) {
      console.error('Error adding role:', error);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    try {
      await onDeleteRole(roleId);
    } catch (error) {
      console.error('Error removing role:', error);
    }
  };

  const handleToggleActionRight = async (
    roleId: string,
    resource: string,
    action: string,
    currentlyHas: boolean
  ) => {
    try {
      await onToggleActionRight(roleId, resource, action, currentlyHas, roles, amendmentId);
    } catch (error) {
      console.error('Error toggling action right:', error);
    }
  };

  return {
    amendmentId,
    roles,
    onCreateRole,
    onDeleteRole,
    onToggleActionRight,
    newRoleName,
    setNewRoleName,
    newRoleDescription,
    setNewRoleDescription,
    addRoleDialogOpen,
    setAddRoleDialogOpen,
    handleAddRole,
    handleRemoveRole,
    handleToggleActionRight,
  };
}
