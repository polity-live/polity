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
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
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
      {roles.map(role => {
        const roleMembers = members.filter(membership =>
          getMembershipDisplayRoles(membership).some(
            membershipRole => membershipRole.id === role.id
          )
        );

        return (
          <Card
            key={role.id}
            className="border-border/70 from-background to-muted/20 bg-gradient-to-b"
          >
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RoleTag roleId={role.id} roleName={role.name || 'Role'} />
                    <TableTag entityType={entityType}>
                      {roleMembers.length} {countLabel}
                    </TableTag>
                  </CardTitle>
                  <CardDescription>{role.description || memberDescriptionFallback}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.default_request_role ? (
                    <TableTag entityType={entityType}>{defaultRequestLabel}</TableTag>
                  ) : null}
                  {role.default_invite_role ? (
                    <TableTag entityType={entityType}>{defaultInviteLabel}</TableTag>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border-border/70 overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Other Roles</TableHead>
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
                        const user = membership.user;
                        const userName =
                          [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
                          'Unknown User';
                        const otherRoles = getMembershipDisplayRoles(membership).filter(
                          membershipRole => membershipRole.id !== role.id
                        );

                        return (
                          <TableRow key={`${role.id}-${membership.id}`}>
                            <TableCell>
                              {user?.id ? (
                                <Link
                                  to="/user/$id"
                                  params={{ id: user.id }}
                                  className="group flex items-center gap-3 text-left"
                                >
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage src={user?.avatar || undefined} alt={userName} />
                                    <AvatarFallback>
                                      {userName
                                        .split(' ')
                                        .map(part => part[0])
                                        .join('')
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="group-hover:underline">
                                    <div className="font-medium">{userName}</div>
                                    {user?.handle ? (
                                      <div className="text-muted-foreground text-sm">
                                        @{user.handle}
                                      </div>
                                    ) : null}
                                  </div>
                                </Link>
                              ) : (
                                <div className="flex items-center gap-3 text-left">
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage src={user?.avatar || undefined} alt={userName} />
                                    <AvatarFallback>
                                      {userName
                                        .split(' ')
                                        .map(part => part[0])
                                        .join('')
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">{userName}</div>
                                    {user?.handle ? (
                                      <div className="text-muted-foreground text-sm">
                                        @{user.handle}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              )}
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={membership.source === 'derived'}
                                  onClick={() => onRemoveRole(membership, role.id)}
                                  title={
                                    membership.source === 'derived'
                                      ? derivedRemoveTooltip
                                      : 'Remove this role from the member.'
                                  }
                                >
                                  {removeActionLabel}
                                </Button>
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
