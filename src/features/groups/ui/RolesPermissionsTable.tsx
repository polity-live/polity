/**
 * Roles Permissions Table Component
 *
 * Matrix table for managing role permissions with draggable columns.
 * Column order represents role hierarchy: left = least rights, right = most rights.
 */

import { useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/features/shared/ui/ui/card';
import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { GripVertical, Shield } from 'lucide-react';
import { ACTION_RIGHTS } from '@/zero/rbac/constants';
import type { ParticipationRoleLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';

interface RolesPermissionsTableProps<TRole extends ParticipationRoleLike> {
  roles: TRole[];
  onTogglePermission: (
    roleId: string,
    resource: string,
    action: string,
    currentlyHas: boolean
  ) => void;
  onReorderRoles: (orderedRoleIds: string[]) => void;
}

export function RolesPermissionsTable<TRole extends ParticipationRoleLike>({
  roles,
  onTogglePermission,
  onReorderRoles,
}: RolesPermissionsTableProps<TRole>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

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

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            Manage roles and their action rights. Drag columns to reorder — left is least
            privileged, right is most privileged.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {roles && roles.length > 0 ? (
          <div className="border-border/70 overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Action Right</TableHead>
                  {roles.map((role, index) => (
                    <TableHead
                      key={role.id}
                      className={`min-w-[120px] text-center transition-colors ${
                        draggedIndex === index ? 'opacity-50' : ''
                      } ${dragOverIndex === index && draggedIndex !== index ? 'bg-accent' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex flex-col items-center gap-1 py-1">
                        <div className="flex cursor-grab items-center gap-1">
                          <GripVertical className="text-muted-foreground h-3 w-3" />
                          <RoleTag
                            roleId={role.id}
                            roleName={role.name || 'Role'}
                            className="pointer-events-none text-[11px]"
                          />
                        </div>
                        <span className="text-muted-foreground text-xs font-normal">
                          {role.assignment_mode === 'elected' ? 'Election' : 'Assignment'}
                        </span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ACTION_RIGHTS.map(({ resource, action, label }) => {
                  const rightKey = `${resource}-${action}`;
                  return (
                    <TableRow key={rightKey}>
                      <TableCell className="font-medium">{label}</TableCell>
                      {roles.map(role => {
                        const hasRight = role.action_rights?.some(
                          ar => ar.resource === resource && ar.action === action
                        );
                        return (
                          <TableCell key={role.id} className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={hasRight}
                                onCheckedChange={() =>
                                  onTogglePermission(role.id, resource, action, hasRight || false)
                                }
                              />
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Shield className="text-muted-foreground/50 mx-auto h-12 w-12" />
            <p className="text-muted-foreground mt-4">
              No roles created yet. Create your first role in the details section.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
