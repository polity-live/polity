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
import { Eye } from 'lucide-react';
import { TableTag } from '@/features/shared/ui/ui/table-tag';
import { getTableTagSurfaceClassName } from '@/features/shared/ui/ui/table-tag';
import { badgeVariants } from '@/features/shared/ui/ui/badge';
import { cn } from '@/features/shared/utils/utils.ts';
import type { SearchCardGradientEntity } from '@/features/shared/utils/search-card-gradients';
import type {
  ParticipationLike,
  ParticipationRoleLike,
} from '@/features/shared/types/participation';
import { UserTableCell } from '@/features/shared/ui/ui/user-table-cell';
import { getMembershipDisplayRoles } from '@/features/groups/logic/buildMembershipRightsSummary';
import { getMembershipProvenanceDisplayLabel } from '@/features/groups/logic/membershipComposition';
import { RoleTag } from './RoleTag';

interface MembershipsByRoleTablesProps<
  TRole extends ParticipationRoleLike,
  TParticipation extends ParticipationLike,
> {
  roles: TRole[];
  members: TParticipation[];
  onOpenRightsDialog: (membership: TParticipation) => void;
  onRemoveRole: (membership: TParticipation, roleId: string) => void;
  entityType?: SearchCardGradientEntity;
  countLabel?: string;
  memberDescriptionFallback?: string;
  defaultRequestLabel?: string;
  defaultInviteLabel?: string;
  noOtherRolesLabel?: string;
  removeActionLabel?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: (membership: TParticipation) => void;
  derivedRemoveTooltip?: string;
  secondaryActionTooltip?: string;
  emptyStateLabel?: string;
  showProvenanceColumns?: boolean;
}

export function MembershipsByRoleTables<
  TRole extends ParticipationRoleLike,
  TParticipation extends ParticipationLike,
>({
  roles,
  members,
  onOpenRightsDialog,
  onRemoveRole,
  entityType = 'group',
  countLabel = 'members',
  memberDescriptionFallback = 'Members currently assigned to this role.',
  defaultRequestLabel = 'Default request',
  defaultInviteLabel = 'Default invite',
  noOtherRolesLabel = 'No other roles',
  removeActionLabel = 'Remove',
  secondaryActionLabel,
  onSecondaryAction,
  derivedRemoveTooltip = 'Derived memberships cannot be edited directly.',
  secondaryActionTooltip,
  emptyStateLabel = 'No members currently carry this role.',
  showProvenanceColumns = false,
}: MembershipsByRoleTablesProps<TRole, TParticipation>) {
  const { t } = useTranslation();
  const membersWithoutRoles = members.filter(
    membership => getMembershipDisplayRoles(membership).length === 0
  );
  const sections = [
    ...roles.map(role => ({
      kind: 'role' as const,
      id: role.id,
      title: role.name || 'Role',
      description: role.description || memberDescriptionFallback,
      role,
      members: members.filter(membership =>
        getMembershipDisplayRoles(membership).some(membershipRole => membershipRole.id === role.id)
      ),
    })),
    ...(membersWithoutRoles.length > 0
      ? [
          {
            kind: 'no-role' as const,
            id: 'no-user-role',
            title: 'No user role',
            description: 'Members currently without any assigned group role.',
            role: null,
            members: membersWithoutRoles,
          },
        ]
      : []),
  ];

  const renderProvenanceGroupTag = (
    membership: TParticipation,
    column: 'partGroup' | 'baseGroup'
  ) => {
    const group = column === 'partGroup' ? membership.partGroup : membership.baseGroup;
    const label = getMembershipProvenanceDisplayLabel(membership, column);

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
    <div className="space-y-4">
      {sections.map(section => {
        const roleMembers = section.members;

        return (
          <Card
            key={section.id}
            className="border-border/70 from-background to-muted/20 bg-gradient-to-b"
          >
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {section.kind === 'role' && section.role ? (
                      <RoleTag roleId={section.role.id} roleName={section.title} />
                    ) : (
                      <span className="font-semibold">{section.title}</span>
                    )}
                    <TableTag entityType={entityType}>
                      {roleMembers.length} {countLabel}
                    </TableTag>
                  </CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
                {section.kind === 'role' && section.role ? (
                  <div className="flex flex-wrap gap-2">
                    {section.role.default_request_role ? (
                      <TableTag entityType={entityType}>{defaultRequestLabel}</TableTag>
                    ) : null}
                    {section.role.default_invite_role ? (
                      <TableTag entityType={entityType}>{defaultInviteLabel}</TableTag>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="border-border/70 overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>
                        {section.kind === 'role' ? 'Other Roles' : 'Assigned Roles'}
                      </TableHead>
                      {showProvenanceColumns ? (
                        <TableHead>{t('components.tableColumns.partGroup')}</TableHead>
                      ) : null}
                      {showProvenanceColumns ? (
                        <TableHead>{t('components.tableColumns.baseGroup')}</TableHead>
                      ) : null}
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleMembers.length > 0 ? (
                      roleMembers.map(membership => {
                        const displayRoles = getMembershipDisplayRoles(membership);
                        const otherRoles =
                          section.kind === 'role' && section.role
                            ? displayRoles.filter(
                                membershipRole => membershipRole.id !== section.role?.id
                              )
                            : displayRoles;

                        return (
                          <TableRow key={`${section.id}-${membership.id}`}>
                            <TableCell>
                              <UserTableCell user={membership.user} />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {otherRoles.length > 0 ? (
                                  otherRoles.map(otherRole => (
                                    <RoleTag
                                      key={otherRole.id}
                                      roleId={otherRole.id}
                                      roleName={otherRole.name || 'Role'}
                                    />
                                  ))
                                ) : section.kind === 'no-role' ? (
                                  <RoleTag fallbackKey={`no-role-${membership.id}`}>
                                    No user role
                                  </RoleTag>
                                ) : (
                                  <span className="text-muted-foreground text-sm">
                                    {noOtherRolesLabel}
                                  </span>
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
                            <TableCell className="text-muted-foreground">
                              {membership.created_at
                                ? new Date(membership.created_at).toLocaleDateString()
                                : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onOpenRightsDialog(membership)}
                                >
                                  <Eye className="mr-1 h-4 w-4" />
                                  Rights
                                </Button>
                                {onSecondaryAction ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onSecondaryAction(membership)}
                                    title={secondaryActionTooltip}
                                  >
                                    {secondaryActionLabel || 'Manage'}
                                  </Button>
                                ) : null}
                                {section.kind === 'role' && section.role ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={membership.source === 'derived'}
                                    onClick={() => onRemoveRole(membership, section.role.id)}
                                    title={
                                      membership.source === 'derived'
                                        ? derivedRemoveTooltip
                                        : 'Remove this role from the member.'
                                    }
                                  >
                                    {removeActionLabel}
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={showProvenanceColumns ? 6 : 4}
                          className="text-muted-foreground py-8 text-center"
                        >
                          {emptyStateLabel}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
