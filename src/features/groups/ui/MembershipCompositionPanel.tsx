import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DIRECT_WITHOUT_PATH_LABEL } from '@/features/groups/logic/membershipComposition';
import { ChartRenderer, CHART_PALETTE } from '@/features/charts/ui/ChartRenderer';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import type { MembershipCompositionBucket } from '../types/group.types';

type CompositionDisplayMode = 'percent' | 'absolute';
type CompositionMetric = 'members' | 'leadership';

interface MembershipCompositionPanelProps {
  buckets: MembershipCompositionBucket[];
  isLoading?: boolean;
}

export function MembershipCompositionPanel({
  buckets,
  isLoading = false,
}: MembershipCompositionPanelProps) {
  const { t } = useTranslation();
  const [displayMode, setDisplayMode] = useState<CompositionDisplayMode>('percent');
  const directWithoutPathLabel = t('features.groups.memberships.composition.directWithoutPath');

  const memberRows = useMemo(
    () =>
      buckets
        .filter(bucket => bucket.memberCount > 0)
        .map((bucket, index) => ({
          ...bucket,
          label: bucket.label === DIRECT_WITHOUT_PATH_LABEL ? directWithoutPathLabel : bucket.label,
          value: bucket.memberCount,
          percentage: bucket.memberPercentage,
          fill: CHART_PALETTE[index % CHART_PALETTE.length],
        })),
    [buckets, directWithoutPathLabel]
  );
  const leadershipRows = useMemo(
    () =>
      buckets
        .filter(bucket => bucket.leadershipAssignmentCount > 0)
        .map((bucket, index) => ({
          ...bucket,
          label: bucket.label === DIRECT_WITHOUT_PATH_LABEL ? directWithoutPathLabel : bucket.label,
          value: bucket.leadershipAssignmentCount,
          percentage: bucket.leadershipPercentage,
          fill: CHART_PALETTE[index % CHART_PALETTE.length],
        })),
    [buckets, directWithoutPathLabel]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {t('features.groups.memberships.composition.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('features.groups.memberships.composition.description')}
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={displayMode}
          onValueChange={value => {
            if (value === 'percent' || value === 'absolute') {
              setDisplayMode(value);
            }
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="percent">
            {t('features.groups.memberships.composition.modePercent', '%')}
          </ToggleGroupItem>
          <ToggleGroupItem value="absolute">
            {t('features.groups.memberships.composition.modeAbsolute')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CompositionPieCard
          title={t('features.groups.memberships.composition.membersTitle')}
          description={t('features.groups.memberships.composition.membersDescription')}
          emptyLabel={t('features.groups.memberships.composition.membersEmpty')}
          rows={memberRows}
          displayMode={displayMode}
          isLoading={isLoading}
          metric="members"
        />
        <CompositionPieCard
          title={t('features.groups.memberships.composition.leadershipTitle')}
          description={t('features.groups.memberships.composition.leadershipDescription')}
          emptyLabel={t('features.groups.memberships.composition.leadershipEmpty')}
          rows={leadershipRows}
          displayMode={displayMode}
          isLoading={isLoading}
          metric="leadership"
        />
      </div>
    </div>
  );
}

interface CompositionPieCardProps {
  title: string;
  description: string;
  emptyLabel: string;
  rows: (MembershipCompositionBucket & { value: number; percentage: number; fill: string })[];
  displayMode: CompositionDisplayMode;
  isLoading: boolean;
  metric: CompositionMetric;
}

function CompositionPieCard({
  title,
  description,
  emptyLabel,
  rows,
  displayMode,
  isLoading,
  metric,
}: CompositionPieCardProps) {
  const { t } = useTranslation();
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card className="border-border/70 from-background to-muted/20 bg-gradient-to-b">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {t('features.groups.memberships.composition.loading')}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">{emptyLabel}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
            <ChartRenderer
              chartType="pie"
              points={rows.map(row => ({ x: row.label, value: row.value }))}
              presentation={{ donut: true, showLegend: false }}
              heightClassName="h-72"
              valueFormatter={(value, point) => {
                const row = rows.find(item => item.label === point.x);
                return displayMode === 'absolute'
                  ? value.toLocaleString()
                  : `${(row?.percentage ?? 0).toFixed(1)}%`;
              }}
            />

            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {t('features.groups.memberships.composition.total', {
                  defaultValue: 'Total: {{count}}',
                  count: total,
                })}
              </p>
              <ul className="space-y-2">
                {rows.map(row => (
                  <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.fill }}
                      />
                      <span className="truncate">{row.label}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {displayMode === 'absolute'
                        ? row.value.toLocaleString()
                        : `${row.percentage.toFixed(1)}%`}
                    </span>
                  </li>
                ))}
              </ul>
              {metric === 'leadership' ? (
                <p className="text-muted-foreground text-xs">
                  {t('features.groups.memberships.composition.leadershipFootnote')}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
