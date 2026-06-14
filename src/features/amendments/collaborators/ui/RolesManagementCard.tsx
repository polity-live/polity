/**
 * Card for managing roles and permissions
 */

import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Input } from '@/features/shared/ui/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { Plus, Trash2, Users } from 'lucide-react';
import { RolesPermissionsTable } from '@/features/groups/ui/RolesPermissionsTable';
import { RoleTag } from '@/features/groups/ui/RoleTag';
import type { Role } from '../hooks/useCollaborators';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {translateText('generated.inline.0123_roles_list_11a0593d')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0124_add_and_manage_collaborator_roles_for_this_am_fd3611c6'
                )}
              </CardDescription>
            </div>
            <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {translateText('generated.inline.0125_add_role_82d0afcc')}
                </Button>
              </DialogTrigger>
              <DialogContent>
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
                  <div className="space-y-2">
                    <label htmlFor="role-name" className="text-sm font-medium">
                      {translateText('generated.inline.0128_role_name_a8b23a08')}
                    </label>
                    <Input
                      id="role-name"
                      placeholder={translateText(
                        'generated.inline.0129_e_g_editor_reviewer_contributor_e1cf8527'
                      )}
                      value={newRoleName}
                      onChange={e => setNewRoleName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="role-description" className="text-sm font-medium">
                      {translateText('generated.inline.0130_description_optional_f1da5c02')}
                    </label>
                    <Input
                      id="role-description"
                      placeholder={translateText(
                        'generated.inline.0131_describe_this_role_s_purpose_16c2c88f'
                      )}
                      value={newRoleDescription}
                      onChange={e => setNewRoleDescription(e.target.value)}
                    />
                  </div>
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
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {roles.length > 0 ? (
            <div className="border-border/70 overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translateText('generated.inline.0091_role_c3f104d1')}</TableHead>
                    <TableHead>
                      {translateText('generated.inline.0030_description_55f8ebc8')}
                    </TableHead>
                    <TableHead>{translateText('generated.inline.0133_rights_db94ff6b')}</TableHead>
                    <TableHead className="text-right">
                      {translateText('generated.inline.0093_actions_c3cd636a')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map(role => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <RoleTag roleId={role.id} roleName={role.name || 'Role'} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {role.description ||
                          translateText('generated.inline.0025_no_description_f354c94f')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {role.action_rights?.length ?? 0}
                        {translateText('generated.inline.0016_rights_1407cb23')}
                      </TableCell>
                      <TableCell className="text-right">
                        {role.scope === 'amendment' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRole(role.id)}
                          >
                            <Trash2 className="text-destructive mr-1 h-4 w-4" />
                            {translateText('generated.inline.0096_remove_e963907d')}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Users className="text-muted-foreground/50 mx-auto h-12 w-12" />
              <p className="text-muted-foreground mt-4">
                {translateText(
                  'generated.inline.0134_no_roles_created_yet_click_add_role_to_create_5594310d'
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <RolesPermissionsTable
        roles={roles}
        onTogglePermission={(roleId, resource, action, currentlyHas) =>
          handleToggleActionRight(roleId, resource, action, currentlyHas)
        }
      />
    </div>
  );
}
