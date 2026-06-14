/**
 * Card for managing roles and permissions
 */

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
import { useRolesManagementCardController } from './useRolesManagementCardController';
import { RolesManagementCardView } from './RolesManagementCardView';

export function RolesManagementCard({
  amendmentId,
  roles,
  onCreateRole,
  onDeleteRole,
  onToggleActionRight,
}: RolesManagementCardProps) {
  const viewProps = useRolesManagementCardController({
    amendmentId,
    roles,
    onCreateRole,
    onDeleteRole,
    onToggleActionRight,
  });

  return <RolesManagementCardView {...viewProps} />;
}
