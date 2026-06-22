/**
 * Roles Permissions Table Component
 *
 * Matrix table for managing role permissions with draggable columns.
 * Column order represents role hierarchy: left = least rights, right = most rights.
 */

import { GROUP_ACTION_RIGHTS } from '@/zero/rbac/constants';
import type { ParticipationRoleLike } from '@/features/shared/types/participation';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { ActionRightDefinition } from '@/features/groups/logic/actionRightSections';

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
import { useRolesPermissionsTableController } from './useRolesPermissionsTableController';
import { RolesPermissionsTableView } from './RolesPermissionsTableView';

export function RolesPermissionsTable<TRole extends ParticipationRoleLike>({
  roles,
  onTogglePermission,
  onReorderRoles,
  actionRights = GROUP_ACTION_RIGHTS,
  title = translateText('generated.inline.0110_role_permissions_2dbfb26f'),
  description = translateText(
    'generated.inline.0111_manage_roles_and_their_action_rights_by_capab_84eb9c78'
  ),
  isPermissionDisabled,
}: RolesPermissionsTableProps<TRole>) {
  const viewProps = useRolesPermissionsTableController({
    roles,
    onTogglePermission,
    onReorderRoles,
    actionRights,
    title,
    description,
    isPermissionDisabled,
  });

  return <RolesPermissionsTableView {...viewProps} />;
}
