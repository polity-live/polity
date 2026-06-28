import { ChartRenderer } from '@/features/charts/ui/ChartRenderer';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import type { MembershipCompositionBucket } from '../types/group.types';
import type { CompositionDisplayMode } from '../hooks/useMembershipCompositionPanelController';

type CompositionMetric = 'members' | 'leadership';

interface MembershipCompositionPanelViewProps {
  isLoading: boolean;
  displayMode: CompositionDisplayMode;
  memberRows: (MembershipCompositionBucket & {
    value: number;
    percentage: number;
    fill: string;
  })[];
  leadershipRows: (MembershipCompositionBucket & {
    value: number;
    percentage: number;
    fill: string;
  })[];
  labels: {
    title: string;
    description: string;
    modePercent: string;
    modeAbsolute: string;
    membersTitle: string;
    membersDescription: string;
    membersEmpty: string;
    leadershipTitle: string;
    leadershipDescription: string;
    leadershipEmpty: string;
    loading: string;
    total: (count: number) => string;
    leadershipFootnote: string;
  };
  onDisplayModeChange: (value: string) => void;
}

export function MembershipCompositionPanelView({
  isLoading,
  displayMode,
  memberRows,
  leadershipRows,
  labels,
  onDisplayModeChange,
}: MembershipCompositionPanelViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{labels.title}</h2>
          <p className="text-muted-foreground text-sm">{labels.description}</p>
        </div>
        <ToggleGroup
          type="single"
          value={displayMode}
          onValueChange={onDisplayModeChange}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="percent">{labels.modePercent}</ToggleGroupItem>
          <ToggleGroupItem value="absolute">{labels.modeAbsolute}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CompositionPieCard
          title={labels.membersTitle}
          description={labels.membersDescription}
          emptyLabel={labels.membersEmpty}
          rows={memberRows}
          displayMode={displayMode}
          isLoading={isLoading}
          metric="members"
          labels={labels}
        />
        <CompositionPieCard
          title={labels.leadershipTitle}
          description={labels.leadershipDescription}
          emptyLabel={labels.leadershipEmpty}
          rows={leadershipRows}
          displayMode={displayMode}
          isLoading={isLoading}
          metric="leadership"
          labels={labels}
        />
      </div>
    </div>
  );
}

function CompositionPieCard({
  title,
  description,
  emptyLabel,
  rows,
  displayMode,
  isLoading,
  metric,
  labels,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  rows: (MembershipCompositionBucket & { value: number; percentage: number; fill: string })[];
  displayMode: CompositionDisplayMode;
  isLoading: boolean;
  metric: CompositionMetric;
  labels: Pick<
    MembershipCompositionPanelViewProps['labels'],
    'loading' | 'total' | 'leadershipFootnote'
  >;
}) {
  const total = rows.reduce((sum: any, row: any) => sum + row.value, 0);
  const formatRowValue = (row: { value: number; percentage: number }) => {
    const absolute = row.value.toLocaleString();
    const percentage = `${row.percentage.toFixed(1)}%`;
    return displayMode === 'absolute'
      ? `${absolute} (${percentage})`
      : `${percentage} (${absolute})`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <CompositionPieSkeleton label={labels.loading} />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">{emptyLabel}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
            <ChartRenderer
              chartType="pie"
              points={rows.map((row: any) => ({ x: row.label, value: row.value }))}
              presentation={{ donut: true, showLegend: false }}
              heightClassName="h-72"
              valueFormatter={(value, point) => {
                const row = rows.find((item: any) => item.label === point.x);
                return displayMode === 'absolute'
                  ? value.toLocaleString()
                  : `${(row?.percentage ?? 0).toFixed(1)}%`;
              }}
            />

            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">{labels.total(total)}</p>
              <ul className="space-y-2">
                {rows.map((row: any) => (
                  <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.fill }}
                      />
                      <span className="truncate">{row.label}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {formatRowValue(row)}
                    </span>
                  </li>
                ))}
              </ul>
              {metric === 'leadership' ? (
                <p className="text-muted-foreground text-xs">{labels.leadershipFootnote}</p>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompositionPieSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="grid gap-6 py-2 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center"
      data-slot="composition-pie-skeleton"
    >
      <span className="sr-only">{label}</span>
      <div className="flex justify-center">
        <Skeleton className="size-56 rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
