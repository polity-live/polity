import { Link } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { ArrowUpDown, Eye, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getMembershipDisplayRoles } from '@/features/groups/logic/membershipDisplayRoles';
import { getMembershipProvenanceDisplayLabel } from '@/features/groups/logic/membershipComposition';
import type {
  ParticipationLike,
  ParticipationRoleLike,
} from '@/features/shared/types/participation';
import { DataTable, TableActionIconButton, type ColumnDef } from '@/features/shared/ui/data-table';
import { CountBadge, EntityBadge, StatusBadge } from '@/features/shared/ui/status';
import { UserTableCell } from '@/features/shared/ui/data-table';
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
  showDelegateRepresentationColumn?: boolean;
  hideEmptyRoleSections?: boolean;
}

export function MembershipsByRoleTables<
  TRole extends ParticipationRoleLike,
  TParticipation extends ParticipationLike,
>({
  roles,
  members,
  onOpenRightsDialog,
  onRemoveRole,
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
  showDelegateRepresentationColumn = false,
  hideEmptyRoleSections = false,
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
  const noDelegateRepresentationLabel = t(
    'components.membershipTables.noDelegateRepresentation',
    '-'
  );
  const countTone = 'neutral';
  const membersWithoutRoles = members.filter(
    membership => getMembershipDisplayRoles(membership).length === 0
  );
  const roleSections = roles.map(role => ({
    kind: 'role' as const,
    id: role.id,
    title: role.name || roleFallbackLabel,
    description: role.description || resolvedMemberDescriptionFallback,
    role,
    members: members.filter(membership =>
      getMembershipDisplayRoles(membership).some(membershipRole => membershipRole.id === role.id)
    ),
  }));
  const sections = [
    ...(hideEmptyRoleSections
      ? roleSections.filter(section => section.members.length > 0)
      : roleSections),
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

  const renderDelegateRepresentationTags = (membership: TParticipation) => {
    const groups = membership.delegateRepresentedGroups ?? [];

    if (groups.length === 0) {
      return <span className="text-muted-foreground">{noDelegateRepresentationLabel}</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {groups.map(group => {
          const label = group.seatCount > 1 ? `${group.name} (${group.seatCount})` : group.name;

          return (
            <EntityBadge key={group.id} asChild tone="info" className="hover:opacity-90">
              <Link to="/group/$id" params={{ id: group.id }}>
                {label}
              </Link>
            </EntityBadge>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {sections.map((section, sectionIndex) => {
        const roleMembers = section.members;
        const delegateRepresentationColumns: ColumnDef<TParticipation>[] =
          showDelegateRepresentationColumn
            ? [
                {
                  id: 'delegateRepresents',
                  header: () => t('components.tableColumns.delegateRepresents'),
                  cell: ({ row }) => renderDelegateRepresentationTags(row.original),
                },
              ]
            : [];
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
          ...delegateRepresentationColumns,
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
              const effectiveReadOnly = Boolean(
                (membership as TParticipation & { effectiveReadOnly?: boolean }).effectiveReadOnly
              );

              return (
                <div className="flex justify-end gap-2">
                  <TableActionIconButton
                    label={rightsLabel}
                    icon={<Eye className="h-4 w-4" />}
                    onClick={() => onOpenRightsDialog(membership)}
                  />
                  {onSecondaryAction && !effectiveReadOnly ? (
                    <TableActionIconButton
                      label={secondaryActionLabel || secondaryActionDefaultLabel}
                      tooltip={secondaryActionTooltip}
                      icon={<ArrowUpDown className="h-4 w-4" />}
                      variant="outline"
                      onClick={() => onSecondaryAction(membership)}
                    />
                  ) : null}
                  {section.kind === 'role' && section.role ? (
                    <TableActionIconButton
                      label={resolvedRemoveActionLabel}
                      icon={<Trash2 className="h-4 w-4" />}
                      variant="ghost"
                      destructive
                      disabled={membership.source === 'derived' || effectiveReadOnly}
                      onClick={() => onRemoveRole(membership, section.role.id)}
                      tooltip={
                        membership.source === 'derived' || effectiveReadOnly
                          ? resolvedDerivedRemoveTooltip
                          : resolvedRemoveActionLabel
                      }
                    />
                  ) : null}
                </div>
              );
            },
          },
        ];

        return (
          <section
            key={section.id}
            className="civic-load-card-reveal space-y-3"
            style={{ '--civic-load-index': Math.min(sectionIndex, 11) } as CSSProperties}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 px-3 sm:px-4">
              <div className="space-y-1.5">
                <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
                  {section.kind === 'role' && section.role ? (
                    <RoleTag roleId={section.role.id} roleName={section.title} />
                  ) : (
                    <span>{section.title}</span>
                  )}
                  <CountBadge
                    count={roleMembers.length}
                    label={resolvedCountLabel}
                    tone={countTone}
                  />
                </h2>
                <p className="text-muted-foreground text-sm">{section.description}</p>
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
            <DataTable
              columns={columns}
              data={roleMembers}
              getRowId={membership => `${section.id}-${membership.id}`}
              enablePagination={false}
              emptyTitle={resolvedEmptyStateLabel}
            />
          </section>
        );
      })}
    </div>
  );
}
