import { featureThemeValue } from '@/features/shared/theme';
import * as React from 'react';
import { type HoverTooltipState } from '../hooks/useChartRendererController';
import type { ChartPresentation, ChartType } from '../types';
import { ChartContainer } from '@/features/shared/ui/ui/chart';
import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export const CHART_PALETTE = [
  featureThemeValue('chartChartRendererInfoColor'),
  featureThemeValue('chartChartRendererInfoColorAlpha'),
  featureThemeValue('chartChartRendererAccentColor'),
  featureThemeValue('chartChartRendererThemeValue'),
  featureThemeValue('chartChartRendererAccentColorAlpha'),
  featureThemeValue('chartChartRendererThemeValueAlpha'),
  featureThemeValue('chartChartRendererInfoColorBeta'),
  featureThemeValue('chartChartRendererDangerColor'),
] as const;
function HoverValueTooltip({ state }: { state: HoverTooltipState | null }) {
  if (!state) return null;

  return (
    <div
      className="border-border/50 bg-background pointer-events-none absolute z-50 grid min-w-36 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
      style={{
        left: state.x,
        top: state.y,
        transform: 'translate(-50%, calc(-100% - 12px))',
      }}
    >
      {state.label ? <div className="font-medium">{state.label}</div> : null}
      <div className="grid gap-1.5">
        {state.items.map((item: any) => (
          <div key={`${item.name}-${item.value}`} className="flex items-center gap-2">
            {item.color ? (
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
            ) : null}
            <span className="text-muted-foreground min-w-0 flex-1 truncate">{item.name}</span>
            <span className="font-mono font-medium tabular-nums">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function AxisLabelFrame({
  chartType,
  presentation,
  children,
}: {
  chartType: ChartType;
  presentation: ChartPresentation;
  children: React.ReactNode;
}) {
  const xAxisLabel = presentation.xAxisLabel?.trim();
  const yAxisLabel = presentation.yAxisLabel?.trim();

  if (chartType === 'pie' || (!xAxisLabel && !yAxisLabel)) {
    return <>{children}</>;
  }

  return (
    <div className={cn('grid gap-y-1', yAxisLabel ? 'grid-cols-[auto_minmax(0,1fr)]' : '')}>
      {yAxisLabel ? (
        <div
          className="text-muted-foreground flex items-center justify-center pr-2 text-xs"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {yAxisLabel}
        </div>
      ) : null}
      <div className="min-w-0">{children}</div>
      {xAxisLabel ? (
        <div
          className={cn(
            'text-muted-foreground min-h-4 text-center text-xs',
            yAxisLabel ? 'col-start-2' : ''
          )}
        >
          {xAxisLabel}
        </div>
      ) : null}
    </div>
  );
}
export interface ChartRendererViewProps {
  chartType: any;
  points: any;
  presentation: any;
  className: any;
  heightClassName: any;
  staticMode: any;
  valueFormatter: any;
  series: any;
  rows: any;
  config: any;
  hoverTooltip: any;
  onHoverChange: any;
  chart: any;
}

export function ChartRendererView({
  chartType,
  points,
  presentation,
  className,
  heightClassName,
  staticMode,
  config,
  hoverTooltip,
  chart,
}: ChartRendererViewProps) {
  if (points.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex min-h-64 items-center justify-center border border-dashed text-sm',
          className
        )}
      >
        {translateText('generated.inline.0296_no_chart_data_b168984f')}
      </div>
    );
  }

  return (
    <figure className={cn('m-0 w-full', className)}>
      {presentation.title ? (
        <figcaption className="mb-3">
          <div className="text-sm font-semibold">{presentation.title}</div>
          {presentation.description ? (
            <div className="text-muted-foreground mt-1 text-xs">{presentation.description}</div>
          ) : null}
        </figcaption>
      ) : null}
      <AxisLabelFrame chartType={chartType} presentation={presentation}>
        {staticMode ? (
          <div className="w-full overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full">{chart}</div>
        ) : (
          <div className="relative">
            <ChartContainer config={config} className={cn('aspect-auto w-full', heightClassName)}>
              {chart}
            </ChartContainer>
            {presentation.showTooltip !== false ? <HoverValueTooltip state={hoverTooltip} /> : null}
          </div>
        )}
      </AxisLabelFrame>
    </figure>
  );
}
