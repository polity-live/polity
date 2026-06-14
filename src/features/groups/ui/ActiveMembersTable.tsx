/**
 * Active Members Table Component
 *
 * Displays active group members with role management and actions.
 */

import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Trash2, Users } from 'lucide-react';
import { getMembershipDisplayRoles } from '../logic/buildMembershipRightsSummary';
import { getMembershipProvenanceDisplayLabel } from '../logic/membershipComposition';
import { getTableTagSurfaceClassName } from '@/features/shared/ui/ui/table-tag';
import { badgeVariants } from '@/features/shared/ui/ui/badge';
import { cn } from '@/features/shared/utils/utils.ts';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { UserTableCell } from '@/features/shared/ui/ui/user-table-cell';
import type { MembershipSort, MembershipSortField } from '../types/group.types';
import { RoleTag } from './RoleTag';

interface ActiveMembersTableProps<TMembership extends ParticipationLike> {
  members: TMembership[];
  sort: MembershipSort;
  onSortChange: (field: MembershipSortField) => void;
  onOpenRightsDialog: (membership: TMembership) => void;
  onOpenChangeRoleDialog: (membership: TMembership) => void;
  onRemove: (membershipId: string, userId: string) => void;
  title?: string;
  description?: string;
  fallbackRoleLabel?: string;
  manageRolesLabel?: string;
  removeLabel?: string;
  showProvenanceColumns?: boolean;
}

export function ActiveMembersTable<TMembership extends ParticipationLike>({
  members,
  sort,
  onSortChange,
  onOpenRightsDialog,
  onOpenChangeRoleDialog,
  onRemove,
  title,
  description,
  fallbackRoleLabel,
  manageRolesLabel,
  removeLabel,
  showProvenanceColumns = false,
}: ActiveMembersTableProps<TMembership>) {
  const { t } = useTranslation();
  const directWithoutPathLabel = t('features.groups.memberships.composition.directWithoutPath');
  const resolvedTitle = title ?? t('components.membershipTables.activeMembersTitle');
  const resolvedDescription =
    description ?? t('components.membershipTables.activeMembersDescription');
  const resolvedFallbackRoleLabel =
    fallbackRoleLabel ?? t('components.membershipTables.memberFallback');
  const resolvedManageRolesLabel = manageRolesLabel ?? t('components.membershipTables.manageRoles');
  const resolvedRemoveLabel = removeLabel ?? t('components.membershipTables.remove');
  const userColumnLabel = t('components.membershipTables.user');
  const roleColumnLabel = t('components.membershipTables.role');
  const joinedColumnLabel = t('components.membershipTables.joined');
  const actionsColumnLabel = t('components.membershipTables.actions');
  const rightsLabel = t('components.membershipTables.rights');
  const notAvailableLabel = t('components.membershipTables.notAvailable', 'N/A');

  const renderProvenanceGroupTag = (membership: TMembership, column: 'partGroup' | 'baseGroup') => {
    const group = column === 'partGroup' ? membership.partGroup : membership.baseGroup;
    const label = getMembershipProvenanceDisplayLabel(membership, column, {
      directWithoutPathLabel,
    });

    if (!group?.id) {
      return <span>{label}</span>;
    }

    return (
      <Link
        to="/group/$id"
        params={{ id: group.id }}
        className={cn(
          badgeVariants({ variant: 'outline' }),
          getTableTagSurfaceClassName('group'),
          'hover:opacity-90'
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <Card className="border-border/70 from-background to-muted/20 mb-6 bg-gradient-to-b">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {resolvedTitle} ({members.length})
        </CardTitle>
        <CardDescription>{resolvedDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            {t('components.membershipTables.noActiveMembers')}
          </p>
        ) : (
          <div className="border-border/70 overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton
                      label={userColumnLabel}
                      field="user"
                      sort={sort}
                      onSortChange={onSortChange}
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      label={roleColumnLabel}
                      field="role"
                      sort={sort}
                      onSortChange={onSortChange}
                    />
                  </TableHead>
                  {showProvenanceColumns ? (
                    <TableHead>{t('components.tableColumns.partGroup')}</TableHead>
                  ) : null}
                  {showProvenanceColumns ? (
                    <TableHead>{t('components.tableColumns.baseGroup')}</TableHead>
                  ) : null}
                  <TableHead>{joinedColumnLabel}</TableHead>
                  <TableHead className="text-right">{actionsColumnLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(membership => {
                  const user = membership.user;
                  const userId = user?.id || null;
                  const displayRoles = getMembershipDisplayRoles(membership);
                  const createdAt = membership.created_at
                    ? new Date(membership.created_at).toLocaleDateString()
                    : notAvailableLabel;

                  return (
                    <TableRow key={membership.id}>
                      <TableCell>
                        <UserTableCell user={user} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {displayRoles.length > 0 ? (
                            displayRoles.map(role => (
                              <RoleTag
                                key={role.id}
                                roleId={role.id}
                                roleName={role.name || 'Role'}
                              />
                            ))
                          ) : (
                            <RoleTag fallbackKey={`member-${membership.id}`}>
                              {resolvedFallbackRoleLabel}
                            </RoleTag>
                          )}
                        </div>
                      </TableCell>
                      {showProvenanceColumns ? (
                        <TableCell className="text-muted-foreground">
                          {renderProvenanceGroupTag(membership, 'partGroup')}
                        </TableCell>
                      ) : null}
                      {showProvenanceColumns ? (
                        <TableCell className="text-muted-foreground">
                          {renderProvenanceGroupTag(membership, 'baseGroup')}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-muted-foreground">{createdAt}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenRightsDialog(membership)}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            {rightsLabel}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChangeRoleDialog(membership)}
                          >
                            <ArrowUpDown className="mr-1 h-4 w-4" />
                            {resolvedManageRolesLabel}
                          </Button>
                          {membership.source !== 'derived' && userId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemove(membership.id, userId)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="ml-2">{resolvedRemoveLabel}</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SortButtonProps {
  label: string;
  field: MembershipSortField;
  sort: MembershipSort;
  onSortChange: (field: MembershipSortField) => void;
}

function SortButton({ label, field, sort, onSortChange }: SortButtonProps) {
  const Icon = sort.field !== field ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-foreground hover:text-foreground -ml-3 h-auto px-3 py-1 font-semibold hover:bg-transparent"
      onClick={() => onSortChange(field)}
    >
      {label}
      <Icon className="ml-2 h-4 w-4" />
    </Button>
  );
}
