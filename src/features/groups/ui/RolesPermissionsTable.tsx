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
import { getActionRightSections } from '@/features/groups/logic/actionRightSections';
import type { ParticipationRoleLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';
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
  actionRights?: readonly (typeof ACTION_RIGHTS)[number][];
  title?: string;
  description?: string;
  isPermissionDisabled?: (role: TRole, resource: string, action: string) => string | null;
}

export function RolesPermissionsTable<TRole extends ParticipationRoleLike>({
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

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {roles && roles.length > 0 ? (
          <div className="space-y-8">
            {actionRightSections.map(section => (
              <section
                key={section.id}
                aria-labelledby={`action-right-section-heading-${section.id}`}
                data-testid={`action-right-section-${section.id}`}
                className="space-y-3"
              >
                <div>
                  <h3
                    id={`action-right-section-heading-${section.id}`}
                    className="text-base font-semibold"
                  >
                    {section.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">{section.description}</p>
                </div>

                <div className="border-border/70 overflow-x-auto rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">
                          {translateText('generated.inline.0731_action_right_5c493b37')}
                        </TableHead>
                        {roles.map((role, index) => (
                          <TableHead
                            key={role.id}
                            className={`min-w-[120px] text-center transition-colors ${
                              draggedIndex === index ? 'opacity-50' : ''
                            } ${dragOverIndex === index && draggedIndex !== index ? 'bg-accent' : ''}`}
                            draggable={Boolean(onReorderRoles)}
                            onDragStart={onReorderRoles ? () => handleDragStart(index) : undefined}
                            onDragEnter={onReorderRoles ? () => handleDragEnter(index) : undefined}
                            onDragLeave={onReorderRoles ? handleDragLeave : undefined}
                            onDragOver={onReorderRoles ? handleDragOver : undefined}
                            onDrop={onReorderRoles ? () => handleDrop(index) : undefined}
                            onDragEnd={onReorderRoles ? handleDragEnd : undefined}
                          >
                            <div className="flex flex-col items-center gap-1 py-1">
                              <div
                                className={`flex items-center gap-1 ${onReorderRoles ? 'cursor-grab' : 'cursor-default'}`}
                              >
                                {onReorderRoles ? (
                                  <GripVertical className="text-muted-foreground h-3 w-3" />
                                ) : null}
                                <RoleTag
                                  roleId={role.id}
                                  roleName={role.name || 'Role'}
                                  className="pointer-events-none text-[11px]"
                                />
                              </div>
                              <span className="text-muted-foreground text-xs font-normal">
                                {role.assignment_mode === 'elected'
                                  ? translateText('generated.inline.0112_election_217da2dc')
                                  : translateText('generated.inline.0113_assignment_e55df441')}
                              </span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.rights.map(({ resource, action, label }) => {
                        const rightKey = `${resource}-${action}`;
                        return (
                          <TableRow key={rightKey}>
                            <TableCell className="font-medium">{label}</TableCell>
                            {roles.map(role => {
                              const hasRight = role.action_rights?.some(
                                ar => ar.resource === resource && ar.action === action
                              );
                              const disabledReason =
                                isPermissionDisabled?.(role, resource, action) ?? null;
                              return (
                                <TableCell key={role.id} className="text-center">
                                  <div
                                    className="flex justify-center"
                                    title={disabledReason ?? undefined}
                                  >
                                    <Checkbox
                                      checked={hasRight}
                                      disabled={Boolean(disabledReason)}
                                      onCheckedChange={() =>
                                        onTogglePermission(
                                          role.id,
                                          resource,
                                          action,
                                          hasRight || false
                                        )
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
              </section>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Shield className="text-muted-foreground/50 mx-auto h-12 w-12" />
            <p className="text-muted-foreground mt-4">
              {translateText(
                'generated.inline.0732_no_roles_created_yet_create_your_first_role_i_71214f95'
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
