import { featureThemeValue } from '@/features/shared/theme';
import * as React from 'react';
import {
  useChartRendererController,
  type HoverTooltipState,
} from '../hooks/useChartRendererController';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RechartsTooltip,
  XAxis,
  YAxis,
} from '@/features/shared/ui/charting';
import type { ChartPoint, ChartPresentation, ChartType } from '../types';
import {
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/features/shared/ui/ui/chart';
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

interface ChartRendererProps {
  chartType: ChartType;
  points: readonly ChartPoint[];
  presentation?: ChartPresentation;
  className?: string;
  heightClassName?: string;
  staticMode?: boolean;
  valueFormatter?: (value: number, point: ChartPoint) => string;
}

interface CartesianRow {
  x: string;
  [series: string]: string | number | null;
}

type HoverTooltipSetter = (state: HoverTooltipState | null) => void;

const STATIC_CHART_WIDTH = 700;
const STATIC_CHART_HEIGHT = 380;
const STATIC_CHART_MARGIN = { top: 24, right: 24, bottom: 44, left: 56 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getSeries(points: readonly ChartPoint[]) {
  const values = [...new Set(points.map(point => point.series || 'value'))];
  return values.length > 0 ? values : ['value'];
}

function toCartesianRows(points: readonly ChartPoint[]) {
  const rows = new Map<string, CartesianRow>();
  for (const point of points) {
    const row = rows.get(point.x) ?? { x: point.x };
    row[point.series || 'value'] = point.value;
    rows.set(point.x, row);
  }
  return [...rows.values()];
}

function getChartConfig(series: readonly string[]): ChartConfig {
  return Object.fromEntries(
    series.map((name, index) => [
      name,
      {
        label: name === 'value' ? 'Value' : name,
        color: CHART_PALETTE[index % CHART_PALETTE.length],
      },
    ])
  );
}

function getPointValue(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatTooltipValue(
  value: unknown,
  point: ChartPoint,
  valueFormatter?: ChartRendererProps['valueFormatter']
) {
  const numberValue = getPointValue(value);
  if (numberValue === null) return String(value ?? '');
  return valueFormatter ? valueFormatter(numberValue, point) : numberValue.toLocaleString();
}

function getPayloadColor(item: Record<string, unknown>) {
  return String(item.color || item.fill || item.stroke || '');
}

function createCartesianHoverTooltipState(
  event: unknown,
  valueFormatter?: ChartRendererProps['valueFormatter']
): HoverTooltipState | null {
  if (!isRecord(event)) return null;
  const payload = Array.isArray(event.activePayload) ? event.activePayload : [];
  if (payload.length === 0) return null;

  const label = String(event.activeLabel ?? '');
  const coordinate = isRecord(event.activeCoordinate) ? event.activeCoordinate : {};
  const x = Number(coordinate.x ?? event.chartX ?? 0);
  const y = Number(coordinate.y ?? event.chartY ?? 0);
  const items = payload
    .filter(isRecord)
    .filter(item => item.value !== null && item.value !== undefined)
    .map(item => {
      const name = String(item.name ?? item.dataKey ?? 'value');
      const point: ChartPoint = {
        x: label,
        series: name === 'value' ? null : name,
        value: getPointValue(item.value) ?? 0,
      };
      return {
        color: getPayloadColor(item),
        name,
        value: formatTooltipValue(item.value, point, valueFormatter),
      };
    });

  return items.length > 0 ? { items, label, x, y } : null;
}

function getRelativePointerPosition(event: unknown) {
  if (!isRecord(event)) return null;
  const clientX = Number(event.clientX);
  const clientY = Number(event.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  if (typeof Element === 'undefined' || typeof HTMLElement === 'undefined') return null;

  const target = event.currentTarget || event.target;
  if (!(target instanceof Element)) return null;
  const container = target.closest('[data-chart]');
  if (!(container instanceof HTMLElement)) return null;
  const rect = container.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function createPieHoverTooltipState(
  entry: unknown,
  event: unknown,
  valueFormatter?: ChartRendererProps['valueFormatter']
): HoverTooltipState | null {
  if (!isRecord(entry)) return null;
  const position = getRelativePointerPosition(event) ?? { x: 0, y: 0 };
  const name = String(entry.name ?? entry.x ?? 'value');
  const point: ChartPoint = {
    x: String(entry.x ?? name),
    series: entry.series ? String(entry.series) : null,
    value: getPointValue(entry.value) ?? 0,
  };

  return {
    ...position,
    label: name,
    items: [
      {
        color: String(entry.fill || ''),
        name,
        value: formatTooltipValue(entry.value, point, valueFormatter),
      },
    ],
  };
}

function getStaticYDomain(rows: readonly CartesianRow[], series: readonly string[]) {
  const values = rows.flatMap(row =>
    series.map(name => getPointValue(row[name])).filter((value): value is number => value !== null)
  );

  if (values.length === 0) return { min: 0, max: 1 };

  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  if (min === max) return { min: min - 1, max: max + 1 };
  return { min, max };
}

function getStaticPlotFrame() {
  const left = STATIC_CHART_MARGIN.left;
  const top = STATIC_CHART_MARGIN.top;
  const right = STATIC_CHART_WIDTH - STATIC_CHART_MARGIN.right;
  const bottom = STATIC_CHART_HEIGHT - STATIC_CHART_MARGIN.bottom;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function StaticCartesianChartSvg({
  chartType,
  rows,
  series,
  presentation,
}: {
  chartType: Exclude<ChartType, 'pie'>;
  rows: readonly CartesianRow[];
  series: readonly string[];
  presentation: ChartPresentation;
}) {
  const frame = getStaticPlotFrame();
  const domain = getStaticYDomain(rows, series);
  const scaleY = (value: number) =>
    frame.bottom - ((value - domain.min) / (domain.max - domain.min)) * frame.height;
  const scaleX = (index: number) =>
    rows.length <= 1
      ? frame.left + frame.width / 2
      : frame.left + (index / (rows.length - 1)) * frame.width;
  const zeroY = scaleY(0);
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const value = domain.min + ((domain.max - domain.min) / 4) * index;
    return { value, y: scaleY(value) };
  });

  return (
    <svg
      viewBox={`0 0 ${STATIC_CHART_WIDTH} ${STATIC_CHART_HEIGHT}`}
      width={STATIC_CHART_WIDTH}
      height={STATIC_CHART_HEIGHT}
      role="img"
    >
      <line x1={frame.left} x2={frame.left} y1={frame.top} y2={frame.bottom} stroke="#d4d4d8" />
      <line x1={frame.left} x2={frame.right} y1={frame.bottom} y2={frame.bottom} stroke="#d4d4d8" />
      {presentation.showGrid !== false
        ? ticks.map(tick => (
            <line
              key={tick.value}
              x1={frame.left}
              x2={frame.right}
              y1={tick.y}
              y2={tick.y}
              stroke="#e4e4e7"
              strokeDasharray="4 4"
            />
          ))
        : null}
      {ticks.map(tick => (
        <text
          key={`label-${tick.value}`}
          x={frame.left - 10}
          y={tick.y + 4}
          textAnchor="end"
          fontSize="11"
          fill="#71717a"
        >
          {Number.isInteger(tick.value) ? tick.value : tick.value.toFixed(1)}
        </text>
      ))}
      {rows.map((row, index) => (
        <text
          key={row.x}
          x={scaleX(index)}
          y={frame.bottom + 22}
          textAnchor="middle"
          fontSize="11"
          fill="#71717a"
        >
          {row.x}
        </text>
      ))}
      {chartType === 'bar'
        ? rows.flatMap((row, rowIndex) => {
            const groupWidth = frame.width / Math.max(rows.length, 1);
            const barWidth = groupWidth / (series.length + 0.6);
            return series.map((name, seriesIndex) => {
              const value = getPointValue(row[name]);
              if (value === null) return null;
              const y = scaleY(value);
              return (
                <rect
                  key={`${row.x}-${name}`}
                  x={frame.left + rowIndex * groupWidth + (seriesIndex + 0.3) * barWidth}
                  y={Math.min(y, zeroY)}
                  width={Math.max(2, barWidth * 0.72)}
                  height={Math.max(1, Math.abs(zeroY - y))}
                  rx="3"
                  fill={CHART_PALETTE[seriesIndex % CHART_PALETTE.length]}
                />
              );
            });
          })
        : series.map((name, seriesIndex) => {
            const points = rows
              .map((row, rowIndex) => {
                const value = getPointValue(row[name]);
                return value === null ? null : { x: scaleX(rowIndex), y: scaleY(value) };
              })
              .filter((point): point is { x: number; y: number } => point !== null);
            const linePoints = points.map(point => `${point.x},${point.y}`).join(' ');
            const color = CHART_PALETTE[seriesIndex % CHART_PALETTE.length];

            if (chartType === 'area' && points.length > 0) {
              const areaPoints = [
                `${points[0].x},${zeroY}`,
                linePoints,
                `${points[points.length - 1].x},${zeroY}`,
              ].join(' ');
              return (
                <g key={name}>
                  <polygon points={areaPoints} fill={color} opacity="0.18" />
                  <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" />
                </g>
              );
            }

            return (
              <polyline key={name} points={linePoints} fill="none" stroke={color} strokeWidth="2" />
            );
          })}
    </svg>
  );
}

function getArcPoint(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function getPieSlicePath(
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = getArcPoint(cx, cy, radius, startAngle);
  const outerEnd = getArcPoint(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  if (innerRadius <= 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${outerStart.x} ${outerStart.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      'Z',
    ].join(' ');
  }

  const innerStart = getArcPoint(cx, cy, innerRadius, startAngle);
  const innerEnd = getArcPoint(cx, cy, innerRadius, endAngle);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function StaticPieChartSvg({
  points,
  presentation,
}: {
  points: readonly ChartPoint[];
  presentation: ChartPresentation;
}) {
  const data = points
    .map((point, index) => ({ point, index, value: Math.max(0, point.value) }))
    .filter(item => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const cx = STATIC_CHART_WIDTH / 2;
  const cy = STATIC_CHART_HEIGHT / 2;
  const radius = Math.min(STATIC_CHART_WIDTH, STATIC_CHART_HEIGHT) * 0.36;
  const innerRadius = presentation.donut === false ? 0 : radius * 0.52;
  let cursor = -Math.PI / 2;

  return (
    <svg
      viewBox={`0 0 ${STATIC_CHART_WIDTH} ${STATIC_CHART_HEIGHT}`}
      width={STATIC_CHART_WIDTH}
      height={STATIC_CHART_HEIGHT}
      role="img"
    >
      {total > 0 ? (
        data.map(item => {
          const angle = (item.value / total) * Math.PI * 2;
          const path = getPieSlicePath(cx, cy, radius, innerRadius, cursor, cursor + angle);
          cursor += angle;
          return (
            <path
              key={`${item.point.x}-${item.point.series ?? ''}-${item.index}`}
              d={path}
              fill={CHART_PALETTE[item.index % CHART_PALETTE.length]}
              stroke="#ffffff"
              strokeWidth="2"
            />
          );
        })
      ) : (
        <circle cx={cx} cy={cy} r={radius} fill="#e4e4e7" />
      )}
    </svg>
  );
}

function StaticChartSvg({
  chartType,
  points,
  rows,
  series,
  presentation,
}: {
  chartType: ChartType;
  points: readonly ChartPoint[];
  rows: readonly CartesianRow[];
  series: readonly string[];
  presentation: ChartPresentation;
}) {
  return chartType === 'pie' ? (
    <StaticPieChartSvg points={points} presentation={presentation} />
  ) : (
    <StaticCartesianChartSvg
      chartType={chartType}
      rows={rows}
      series={series}
      presentation={presentation}
    />
  );
}

function CartesianChartContent({
  chartType,
  rows,
  series,
  presentation,
  staticMode,
  onHoverChange,
  valueFormatter,
  width,
  height,
}: {
  chartType: Exclude<ChartType, 'pie'>;
  rows: CartesianRow[];
  series: string[];
  presentation: ChartPresentation;
  staticMode: boolean;
  onHoverChange?: HoverTooltipSetter;
  valueFormatter?: ChartRendererProps['valueFormatter'];
  width?: number;
  height?: number;
}) {
  const dimensions = width && height ? { width, height } : {};
  const showTooltip = presentation.showTooltip !== false;
  const hoverProps =
    showTooltip && !staticMode && onHoverChange
      ? {
          onMouseLeave: () => onHoverChange(null),
          onMouseMove: (event: unknown) =>
            onHoverChange(createCartesianHoverTooltipState(event, valueFormatter)),
        }
      : {};
  const common = (
    <>
      {presentation.showGrid !== false ? <CartesianGrid vertical={false} /> : null}
      <XAxis dataKey="x" tickLine={false} axisLine={false} minTickGap={20} />
      <YAxis tickLine={false} axisLine={false} width={48} />
      {showTooltip ? (
        staticMode ? (
          <RechartsTooltip
            isAnimationActive={false}
            wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
          />
        ) : (
          <ChartTooltip
            cursor
            isAnimationActive={false}
            wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
            content={<ChartTooltipContent indicator="line" />}
          />
        )
      ) : null}
      {presentation.showLegend !== false && series.length > 1 ? (
        staticMode ? (
          <Legend />
        ) : (
          <ChartLegend content={<ChartLegendContent />} />
        )
      ) : null}
    </>
  );

  if (chartType === 'bar') {
    return (
      <BarChart
        {...dimensions}
        {...hoverProps}
        data={rows}
        margin={{ left: 4, right: 16, top: 12, bottom: 4 }}
      >
        {common}
        {series.map((name, index) => (
          <Bar
            key={name}
            dataKey={name}
            fill={CHART_PALETTE[index % CHART_PALETTE.length]}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    );
  }

  if (chartType === 'area') {
    return (
      <AreaChart
        {...dimensions}
        {...hoverProps}
        data={rows}
        margin={{ left: 4, right: 16, top: 12, bottom: 4 }}
      >
        {common}
        {series.map((name, index) => (
          <Area
            key={name}
            type="monotone"
            dataKey={name}
            stroke={CHART_PALETTE[index % CHART_PALETTE.length]}
            fill={CHART_PALETTE[index % CHART_PALETTE.length]}
            fillOpacity={0.18}
            connectNulls={false}
          />
        ))}
      </AreaChart>
    );
  }

  return (
    <LineChart
      {...dimensions}
      {...hoverProps}
      data={rows}
      margin={{ left: 4, right: 16, top: 12, bottom: 4 }}
    >
      {common}
      {series.map((name, index) => (
        <Line
          key={name}
          type="monotone"
          dataKey={name}
          stroke={CHART_PALETTE[index % CHART_PALETTE.length]}
          strokeWidth={2}
          dot={{ r: 2 }}
          connectNulls={false}
        />
      ))}
    </LineChart>
  );
}

function PieChartContent({
  points,
  presentation,
  staticMode,
  onHoverChange,
  valueFormatter,
  width,
  height,
}: {
  points: readonly ChartPoint[];
  presentation: ChartPresentation;
  staticMode: boolean;
  onHoverChange?: HoverTooltipSetter;
  valueFormatter?: ChartRendererProps['valueFormatter'];
  width?: number;
  height?: number;
}) {
  const data = points.map((point, index) => ({
    ...point,
    name: point.series ? `${point.x} · ${point.series}` : point.x,
    fill: CHART_PALETTE[index % CHART_PALETTE.length],
  }));
  const showTooltip = presentation.showTooltip !== false;
  const hoverProps =
    showTooltip && !staticMode && onHoverChange
      ? {
          onMouseEnter: (entry: unknown, _index: number, event: unknown) =>
            onHoverChange(createPieHoverTooltipState(entry, event, valueFormatter)),
          onMouseLeave: () => onHoverChange(null),
          onMouseMove: (entry: unknown, _index: number, event: unknown) =>
            onHoverChange(createPieHoverTooltipState(entry, event, valueFormatter)),
        }
      : {};

  return (
    <PieChart {...(width && height ? { width, height } : {})}>
      <Pie
        {...hoverProps}
        data={data}
        dataKey="value"
        nameKey="name"
        innerRadius={presentation.donut === false ? 0 : '48%'}
        outerRadius="78%"
        paddingAngle={data.length > 1 ? 2 : 0}
      >
        {data.map((point, index) => (
          <Cell key={`${point.x}-${point.series ?? ''}-${index}`} fill={point.fill} />
        ))}
      </Pie>
      {showTooltip ? (
        staticMode ? (
          <RechartsTooltip
            isAnimationActive={false}
            formatter={(value, _name, item) => {
              const point = item.payload as ChartPoint;
              const numberValue = Number(value);
              return [
                valueFormatter ? valueFormatter(numberValue, point) : numberValue.toLocaleString(),
                item.payload.name,
              ];
            }}
            wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
          />
        ) : (
          <ChartTooltip
            cursor={false}
            isAnimationActive={false}
            wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
            content={
              <ChartTooltipContent
                nameKey="name"
                formatter={(value, name, item) => {
                  const point = item.payload as ChartPoint;
                  const numberValue = Number(value);
                  return (
                    <div className="flex min-w-36 items-center justify-between gap-4">
                      <span className="text-muted-foreground">{String(name)}</span>
                      <span className="font-mono font-medium tabular-nums">
                        {valueFormatter
                          ? valueFormatter(numberValue, point)
                          : numberValue.toLocaleString()}
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
        )
      ) : null}
    </PieChart>
  );
}
import { ChartRendererView } from './ChartRendererView';
export function ChartRenderer({
  chartType,
  points,
  presentation = {},
  className,
  heightClassName = 'h-[360px]',
  staticMode = false,
  valueFormatter,
}: ChartRendererProps) {
  const series = React.useMemo(() => getSeries(points), [points]);
  const rows = React.useMemo(() => toCartesianRows(points), [points]);
  const config = React.useMemo(() => getChartConfig(series), [series]);
  const { hoverTooltip, onHoverChange } = useChartRendererController(staticMode);
  const chart = staticMode ? (
    <StaticChartSvg
      chartType={chartType}
      points={points}
      rows={rows}
      series={series}
      presentation={presentation}
    />
  ) : chartType === 'pie' ? (
    <PieChartContent
      points={points}
      presentation={presentation}
      staticMode={staticMode}
      onHoverChange={onHoverChange}
      valueFormatter={valueFormatter}
    />
  ) : (
    <CartesianChartContent
      chartType={chartType}
      rows={rows}
      series={series}
      presentation={presentation}
      staticMode={staticMode}
      onHoverChange={onHoverChange}
      valueFormatter={valueFormatter}
    />
  );
  return (
    <ChartRendererView
      chartType={chartType}
      points={points}
      presentation={presentation}
      className={className}
      heightClassName={heightClassName}
      staticMode={staticMode}
      valueFormatter={valueFormatter}
      series={series}
      rows={rows}
      config={config}
      hoverTooltip={hoverTooltip}
      onHoverChange={onHoverChange}
      chart={chart}
    />
  );
}
