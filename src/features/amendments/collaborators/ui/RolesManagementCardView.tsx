/**
 * Card for managing roles and permissions
 */

import { Plus, Trash2, Users } from 'lucide-react';

import { RolesPermissionsTable } from '@/features/groups/ui/RolesPermissionsTable';
import { RoleTag } from '@/features/groups/ui/RoleTag';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { DataTable, TableActionIconButton, type ColumnDef } from '@/features/shared/ui/data-table';
import { ValidatedField } from '@/features/shared/ui/form';
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
import { AMENDMENT_ACTION_RIGHTS } from '@/zero/rbac/constants';
import type { Role } from '../hooks/useCollaborators';
export interface RolesManagementCardViewProps {
  amendmentId: any;
  roles: any[];
  onCreateRole: any;
  onDeleteRole: any;
  onToggleActionRight: any;
  newRoleName: any;
  setNewRoleName: any;
  newRoleDescription: any;
  setNewRoleDescription: any;
  addRoleDialogOpen: any;
  setAddRoleDialogOpen: any;
  handleAddRole: any;
  handleRemoveRole: any;
  handleToggleActionRight: any;
}

export function RolesManagementCardView({
  roles,
  newRoleName,
  setNewRoleName,
  newRoleDescription,
  setNewRoleDescription,
  addRoleDialogOpen,
  setAddRoleDialogOpen,
  handleAddRole,
  handleRemoveRole,
  handleToggleActionRight,
}: RolesManagementCardViewProps) {
  const columns: ColumnDef<Role>[] = [
    {
      id: 'role',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      cell: ({ row }) => (
        <RoleTag
          roleId={row.original.id}
          roleName={
            row.original.name || translateText('features.amendments.collaborators.roleFallback')
          }
        />
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
          <TableActionIconButton
            label={translateText('generated.inline.0096_remove_e963907d')}
            icon={<Trash2 className="h-4 w-4" />}
            destructive
            onClick={() => handleRemoveRole(row.original.id)}
          />
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4">
          <div className="space-y-1.5">
            <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
              <Users className="h-5 w-5" />
              {translateText('generated.inline.0123_roles_list_11a0593d')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {translateText(
                'generated.inline.0124_add_and_manage_collaborator_roles_for_this_am_fd3611c6'
              )}
            </p>
          </div>
          <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {translateText('generated.inline.0125_add_role_82d0afcc')}
              </Button>
            </DialogTrigger>
            <ScrollableDialogContent management>
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
                <Button type="button" variant="outline" onClick={() => setAddRoleDialogOpen(false)}>
                  {translateText('generated.inline.0065_cancel_77dfd213')}
                </Button>
                <Button type="button" onClick={handleAddRole}>
                  {translateText('generated.inline.0132_create_role_5bea05a8')}
                </Button>
              </DialogFooter>
            </ScrollableDialogContent>
          </Dialog>
        </div>
        <DataTable
          columns={columns}
          data={roles}
          getRowId={role => role.id}
          enablePagination={false}
          emptyTitle={translateText(
            'generated.inline.0134_no_roles_created_yet_click_add_role_to_create_5594310d'
          )}
        />
      </section>

      <RolesPermissionsTable
        roles={roles}
        actionRights={AMENDMENT_ACTION_RIGHTS}
        title={translateText('features.amendments.collaborators.rolePermissionsTitle')}
        description={translateText('features.amendments.collaborators.rolePermissionsDescription')}
        onTogglePermission={(roleId, resource, action, currentlyHas) =>
          handleToggleActionRight(roleId, resource, action, currentlyHas)
        }
      />
    </div>
  );
}
