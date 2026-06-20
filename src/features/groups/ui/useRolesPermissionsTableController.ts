/**
 * Roles Permissions Table Component
 *
 * Matrix table for managing role permissions with draggable columns.
 * Column order represents role hierarchy: left = least rights, right = most rights.
 */

import { useRef, useState } from 'react';
import { ACTION_RIGHTS } from '@/zero/rbac/constants';
import {
  getActionRightSections,
  type ActionRightDefinition,
} from '@/features/groups/logic/actionRightSections';
import type { ParticipationRoleLike } from '@/features/shared/types/participation';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface RolesPermissionsTableProps<TRole extends ParticipationRoleLike> {
  roles: TRole[];
  onTogglePermission: (
    roleId: string,
    resource: string,
    action: string,
    currentlyHas: boolean
  ) => void;
  onReorderRoles?: (orderedRoleIds: string[]) => void;
  actionRights?: readonly ActionRightDefinition[];
  title?: string;
  description?: string;
  isPermissionDisabled?: (role: TRole, resource: string, action: string) => string | null;
}
export function useRolesPermissionsTableController<TRole extends ParticipationRoleLike>({
  roles,
  onTogglePermission,
  onReorderRoles,
  actionRights = ACTION_RIGHTS,
  title = translateText('generated.inline.0110_role_permissions_2dbfb26f'),
  description = translateText(
    'generated.inline.0111_manage_roles_and_their_action_rights_by_capab_84eb9c78'
  ),
  isPermissionDisabled,
}: RolesPermissionsTableProps<TRole>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);
  const actionRightSections = getActionRightSections(actionRights);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    dragCounter.current++;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      dragCounter.current = 0;
      return;
    }

    if (!onReorderRoles) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      dragCounter.current = 0;
      return;
    }

    const reordered = [...roles];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    onReorderRoles(reordered.map(r => r.id));

    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };
  return {
    roles,
    onTogglePermission,
    onReorderRoles,
    actionRights,
    title,
    description,
    isPermissionDisabled,
    draggedIndex,
    setDraggedIndex,
    dragOverIndex,
    setDragOverIndex,
    dragCounter,
    actionRightSections,
    handleDragStart,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}
