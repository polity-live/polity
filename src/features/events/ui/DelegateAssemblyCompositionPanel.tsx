import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ChartRenderer, CHART_PALETTE } from '@/features/charts/ui/ChartRenderer';
import { getDelegateMembersPerSeatInfo } from '@/features/delegates/logic/delegateRatio';
import {
  buildDelegateAssemblyCompositionSections,
  type DelegateAssemblyCompositionSection,
  type DelegateAssemblyCompositionSectionRow,
} from '@/features/events/logic/delegateAssemblyComposition';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';
import { useDelegateAssemblyCompositionData } from '@/zero/events';

interface DelegateAssemblyCompositionPanelProps {
  eventId: string;
}

export function DelegateAssemblyCompositionPanel({
  eventId,
}: DelegateAssemblyCompositionPanelProps) {
  const { t } = useTranslation();
  const { event, allocations, delegates, scheduledElections, isLoading } =
    useDelegateAssemblyCompositionData(eventId);
  const delegateRatioInfo = useMemo(() => getDelegateMembersPerSeatInfo(event), [event]);
  const sections = useMemo(
    () =>
      buildDelegateAssemblyCompositionSections({
        targetEventId: eventId,
        allocations,
        delegates,
        scheduledElections,
      }),
    [allocations, delegates, eventId, scheduledElections]
  );
  const hasRows = sections.some(section => section.rows.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          {t('features.events.participants.composition.title')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('features.events.participants.composition.description')}
        </p>
        {delegateRatioInfo ? (
          <p className="text-foreground mt-1 text-sm font-medium">
            {t(delegateRatioInfo.translationKey, { count: delegateRatioInfo.count })}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <Card>
          <CardContent>
            <SectionSkeleton
              rows={3}
              label={t('features.events.participants.composition.loading')}
              className="py-4"
            />
          </CardContent>
        </Card>
      ) : !hasRows ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground py-12 text-center text-sm">
              {t('features.events.participants.composition.empty')}
            </p>
          </CardContent>
        </Card>
      ) : (
        sections.map(section => <CompositionSectionCard key={section.id} section={section} />)
      )}
    </div>
  );
}

function CompositionSectionCard({ section }: { section: DelegateAssemblyCompositionSection }) {
  const { t } = useTranslation();
  const chartRows = section.rows.filter(row => row.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t(`features.events.participants.composition.sectionTitles.${section.id}`)}
        </CardTitle>
        <CardDescription>
          {t(`features.events.participants.composition.sectionDescriptions.${section.id}`)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartRows.length === 0 ? (
          <CompositionRowsTable rows={section.rows} total={section.total} />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] xl:items-center">
            <ChartRenderer
              chartType="pie"
              points={chartRows.map(row => ({
                x: getCompositionRowLabel(row, t),
                value: row.value,
              }))}
              presentation={{ donut: true, showLegend: false }}
              heightClassName="h-72"
              valueFormatter={(value, point) => {
                const row = chartRows.find(item => getCompositionRowLabel(item, t) === point.x);
                const share = row?.share ?? 0;
                return `${value.toLocaleString()} (${share.toFixed(1)}%)`;
              }}
            />

            <CompositionRowsTable rows={section.rows} total={section.total} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompositionRowsTable({
  rows,
  total,
}: {
  rows: DelegateAssemblyCompositionSectionRow[];
  total: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {t('features.events.participants.composition.total', { count: total })}
      </p>
      <div className="overflow-x-auto rounded-md border">
        <div className="bg-muted/50 grid min-w-[420px] grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(82px,0.65fr))] gap-3 px-3 py-2 text-xs font-medium">
          <span>{t('features.events.participants.composition.columns.category')}</span>
          <span className="text-right">
            {t('features.events.participants.composition.columns.absolute')}
          </span>
          <span className="text-right">
            {t('features.events.participants.composition.columns.share')}
          </span>
        </div>
        <ul className="min-w-[420px] divide-y">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="grid grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(82px,0.65fr))] gap-3 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      row.kind === 'remainder'
                        ? 'hsl(var(--muted-foreground))'
                        : CHART_PALETTE[index % CHART_PALETTE.length],
                  }}
                />
                <CompositionRowLabel row={row} />
              </span>
              <span className="text-right font-medium tabular-nums">
                {row.value.toLocaleString()}
              </span>
              <span className="text-muted-foreground text-right tabular-nums">
                {row.value > 0 ? `${row.share.toFixed(1)}%` : '0%'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CompositionRowLabel({ row }: { row: DelegateAssemblyCompositionSectionRow }) {
  const { t } = useTranslation();
  const label = getCompositionRowLabel(row, t);

  if (row.kind !== 'group' || !row.groupId) {
    return <span className="text-muted-foreground min-w-0 truncate">{label}</span>;
  }

  return (
    <TooltipHint content={label}>
      <Link
        to="/group/$id"
        params={{ id: row.groupId }}
        className="text-primary focus-visible:ring-ring min-w-0 truncate underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {label}
      </Link>
    </TooltipHint>
  );
}

function getCompositionRowLabel(
  row: DelegateAssemblyCompositionSectionRow,
  t: (key: string) => string
) {
  if (row.kind === 'remainder') {
    return row.key === 'unscheduled'
      ? t('features.events.participants.composition.remainder.unscheduled')
      : t('features.events.participants.composition.remainder.notYetElected');
  }

  return row.label;
}
