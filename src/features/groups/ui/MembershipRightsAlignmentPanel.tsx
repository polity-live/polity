import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Eye, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import { UserTableCell } from '@/features/shared/ui/ui/user-table-cell';
import { cn } from '@/features/shared/utils/utils';
import { getRightLabel } from '@/features/network/ui/RightFilters';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {t('features.groups.memberships.rightsAlignment.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('features.groups.memberships.rightsAlignment.description')}
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={value => {
            if (isAlignmentFilter(value)) {
              setFilter(value);
            }
          }}
          variant="outline"
          size="sm"
          className="justify-start"
        >
          <ToggleGroupItem value="all">
            {t('features.groups.memberships.rightsAlignment.filters.all')} ({rows.length})
          </ToggleGroupItem>
          <ToggleGroupItem value="missing">
            {t('features.groups.memberships.rightsAlignment.filters.missing')} ({counts.missing})
          </ToggleGroupItem>
          <ToggleGroupItem value="extra">
            {t('features.groups.memberships.rightsAlignment.filters.extra')} ({counts.extra})
          </ToggleGroupItem>
          <ToggleGroupItem value="mixed">
            {t('features.groups.memberships.rightsAlignment.filters.mixed')} ({counts.mixed})
          </ToggleGroupItem>
          <ToggleGroupItem value="aligned">
            {t('features.groups.memberships.rightsAlignment.filters.aligned')} ({counts.aligned})
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryTile status="aligned" count={counts.aligned} />
        <SummaryTile status="missing" count={counts.missing} />
        <SummaryTile status="extra" count={counts.extra} />
        <SummaryTile status="mixed" count={counts.mixed} />
      </div>

      <Card className="border-border/70 from-background to-muted/20 bg-gradient-to-b">
        <CardHeader>
          <CardTitle>{t('features.groups.memberships.rightsAlignment.tableTitle')}</CardTitle>
          <CardDescription>
            {t('features.groups.memberships.rightsAlignment.tableDescription', {
              count: visibleRows.length,
              defaultValue: '{{count}} visible members',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              {t('features.groups.memberships.rightsAlignment.loading')}
            </p>
          ) : visibleRows.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              {t('features.groups.memberships.rightsAlignment.empty')}
            </p>
          ) : (
            <div className="border-border/70 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">
                      {t('features.groups.memberships.rightsAlignment.columns.member')}
                    </TableHead>
                    <TableHead className="min-w-[180px]">
                      {t('features.groups.memberships.rightsAlignment.columns.origin')}
                    </TableHead>
                    <TableHead className="min-w-[180px]">
                      {t('features.groups.memberships.rightsAlignment.columns.connectedRights')}
                    </TableHead>
                    <TableHead className="min-w-[220px]">
                      {t('features.groups.memberships.rightsAlignment.columns.missing')}
                    </TableHead>
                    <TableHead className="min-w-[220px]">
                      {t('features.groups.memberships.rightsAlignment.columns.extra')}
                    </TableHead>
                    <TableHead className="min-w-[180px]">
                      {t('features.groups.memberships.rightsAlignment.columns.roles')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('features.groups.memberships.rightsAlignment.columns.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map(row => (
                    <TableRow key={row.membership.id}>
                      <TableCell>
                        <div className="space-y-2">
                          <UserTableCell user={row.membership.user} />
                          <StatusBadge status={row.status} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <OriginCell
                          partGroup={row.membership.partGroup ?? null}
                          baseGroup={row.membership.baseGroup ?? null}
                          sourceGroupId={row.sourceGroupId}
                        />
                      </TableCell>
                      <TableCell>
                        <ConnectedRightsCell row={row} />
                      </TableCell>
                      <TableCell>
                        <ActionRightList rights={row.missingRights} variant="missing" />
                      </TableCell>
                      <TableCell>
                        <ActionRightList rights={row.extraRights} variant="extra" />
                      </TableCell>
                      <TableCell>
                        <RoleList membership={row.membership} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenRightsDialog(row.membership)}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            {t('features.groups.memberships.rightsAlignment.actions.rights')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChangeRoleDialog(row.membership)}
                          >
                            <ArrowUpDown className="mr-1 h-4 w-4" />
                            {t('features.groups.memberships.rightsAlignment.actions.manageRoles')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  status,
  count,
}: {
  status: MembershipRightsAlignmentStatus;
  count: number;
}) {
  const { t } = useTranslation();
  const Icon = status === 'aligned' ? ShieldCheck : status === 'mixed' ? ShieldAlert : ShieldX;

  return (
    <div
      className={cn(
        'border-border/70 rounded-lg border px-4 py-3',
        status === 'aligned' &&
          'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100',
        status === 'missing' &&
          'bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100',
        status === 'extra' && 'bg-sky-50 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100',
        status === 'mixed' && 'bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-100'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{count}</div>
          <div className="text-sm">{getStatusLabel(status, t)}</div>
        </div>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: MembershipRightsAlignmentStatus }) {
  const { t } = useTranslation();
  const className =
    status === 'aligned'
      ? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
      : status === 'missing'
        ? 'border-amber-500/50 text-amber-700 dark:text-amber-300'
        : status === 'extra'
          ? 'border-sky-500/50 text-sky-700 dark:text-sky-300'
          : 'border-rose-500/50 text-rose-700 dark:text-rose-300';

  return (
    <Badge variant="outline" className={className}>
      {getStatusLabel(status, t)}
    </Badge>
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
        <Badge key={right.rightKey} variant="secondary" title={formatPathTitle(right.paths)}>
          {getRightLabel(right.rightKey, (key, fallback) => tText(t, key, fallback ?? key))}
        </Badge>
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
        <Badge
          key={`${right.resource}:${right.action}`}
          variant="outline"
          className={
            variant === 'missing'
              ? 'border-amber-500/50 text-amber-700 dark:text-amber-300'
              : 'border-sky-500/50 text-sky-700 dark:text-sky-300'
          }
        >
          {right.label}
        </Badge>
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

function isAlignmentFilter(value: string): value is AlignmentFilter {
  return (
    value === 'all' ||
    value === 'aligned' ||
    value === 'missing' ||
    value === 'extra' ||
    value === 'mixed'
  );
}
