import { Link } from '@tanstack/react-router';
import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getMembershipDisplayRoles } from '@/features/groups/logic/membershipDisplayRoles';
import { getMembershipProvenanceDisplayLabel } from '@/features/groups/logic/membershipComposition';
import type {
  ParticipationLike,
  ParticipationRoleLike,
} from '@/features/shared/types/participation';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
import { CountBadge, EntityBadge, StatusBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { UserTableCell } from '@/features/shared/ui/ui/user-table-cell';
import type { SearchCardGradientEntity } from '@/features/shared/utils/search-card-gradients';
import { RoleTag } from './RoleTag';

function resolveTranslatedFallback(value: string, key: string, fallback: string) {
  return value === key ? fallback : value;
}

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
  countLabel,
  memberDescriptionFallback,
  defaultRequestLabel,
  defaultInviteLabel,
  noOtherRolesLabel,
  removeActionLabel,
  secondaryActionLabel,
  onSecondaryAction,
  derivedRemoveTooltip,
  secondaryActionTooltip,
  emptyStateLabel,
  showProvenanceColumns = false,
}: MembershipsByRoleTablesProps<TRole, TParticipation>) {
  const { t } = useTranslation();
  const directWithoutPathLabel = t('features.groups.memberships.composition.directWithoutPath');
  const roleFallbackLabel = t('components.membershipTables.roleFallback');
  const resolvedCountLabel = countLabel ?? t('components.membershipTables.members', 'members');
  const resolvedMemberDescriptionFallback =
    memberDescriptionFallback ?? t('components.membershipTables.memberDescriptionFallback');
  const resolvedDefaultRequestLabel =
    defaultRequestLabel ?? t('components.membershipTables.defaultRequest');
  const resolvedDefaultInviteLabel =
    defaultInviteLabel ?? t('components.membershipTables.defaultInvite');
  const resolvedNoOtherRolesLabel =
    noOtherRolesLabel ?? t('components.membershipTables.noOtherRoles');
  const resolvedRemoveActionLabel = removeActionLabel ?? t('components.membershipTables.remove');
  const resolvedDerivedRemoveTooltip =
    derivedRemoveTooltip ?? t('components.membershipTables.derivedRemoveTooltip');
  const resolvedEmptyStateLabel =
    emptyStateLabel ?? t('components.membershipTables.emptyStateByRole');
  const noUserRoleLabel = resolveTranslatedFallback(
    t('components.membershipTables.noUserRole', 'No user role'),
    'components.membershipTables.noUserRole',
    'No user role'
  );
  const noUserRoleDescription = resolveTranslatedFallback(
    t('components.membershipTables.noUserRoleDescription', 'Members without an assigned role.'),
    'components.membershipTables.noUserRoleDescription',
    'Members without an assigned role.'
  );
  const userColumnLabel = t('components.membershipTables.user');
  const otherRolesColumnLabel = t('components.membershipTables.otherRoles');
  const assignedRolesColumnLabel = t('components.membershipTables.assignedRoles');
  const joinedColumnLabel = t('components.membershipTables.joined');
  const actionsColumnLabel = t('components.membershipTables.actions');
  const rightsLabel = t('components.membershipTables.rights');
  const secondaryActionDefaultLabel = t('components.membershipTables.manage');
  const notAvailableLabel = t('components.membershipTables.notAvailable', 'N/A');
  const countTone = entityType === 'event' ? 'info' : 'neutral';
  const membersWithoutRoles = members.filter(
    membership => getMembershipDisplayRoles(membership).length === 0
  );
  const sections = [
    ...roles.map(role => ({
      kind: 'role' as const,
      id: role.id,
      title: role.name || roleFallbackLabel,
      description: role.description || resolvedMemberDescriptionFallback,
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
            title: noUserRoleLabel,
            description: noUserRoleDescription,
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
    const label = getMembershipProvenanceDisplayLabel(membership, column, {
      directWithoutPathLabel,
    });

    if (!group?.id) {
      return <span className="text-muted-foreground">{label}</span>;
    }

    return (
      <EntityBadge asChild tone="info" className="hover:opacity-90">
        <Link to="/group/$id" params={{ id: group.id }}>
          {label}
        </Link>
      </EntityBadge>
    );
  };

  return (
    <div className="space-y-4">
      {sections.map(section => {
        const roleMembers = section.members;
        const provenanceColumns: ColumnDef<TParticipation>[] = showProvenanceColumns
          ? [
              {
                id: 'partGroup',
                header: () => t('components.tableColumns.partGroup'),
                cell: ({ row }) => renderProvenanceGroupTag(row.original, 'partGroup'),
              },
              {
                id: 'baseGroup',
                header: () => t('components.tableColumns.baseGroup'),
                cell: ({ row }) => renderProvenanceGroupTag(row.original, 'baseGroup'),
              },
            ]
          : [];
        const columns: ColumnDef<TParticipation>[] = [
          {
            id: 'user',
            header: userColumnLabel,
            cell: ({ row }) => <UserTableCell user={row.original.user} />,
          },
          {
            id: 'roles',
            header: section.kind === 'role' ? otherRolesColumnLabel : assignedRolesColumnLabel,
            cell: ({ row }) => {
              const membership = row.original;
              const displayRoles = getMembershipDisplayRoles(membership);
              const otherRoles =
                section.kind === 'role' && section.role
                  ? displayRoles.filter(membershipRole => membershipRole.id !== section.role?.id)
                  : displayRoles;

              return (
                <div className="flex flex-wrap gap-2">
                  {otherRoles.length > 0 ? (
                    otherRoles.map(otherRole => (
                      <RoleTag
                        key={otherRole.id}
                        roleId={otherRole.id}
                        roleName={otherRole.name || roleFallbackLabel}
                      />
                    ))
                  ) : section.kind === 'no-role' ? (
                    <RoleTag fallbackKey={`no-role-${membership.id}`}>{noUserRoleLabel}</RoleTag>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {resolvedNoOtherRolesLabel}
                    </span>
                  )}
                </div>
              );
            },
          },
          ...provenanceColumns,
          {
            id: 'joined',
            header: joinedColumnLabel,
            cell: ({ row }) => (
              <span className="text-muted-foreground">
                {row.original.created_at
                  ? new Date(row.original.created_at).toLocaleDateString()
                  : notAvailableLabel}
              </span>
            ),
          },
          {
            id: 'actions',
            header: actionsColumnLabel,
            meta: {
              headerClassName: 'text-right',
              cellClassName: 'text-right',
            },
            cell: ({ row }) => {
              const membership = row.original;

              return (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onOpenRightsDialog(membership)}>
                    <Eye className="mr-1 h-4 w-4" />
                    {rightsLabel}
                  </Button>
                  {onSecondaryAction ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSecondaryAction(membership)}
                      title={secondaryActionTooltip}
                    >
                      {secondaryActionLabel || secondaryActionDefaultLabel}
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
                          ? resolvedDerivedRemoveTooltip
                          : 'Remove this role from the member.'
                      }
                    >
                      {resolvedRemoveActionLabel}
                    </Button>
                  ) : null}
                </div>
              );
            },
          },
        ];

        return (
          <Panel
            key={section.id}
            className="border-border/70 from-background to-muted/20 bg-gradient-to-b"
          >
            <PanelHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <PanelTitle className="flex items-center gap-2">
                    {section.kind === 'role' && section.role ? (
                      <RoleTag roleId={section.role.id} roleName={section.title} />
                    ) : (
                      <span className="font-semibold">{section.title}</span>
                    )}
                    <CountBadge
                      count={roleMembers.length}
                      label={resolvedCountLabel}
                      tone={countTone}
                    />
                  </PanelTitle>
                  <PanelDescription>{section.description}</PanelDescription>
                </div>
                {section.kind === 'role' && section.role ? (
                  <div className="flex flex-wrap gap-2">
                    {section.role.default_request_role ? (
                      <StatusBadge status="active">{resolvedDefaultRequestLabel}</StatusBadge>
                    ) : null}
                    {section.role.default_invite_role ? (
                      <StatusBadge status="invited" tone="info">
                        {resolvedDefaultInviteLabel}
                      </StatusBadge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </PanelHeader>
            <PanelContent>
              <DataTable
                columns={columns}
                data={roleMembers}
                getRowId={membership => `${section.id}-${membership.id}`}
                enablePagination={false}
                emptyTitle={resolvedEmptyStateLabel}
              />
            </PanelContent>
          </Panel>
        );
      })}
    </div>
  );
}
