import { featureThemeClassName } from '@/features/shared/theme';
/**
 * Roles Permissions Table Component
 *
 * Matrix table for managing role permissions with draggable columns.
 * Column order represents role hierarchy: left = least rights, right = most rights.
 */

import {
  MatrixCheckbox,
  MatrixTable,
  MatrixTableBody,
  MatrixTableCell,
  MatrixTableHead,
  MatrixTableHeader,
  MatrixTableRow,
} from '@/features/shared/ui/data-table';
import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
import { GripVertical, Shield } from 'lucide-react';
import { RoleTag } from './RoleTag';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
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
}: RolesPermissionsTableViewProps) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {title}
          </PanelTitle>
          <PanelDescription>{description}</PanelDescription>
        </div>
      </PanelHeader>
      <PanelContent>
        {roles && roles.length > 0 ? (
          <div className="space-y-8">
            {actionRightSections.map((section: any) => (
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
                                <RoleTag
                                  roleId={role.id}
                                  roleName={role.name || 'Role'}
                                  className={featureThemeClassName(
                                    'groupRolesPermissionsTableThemedText'
                                  )}
                                />
                              </div>
                              <span className="text-muted-foreground text-xs font-normal">
                                {role.assignment_mode === 'elected'
                                  ? translateText('generated.inline.0112_election_217da2dc')
                                  : translateText('generated.inline.0113_assignment_e55df441')}
                              </span>
                            </div>
                          </MatrixTableHead>
                        ))}
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
                                  <div
                                    className="flex justify-center"
                                    title={disabledReason ?? undefined}
                                  >
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
                                </MatrixTableCell>
                              );
                            })}
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
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
