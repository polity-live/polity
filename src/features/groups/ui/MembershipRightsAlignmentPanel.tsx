import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Eye } from 'lucide-react';
import { TableActionIconButton, type ColumnDef } from '@/features/shared/ui/data-table';
import { StatusBadge as SharedStatusBadge } from '@/features/shared/ui/status';
import { UserTableCell } from '@/features/shared/ui/data-table';
import { getRightLabel } from '@/features/shared/ui/status';
import { getMembershipDisplayRoles } from '../logic/buildMembershipRightsSummary';
import type {
  ActionRightDefinition,
  MembershipRightsAlignmentRow,
  MembershipRightsAlignmentStatus,
} from '../logic/membershipRightsAlignment';
import type { MembershipProvenanceGroup } from '../types/group.types';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { RoleTag } from './RoleTag';

type AlignmentFilter = 'all' | MembershipRightsAlignmentStatus;

interface MembershipRightsAlignmentPanelProps<TMembership extends ParticipationLike> {
  rows: readonly MembershipRightsAlignmentRow<TMembership>[];
  isLoading?: boolean;
  onOpenRightsDialog: (membership: TMembership) => void;
  onOpenChangeRoleDialog: (membership: TMembership) => void;
}

const STATUS_ORDER: Record<MembershipRightsAlignmentStatus, number> = {
  mixed: 0,
  missing: 1,
  extra: 2,
  aligned: 3,
};
import { MembershipRightsAlignmentPanelView } from './MembershipRightsAlignmentPanelView';
export function MembershipRightsAlignmentPanel<TMembership extends ParticipationLike>({
  rows,
  isLoading = false,
  onOpenRightsDialog,
  onOpenChangeRoleDialog,
}: MembershipRightsAlignmentPanelProps<TMembership>) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<AlignmentFilter>('all');

  const counts = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc[row.status] += 1;
          return acc;
        },
        { aligned: 0, missing: 0, extra: 0, mixed: 0 }
      ),
    [rows]
  );
  const visibleRows = useMemo(
    () =>
      [...rows]
        .filter(row => filter === 'all' || row.status === filter)
        .sort((left, right) => {
          const statusDelta = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
          if (statusDelta !== 0) {
            return statusDelta;
          }
          return getMemberName(left.membership).localeCompare(
            getMemberName(right.membership),
            undefined,
            { sensitivity: 'base' }
          );
        }),
    [filter, rows]
  );
  const columns: ColumnDef<MembershipRightsAlignmentRow<TMembership>>[] = [
    {
      id: 'member',
      header: t('features.groups.memberships.rightsAlignment.columns.member'),
      meta: {
        className: 'min-w-[220px]',
      },
      cell: ({ row }) => (
        <div className="space-y-2">
          <UserTableCell user={row.original.membership.user} />
          <AlignmentStatusBadge status={row.original.status} />
        </div>
      ),
    },
    {
      id: 'origin',
      header: t('features.groups.memberships.rightsAlignment.columns.origin'),
      meta: {
        className: 'min-w-[180px]',
      },
      cell: ({ row }) => (
        <OriginCell
          partGroup={row.original.membership.partGroup ?? null}
          baseGroup={row.original.membership.baseGroup ?? null}
          sourceGroupId={row.original.sourceGroupId}
        />
      ),
    },
    {
      id: 'connectedRights',
      header: t('features.groups.memberships.rightsAlignment.columns.connectedRights'),
      meta: {
        className: 'min-w-[180px]',
      },
      cell: ({ row }) => <ConnectedRightsCell row={row.original} />,
    },
    {
      id: 'missing',
      header: t('features.groups.memberships.rightsAlignment.columns.missing'),
      meta: {
        className: 'min-w-[220px]',
      },
      cell: ({ row }) => <ActionRightList rights={row.original.missingRights} variant="missing" />,
    },
    {
      id: 'extra',
      header: t('features.groups.memberships.rightsAlignment.columns.extra'),
      meta: {
        className: 'min-w-[220px]',
      },
      cell: ({ row }) => <ActionRightList rights={row.original.extraRights} variant="extra" />,
    },
    {
      id: 'roles',
      header: t('features.groups.memberships.rightsAlignment.columns.roles'),
      meta: {
        className: 'min-w-[180px]',
      },
      cell: ({ row }) => <RoleList membership={row.original.membership} />,
    },
    {
      id: 'actions',
      header: t('features.groups.memberships.rightsAlignment.columns.actions'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <TableActionIconButton
            label={t('features.groups.memberships.rightsAlignment.actions.rights')}
            icon={<Eye className="h-4 w-4" />}
            onClick={() => onOpenRightsDialog(row.original.membership)}
          />
          <TableActionIconButton
            label={t('features.groups.memberships.rightsAlignment.actions.manageRoles')}
            icon={<ArrowUpDown className="h-4 w-4" />}
            variant="outline"
            onClick={() => onOpenChangeRoleDialog(row.original.membership)}
          />
        </div>
      ),
    },
  ];
  return (
    <MembershipRightsAlignmentPanelView
      rows={rows}
      isLoading={isLoading}
      onOpenRightsDialog={onOpenRightsDialog}
      onOpenChangeRoleDialog={onOpenChangeRoleDialog}
      t={t}
      filter={filter}
      setFilter={setFilter}
      counts={counts}
      visibleRows={visibleRows}
      columns={columns}
    />
  );
}
function AlignmentStatusBadge({ status }: { status: MembershipRightsAlignmentStatus }) {
  const { t } = useTranslation();
  const tone =
    status === 'aligned'
      ? 'success'
      : status === 'missing'
        ? 'warning'
        : status === 'extra'
          ? 'info'
          : 'destructive';

  return (
    <SharedStatusBadge status={status} tone={tone}>
      {getStatusLabel(status, t)}
    </SharedStatusBadge>
  );
}

