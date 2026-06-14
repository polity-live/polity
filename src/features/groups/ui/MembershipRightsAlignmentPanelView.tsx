import { featureThemeClassName } from '@/features/shared/theme';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { DataTable } from '@/features/shared/ui/data-table';
import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import { cn } from '@/features/shared/utils/utils';
import type { MembershipRightsAlignmentStatus } from '../logic/membershipRightsAlignment';
type AlignmentFilter = 'all' | MembershipRightsAlignmentStatus;
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
          featureThemeClassName('groupMembershipRightsAlignmentPanelSuccessBackground'),
        status === 'missing' &&
          featureThemeClassName('groupMembershipRightsAlignmentPanelWarningBackground'),
        status === 'extra' &&
          featureThemeClassName('groupMembershipRightsAlignmentPanelInfoBackground'),
        status === 'mixed' &&
          featureThemeClassName('groupMembershipRightsAlignmentPanelDangerBackground')
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
function getStatusLabel(status: MembershipRightsAlignmentStatus, t: unknown) {
  return tText(t, `features.groups.memberships.rightsAlignment.status.${status}`, status);
}

function tText(t: unknown, key: string, fallback: string) {
  const translate = t as (translationKey: string, fallbackValue: string) => unknown;
  const value = translate(key, fallback);
  return typeof value === 'string' ? value : String(value ?? fallback);
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

export interface MembershipRightsAlignmentPanelViewProps {
  rows: any;
  isLoading: any;
  onOpenRightsDialog: any;
  onOpenChangeRoleDialog: any;
  t: any;
  filter: any;
  setFilter: any;
  counts: any;
  visibleRows: any;
  columns: any;
}

export function MembershipRightsAlignmentPanelView({
  rows,
  isLoading,
  t,
  filter,
  setFilter,
  counts,
  visibleRows,
  columns,
}: MembershipRightsAlignmentPanelViewProps) {
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

      <Panel
        className={featureThemeClassName(
          'groupMembershipRightsAlignmentPanelThemedGradientSurface'
        )}
      >
        <PanelHeader>
          <PanelTitle>{t('features.groups.memberships.rightsAlignment.tableTitle')}</PanelTitle>
          <PanelDescription>
            {t('features.groups.memberships.rightsAlignment.tableDescription', {
              count: visibleRows.length,
              defaultValue: '{{count}} visible members',
            })}
          </PanelDescription>
        </PanelHeader>
        <PanelContent>
          <DataTable
            columns={columns}
            data={visibleRows}
            getRowId={(row: any) => row.membership.id}
            isLoading={isLoading}
            loadingRowCount={4}
            enablePagination={false}
            emptyTitle={t('features.groups.memberships.rightsAlignment.empty')}
            emptyDescription={
              isLoading ? t('features.groups.memberships.rightsAlignment.loading') : undefined
            }
          />
        </PanelContent>
      </Panel>
    </div>
  );
}
