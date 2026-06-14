import { ChartRenderer } from '@/features/charts/ui/ChartRenderer';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
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
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card surface="subtleGradient">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground py-12 text-center text-sm">{labels.loading}</p>
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
              <p className="text-muted-foreground text-sm">{labels.total(total)}</p>
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
                <p className="text-muted-foreground text-xs">{labels.leadershipFootnote}</p>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
