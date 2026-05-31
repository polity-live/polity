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
                Roles List
              </CardTitle>
              <CardDescription>
                Add and manage collaborator roles for this amendment.
              </CardDescription>
            </div>
            <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Role</DialogTitle>
                  <DialogDescription>
                    Create a new role with custom permissions for this amendment.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="role-name" className="text-sm font-medium">
                      Role Name
                    </label>
                    <Input
                      id="role-name"
                      placeholder="e.g., Editor, Reviewer, Contributor"
                      value={newRoleName}
                      onChange={e => setNewRoleName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="role-description" className="text-sm font-medium">
                      Description (Optional)
                    </label>
                    <Input
                      id="role-description"
                      placeholder="Describe this role's purpose"
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
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleAddRole}>
                    Create Role
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
                    <TableHead>Role</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Rights</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map(role => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <RoleTag roleId={role.id} roleName={role.name || 'Role'} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {role.description || 'No description'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {role.action_rights?.length ?? 0} rights
                      </TableCell>
                      <TableCell className="text-right">
                        {role.scope === 'amendment' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRole(role.id)}
                          >
                            <Trash2 className="text-destructive mr-1 h-4 w-4" />
                            Remove
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
                No roles created yet. Click "Add Role" to create your first role.
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
