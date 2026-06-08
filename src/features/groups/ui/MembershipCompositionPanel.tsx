import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { DIRECT_WITHOUT_PATH_LABEL } from '@/features/groups/logic/membershipComposition';
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

const CHART_COLORS = [
  '#2563eb',
  '#0d9488',
  '#7c3aed',
  '#ea580c',
  '#db2777',
  '#65a30d',
  '#0891b2',
  '#dc2626',
];

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
  const directWithoutPathLabel = t(
    'features.groups.memberships.composition.directWithoutPath',
    'Direct / no path'
  );

  const memberRows = useMemo(
    () =>
      buckets
        .filter(bucket => bucket.memberCount > 0)
        .map((bucket, index) => ({
          ...bucket,
          label: bucket.label === DIRECT_WITHOUT_PATH_LABEL ? directWithoutPathLabel : bucket.label,
          value: bucket.memberCount,
          percentage: bucket.memberPercentage,
          fill: CHART_COLORS[index % CHART_COLORS.length],
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
          fill: CHART_COLORS[index % CHART_COLORS.length],
        })),
    [buckets, directWithoutPathLabel]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {t('features.groups.memberships.composition.title', 'Composition')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t(
              'features.groups.memberships.composition.description',
              'Breakdown by subgroups. Leadership counts non-member role assignments.'
            )}
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
            {t('features.groups.memberships.composition.modeAbsolute', 'Absolute')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CompositionPieCard
          title={t('features.groups.memberships.composition.membersTitle', 'Members')}
          description={t(
            'features.groups.memberships.composition.membersDescription',
            'Share of subgroups across all active memberships.'
          )}
          emptyLabel={t(
            'features.groups.memberships.composition.membersEmpty',
            'No active members found.'
          )}
          rows={memberRows}
          displayMode={displayMode}
          isLoading={isLoading}
          metric="members"
        />
        <CompositionPieCard
          title={t('features.groups.memberships.composition.leadershipTitle', 'Leadership')}
          description={t(
            'features.groups.memberships.composition.leadershipDescription',
            'Share of subgroups across all non-member role assignments.'
          )}
          emptyLabel={t(
            'features.groups.memberships.composition.leadershipEmpty',
            'No non-member role assignments found.'
          )}
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
            {t('features.groups.memberships.composition.loading', 'Loading composition...')}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">{emptyLabel}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={70}
                    outerRadius={106}
                    paddingAngle={2}
                  >
                    {rows.map(row => (
                      <Cell key={row.key} fill={row.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, payload) => {
                      const row = payload?.payload as
                        | (MembershipCompositionBucket & {
                            value: number;
                            percentage: number;
                            fill: string;
                          })
                        | undefined;

                      if (!row) {
                        return [String(value), title];
                      }

                      return [
                        displayMode === 'absolute'
                          ? row.value.toLocaleString()
                          : `${row.percentage.toFixed(1)}%`,
                        title,
                      ];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

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
                  {t(
                    'features.groups.memberships.composition.leadershipFootnote',
                    'Each non-member role is counted separately.'
                  )}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