function OriginCell({
  partGroup,
  baseGroup,
  sourceGroupId,
}: {
  partGroup: MembershipProvenanceGroup | null;
  baseGroup: MembershipProvenanceGroup | null;
  sourceGroupId: string | null;
}) {
  const { t } = useTranslation();
  const fallback = tText(t, 'features.groups.memberships.rightsAlignment.noOrigin', 'No origin');

  if (!partGroup && !baseGroup && !sourceGroupId) {
    return <span className="text-muted-foreground text-sm">{fallback}</span>;
  }

  return (
    <div className="space-y-1 text-sm">
      <div>
        <span className="text-muted-foreground">
          {t('features.groups.memberships.rightsAlignment.partGroup')}:{' '}
        </span>
        <span className="font-medium">{partGroup?.name ?? sourceGroupId ?? fallback}</span>
      </div>
      <div>
        <span className="text-muted-foreground">
          {t('features.groups.memberships.rightsAlignment.baseGroup')}:{' '}
        </span>
        <span className="font-medium">{baseGroup?.name ?? sourceGroupId ?? fallback}</span>
      </div>
    </div>
  );
}

function ConnectedRightsCell<TMembership extends ParticipationLike>({
  row,
}: {
  row: MembershipRightsAlignmentRow<TMembership>;
}) {
  const { t } = useTranslation();

  if (row.connectedRights.length === 0) {
    return (
      <span className="text-muted-foreground text-sm">
        {t('features.groups.memberships.rightsAlignment.noConnectedRights')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {row.connectedRights.map(right => (
        <SharedStatusBadge
          key={right.rightKey}
          status="connected"
          tone="neutral"
          title={formatPathTitle(right.paths)}
        >
          {getRightLabel(right.rightKey, (key, fallback) => tText(t, key, fallback ?? key))}
        </SharedStatusBadge>
      ))}
    </div>
  );
}

function ActionRightList({
  rights,
  variant,
}: {
  rights: readonly (
    | ActionRightDefinition
    | { key: string; resource: string; action: string; label: string }
  )[];
  variant: 'missing' | 'extra';
}) {
  const { t } = useTranslation();

  if (rights.length === 0) {
    return (
      <span className="text-muted-foreground text-sm">
        {t('features.groups.memberships.rightsAlignment.none')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {rights.map(right => (
        <SharedStatusBadge
          key={`${right.resource}:${right.action}`}
          status={variant}
          tone={variant === 'missing' ? 'warning' : 'info'}
        >
          {right.label}
        </SharedStatusBadge>
      ))}
    </div>
  );
}

function RoleList<TMembership extends ParticipationLike>({
  membership,
}: {
  membership: TMembership;
}) {
  const { t } = useTranslation();
  const roles = getMembershipDisplayRoles(membership);

  if (roles.length === 0) {
    return (
      <RoleTag fallbackKey={`alignment-${membership.id}`}>
        {tText(t, 'components.membershipTables.memberFallback', 'Member')}
      </RoleTag>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {roles.map(role => (
        <RoleTag key={role.id} roleId={role.id} roleName={role.name || 'Role'} />
      ))}
    </div>
  );
}

function getStatusLabel(status: MembershipRightsAlignmentStatus, t: unknown) {
  return tText(t, `features.groups.memberships.rightsAlignment.status.${status}`, status);
}

function tText(t: unknown, key: string, fallback: string) {
  const translate = t as (translationKey: string, fallbackValue: string) => unknown;
  const value = translate(key, fallback);
  return typeof value === 'string' ? value : String(value ?? fallback);
}

function getMemberName(membership: ParticipationLike) {
  return (
    [membership.user?.first_name, membership.user?.last_name].filter(Boolean).join(' ') ||
    membership.user?.handle ||
    membership.user?.email ||
    membership.user_id ||
    membership.id
  );
}

function formatPathTitle(paths: readonly { groupPath: string[] }[]) {
  return paths.map(path => path.groupPath.join(' > ')).join('\n');
}
