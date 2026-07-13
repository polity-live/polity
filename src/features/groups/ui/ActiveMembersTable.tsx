/**
 * Active Members Table Component
 *
 * Displays active group members with role management and actions.
 */

import { Link } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  DataTable,
  VirtualDataTable,
  TableActionIconButton,
  type ColumnDef,
  type VirtualDataTableSource,
} from '@/features/shared/ui/data-table';
import { EntityBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { UserTableCell } from '@/features/shared/ui/data-table';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { getMembershipDisplayRoles } from '../logic/buildMembershipRightsSummary';
import { getMembershipProvenanceDisplayLabel } from '../logic/membershipComposition';
import type { MembershipSort, MembershipSortField } from '../types/group.types';
import { RoleTag } from './RoleTag';
import { ManagementSection } from '@/features/shared/ui/form';
import { CountBadge } from '@/features/shared/ui/status';

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
  showPartGroupColumn?: boolean;
  showBaseGroupColumn?: boolean;
  showDelegateRepresentationColumn?: boolean;
  virtualSource?: VirtualDataTableSource<TMembership, any, any>;
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
  showPartGroupColumn = false,
  showBaseGroupColumn = false,
  showDelegateRepresentationColumn = false,
  virtualSource,
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
  const notAvailableLabel = t('components.membershipTables.notAvailable');
  const noDelegateRepresentationLabel = t(
    'components.membershipTables.noDelegateRepresentation',
    '-'
  );
  const shouldShowPartGroupColumn = showProvenanceColumns || showPartGroupColumn;
  const shouldShowBaseGroupColumn = showProvenanceColumns || showBaseGroupColumn;

  const renderProvenanceGroupTag = (membership: TMembership, column: 'partGroup' | 'baseGroup') => {
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

  const renderDelegateRepresentationTags = (membership: TMembership) => {
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

  const delegateRepresentationColumns: ColumnDef<TMembership>[] = showDelegateRepresentationColumn
    ? [
        {
          id: 'delegateRepresents',
          header: () => t('components.tableColumns.delegateRepresents'),
          cell: ({ row }) => renderDelegateRepresentationTags(row.original),
        },
      ]
    : [];

  const partGroupColumns: ColumnDef<TMembership>[] = shouldShowPartGroupColumn
    ? [
        {
          id: 'partGroup',
          header: () => t('components.tableColumns.partGroup'),
          cell: ({ row }) => renderProvenanceGroupTag(row.original, 'partGroup'),
        },
      ]
    : [];

  const baseGroupColumns: ColumnDef<TMembership>[] = shouldShowBaseGroupColumn
    ? [
        {
          id: 'baseGroup',
          header: () => t('components.tableColumns.baseGroup'),
          cell: ({ row }) => renderProvenanceGroupTag(row.original, 'baseGroup'),
        },
      ]
    : [];

  const columns: ColumnDef<TMembership>[] = [
    {
      id: 'user',
      header: () => (
        <SortButton label={userColumnLabel} field="user" sort={sort} onSortChange={onSortChange} />
      ),
      cell: ({ row }) => <UserTableCell user={row.original.user} />,
    },
    {
      id: 'role',
      header: () => (
        <SortButton label={roleColumnLabel} field="role" sort={sort} onSortChange={onSortChange} />
      ),
      cell: ({ row }) => {
        const membership = row.original;
        const displayRoles = getMembershipDisplayRoles(membership);

        return (
          <div className="flex flex-wrap gap-2">
            {displayRoles.length > 0 ? (
              displayRoles.map(role => (
                <RoleTag key={role.id} roleId={role.id} roleName={role.name || 'Role'} />
              ))
            ) : (
              <RoleTag fallbackKey={`member-${membership.id}`}>{resolvedFallbackRoleLabel}</RoleTag>
            )}
          </div>
        );
      },
    },
    ...delegateRepresentationColumns,
    ...partGroupColumns,
    ...baseGroupColumns,
    {
      id: 'joined',
      header: joinedColumnLabel,
      cell: ({ row }) => {
        const createdAt = row.original.created_at
          ? new Date(row.original.created_at).toLocaleDateString()
          : notAvailableLabel;

        return <span className="text-muted-foreground">{createdAt}</span>;
      },
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
        const userId = membership.user?.id || null;
        const effectiveReadOnly = Boolean(
          (membership as TMembership & { effectiveReadOnly?: boolean }).effectiveReadOnly
        );

        return (
          <div className="flex justify-end gap-2">
            <TableActionIconButton
              label={rightsLabel}
              icon={<Eye className="h-4 w-4" />}
              onClick={() => onOpenRightsDialog(membership)}
            />
            {!effectiveReadOnly ? (
              <TableActionIconButton
                label={resolvedManageRolesLabel}
                icon={<ArrowUpDown className="h-4 w-4" />}
                variant="outline"
                onClick={() => onOpenChangeRoleDialog(membership)}
              />
            ) : null}
            {membership.source !== 'derived' && !effectiveReadOnly && userId ? (
              <TableActionIconButton
                label={resolvedRemoveLabel}
                icon={<Trash2 className="h-4 w-4" />}
                destructive
                onClick={() => onRemove(membership.id, userId)}
              />
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <ManagementSection
      className="civic-load-card-reveal space-y-3"
      style={{ '--civic-load-index': 2 } as CSSProperties}
      title={
        <span className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {resolvedTitle}
          <CountBadge count={members.length} />
        </span>
      }
      description={resolvedDescription}
    >
      {virtualSource ? (
        <VirtualDataTable
          columns={columns}
          source={virtualSource}
          emptyTitle={t('components.membershipTables.noActiveMembers')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={members}
          getRowId={membership => membership.id}
          enablePagination={false}
          emptyTitle={t('components.membershipTables.noActiveMembers')}
        />
      )}
    </ManagementSection>
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
      type="button"
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
