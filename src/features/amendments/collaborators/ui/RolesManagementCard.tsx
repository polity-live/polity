/**
 * Card for managing roles and permissions
 */

import { useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';

import { RolesPermissionsTable } from '@/features/groups/ui/RolesPermissionsTable';
import { RoleTag } from '@/features/groups/ui/RoleTag';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { ValidatedField } from '@/features/shared/ui/form';
import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
import { CountBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import type { Role } from '../hooks/useCollaborators';

interface RolesManagementCardProps {
  amendmentId: string;
  roles: Role[];
  onCreateRole: (name: string, description: string, amendmentId: string) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;
  onToggleActionRight: (
    roleId: string,
    resource: string,
    action: string,
    currentlyHas: boolean,
    roles: Role[],
    amendmentId: string
  ) => Promise<void>;
}

export function RolesManagementCard({
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

  const columns: ColumnDef<Role>[] = [
    {
      id: 'role',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      cell: ({ row }) => (
        <RoleTag roleId={row.original.id} roleName={row.original.name || 'Role'} />
      ),
    },
    {
      id: 'description',
      header: translateText('generated.inline.0030_description_55f8ebc8'),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.description ||
            translateText('generated.inline.0025_no_description_f354c94f')}
        </span>
      ),
    },
    {
      id: 'rights',
      header: translateText('generated.inline.0133_rights_db94ff6b'),
      cell: ({ row }) => (
        <CountBadge
          count={row.original.action_rights?.length ?? 0}
          label={translateText('generated.inline.0016_rights_1407cb23')}
        />
      ),
    },
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) =>
        row.original.scope === 'amendment' ? (
          <Button variant="ghost" size="sm" onClick={() => handleRemoveRole(row.original.id)}>
            <Trash2 className="text-destructive mr-1 h-4 w-4" />
            {translateText('generated.inline.0096_remove_e963907d')}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <PanelTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {translateText('generated.inline.0123_roles_list_11a0593d')}
              </PanelTitle>
              <PanelDescription>
                {translateText(
                  'generated.inline.0124_add_and_manage_collaborator_roles_for_this_am_fd3611c6'
                )}
              </PanelDescription>
            </div>
            <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {translateText('generated.inline.0125_add_role_82d0afcc')}
                </Button>
              </DialogTrigger>
              <ScrollableDialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {translateText('generated.inline.0126_add_new_role_241eb33f')}
                  </DialogTitle>
                  <DialogDescription>
                    {translateText(
                      'generated.inline.0127_create_a_new_role_with_custom_permissions_for_39fc44c1'
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <ValidatedField
                    label={translateText('generated.inline.0128_role_name_a8b23a08')}
                    placeholder={translateText(
                      'generated.inline.0129_e_g_editor_reviewer_contributor_e1cf8527'
                    )}
                    value={newRoleName}
                    onValueChange={setNewRoleName}
                    required
                  />
                  <ValidatedField
                    label={translateText('generated.inline.0130_description_optional_f1da5c02')}
                    placeholder={translateText(
                      'generated.inline.0131_describe_this_role_s_purpose_16c2c88f'
                    )}
                    value={newRoleDescription}
                    onValueChange={setNewRoleDescription}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddRoleDialogOpen(false)}
                  >
                    {translateText('generated.inline.0065_cancel_77dfd213')}
                  </Button>
                  <Button type="button" onClick={handleAddRole}>
                    {translateText('generated.inline.0132_create_role_5bea05a8')}
                  </Button>
                </DialogFooter>
              </ScrollableDialogContent>
            </Dialog>
          </div>
        </PanelHeader>
        <PanelContent>
          <DataTable
            columns={columns}
            data={roles}
            getRowId={role => role.id}
            enablePagination={false}
            emptyTitle={translateText(
              'generated.inline.0134_no_roles_created_yet_click_add_role_to_create_5594310d'
            )}
          />
        </PanelContent>
      </Panel>

      <RolesPermissionsTable
        roles={roles}
        onTogglePermission={(roleId, resource, action, currentlyHas) =>
          handleToggleActionRight(roleId, resource, action, currentlyHas)
        }
      />
    </div>
  );
}
