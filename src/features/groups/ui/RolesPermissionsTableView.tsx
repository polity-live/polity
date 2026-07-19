/**
 * Roles Permissions Table Component
 *
 * Matrix table for managing role permissions with draggable columns.
 * Column order represents role hierarchy: left = least rights, right = most rights.
 */

import type { ReactNode } from 'react';
import {
  MatrixCheckbox,
  MatrixTable,
  MatrixTableBody,
  MatrixTableCell,
  MatrixTableHead,
  MatrixTableHeader,
  MatrixTableRow,
} from '@/features/shared/ui/data-table';
import { GripVertical, Shield } from 'lucide-react';
import { RoleTag } from './RoleTag';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';
export interface RolesPermissionsTableViewProps {
  roles: any[];
  onTogglePermission: any;
  onReorderRoles: any;
  actionRights: readonly any[];
  title: any;
  description: any;
  isPermissionDisabled: any;
  draggedIndex: any;
  setDraggedIndex: any;
  dragOverIndex: any;
  setDragOverIndex: any;
  dragCounter: any;
  actionRightSections: any[];
  handleDragStart: any;
  handleDragEnter: any;
  handleDragLeave: any;
  handleDragOver: any;
  handleDrop: any;
  handleDragEnd: any;
  addRoleButton?: ReactNode;
}

export function RolesPermissionsTableView({
  roles,
  onTogglePermission,
  onReorderRoles,
  title,
  description,
  isPermissionDisabled,
  draggedIndex,
  dragOverIndex,
  actionRightSections,
  handleDragStart,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  addRoleButton,
}: RolesPermissionsTableViewProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1.5 px-3 sm:px-4">
        <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
          <Shield className="h-5 w-5" />
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {roles && roles.length > 0 ? (
        <div className="space-y-8">
          {actionRightSections.map((section: any) => (
            <section
              key={section.id}
              aria-labelledby={`action-right-section-heading-${section.id}`}
              data-testid={`action-right-section-${section.id}`}
              className="space-y-3"
            >
              <div className="space-y-1.5 px-3 sm:px-4">
                <h3
                  id={`action-right-section-heading-${section.id}`}
                  className="text-base font-semibold"
                >
                  {section.title}
                </h3>
                <p className="text-muted-foreground text-sm">{section.description}</p>
              </div>

              <div className="bg-card border-border/70 overflow-x-auto rounded-md border shadow-[var(--shadow-panel)]">
                <MatrixTable>
                  <MatrixTableHeader>
                    <MatrixTableRow>
                      <MatrixTableHead className="min-w-[200px]">
                        {translateText('generated.inline.0731_action_right_5c493b37')}
                      </MatrixTableHead>
                      {roles.map((role: any, index: number) => (
                        <MatrixTableHead
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
                              <RoleTag roleId={role.id} roleName={role.name || 'Role'} />
                            </div>
                            <span className="text-muted-foreground text-xs font-normal">
                              {role.assignment_mode === 'elected'
                                ? translateText('generated.inline.0112_election_217da2dc')
                                : translateText('generated.inline.0113_assignment_e55df441')}
                            </span>
                          </div>
                        </MatrixTableHead>
                      ))}
                      {addRoleButton ? (
                        <MatrixTableHead className="min-w-[88px] text-center">
                          <div className="flex justify-center py-1">{addRoleButton}</div>
                        </MatrixTableHead>
                      ) : null}
                    </MatrixTableRow>
                  </MatrixTableHeader>
                  <MatrixTableBody>
                    {section.rights.map(({ resource, action, label }: any) => {
                      const rightKey = `${resource}-${action}`;
                      return (
                        <MatrixTableRow key={rightKey}>
                          <MatrixTableCell className="font-medium">{label}</MatrixTableCell>
                          {roles.map((role: any) => {
                            const hasRight = role.action_rights?.some(
                              (ar: any) => ar.resource === resource && ar.action === action
                            );
                            const disabledReason =
                              isPermissionDisabled?.(role, resource, action) ?? null;
                            return (
                              <MatrixTableCell key={role.id} className="text-center">
                                <TooltipHint
                                  content={disabledReason ?? ''}
                                  disabled={!disabledReason}
                                >
                                  <div className="flex justify-center">
                                    <MatrixCheckbox
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
                                </TooltipHint>
                              </MatrixTableCell>
                            );
                          })}
                          {addRoleButton ? <MatrixTableCell aria-hidden="true" /> : null}
                        </MatrixTableRow>
                      );
                    })}
                  </MatrixTableBody>
                </MatrixTable>
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
          {addRoleButton ? <div className="mt-4 flex justify-center">{addRoleButton}</div> : null}
        </div>
      )}
    </section>
  );
}
