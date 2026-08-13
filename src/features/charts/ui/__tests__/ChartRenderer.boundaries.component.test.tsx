/* @vitest-environment jsdom */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChartPoint } from '../../types';
import {
  CartesianChartContent,
  CHART_PALETTE,
  PieChartContent,
  StaticCartesianChartSvg,
  StaticChartSvg,
  StaticPieChartSvg,
  ChartRenderer,
  createCartesianHoverTooltipState,
  createPieHoverTooltipState,
  formatTooltipValue,
  getArcPoint,
  getChartConfig,
  getPayloadColor,
  getPieSlicePath,
  getPointValue,
  getRelativePointerPosition,
  getSeries,
  getStaticPlotFrame,
  getStaticYDomain,
  isRecord,
  toCartesianRows,
} from '../ChartRenderer';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('ChartRenderer data boundaries', () => {
  it('normalizes records, series, rows, configuration, and numeric values', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord('value')).toBe(false);
    expect(isRecord([])).toBe(true);
    expect(isRecord({})).toBe(true);

    expect(getSeries([])).toEqual(['value']);
    expect(getSeries([{ x: 'A', value: 1 }])).toEqual(['value']);
    expect(
      getSeries([
        { x: 'A', value: 1, series: 'North' },
        { x: 'B', value: 2, series: 'North' },
        { x: 'B', value: 3, series: 'South' },
      ])
    ).toEqual(['North', 'South']);

    expect(
      toCartesianRows([
        { x: 'A', value: 1 },
        { x: 'A', value: 2, series: 'North' },
        { x: 'B', value: 3, series: 'North' },
      ])
    ).toEqual([
      { x: 'A', value: 1, North: 2 },
      { x: 'B', North: 3 },
    ]);

    const config = getChartConfig([
      'value',
      'North',
      ...Array.from({ length: 8 }, (_, i) => `S${i}`),
    ]);
    expect(config.value.label).toBeTruthy();
    expect(config.North.label).toBe('North');
    expect(config.S7.color).toBe(CHART_PALETTE[1]);

    expect(getPointValue(12)).toBe(12);
    expect(getPointValue('12.5')).toBe(12.5);
    expect(getPointValue('not-a-number')).toBeNull();
    expect(formatTooltipValue(undefined, { x: 'A', value: 0 })).toBe('');
    expect(formatTooltipValue('bad', { x: 'A', value: 0 })).toBe('bad');
    expect(formatTooltipValue(12, { x: 'A', value: 12 })).toBe((12).toLocaleString());
    expect(
      formatTooltipValue(12, { x: 'A', value: 12 }, (value, point) => `${point.x}:${value}`)
    ).toBe('A:12');

    expect(getPayloadColor({ color: 'red', fill: 'blue' })).toBe('red');
    expect(getPayloadColor({ fill: 'blue', stroke: 'green' })).toBe('blue');
    expect(getPayloadColor({ stroke: 'green' })).toBe('green');
    expect(getPayloadColor({})).toBe('');
  });

  it('creates and rejects cartesian hover payloads at every fallback', () => {
    expect(createCartesianHoverTooltipState(null)).toBeNull();
    expect(createCartesianHoverTooltipState({ activePayload: 'invalid' })).toBeNull();
    expect(createCartesianHoverTooltipState({ activePayload: [] })).toBeNull();
    expect(
      createCartesianHoverTooltipState({
        activePayload: [null, 'bad', { value: null }, { value: undefined }],
      })
    ).toBeNull();

    const formatted = createCartesianHoverTooltipState(
      {
        activeLabel: '2026',
        activeCoordinate: { x: 10, y: 20 },
        activePayload: [
          { name: 'North', value: 3, color: 'red' },
          { dataKey: 'South', value: 'bad', fill: 'blue' },
          { value: 0, stroke: 'green' },
        ],
      },
      (value, point) => `${point.series ?? 'value'}:${value}`
    );
    expect(formatted).toEqual({
      label: '2026',
      x: 10,
      y: 20,
      items: [
        { color: 'red', name: 'North', value: 'North:3' },
        { color: 'blue', name: 'South', value: 'bad' },
        { color: 'green', name: 'value', value: 'value:0' },
      ],
    });

    expect(
      createCartesianHoverTooltipState({
        activeLabel: null,
        activeCoordinate: null,
        chartX: 4,
        chartY: 5,
        activePayload: [{ value: 1 }],
      })
    ).toMatchObject({ label: '', x: 4, y: 5 });
    expect(createCartesianHoverTooltipState({ activePayload: [{ value: 1 }] })).toMatchObject({
      x: 0,
      y: 0,
    });
  });

  it('resolves pointer positions and pie tooltip fallbacks', () => {
    expect(getRelativePointerPosition(null)).toBeNull();
    expect(getRelativePointerPosition({ clientX: 'bad', clientY: 1 })).toBeNull();
    expect(getRelativePointerPosition({ clientX: 1, clientY: Number.NaN })).toBeNull();

    vi.stubGlobal('Element', undefined);
    expect(getRelativePointerPosition({ clientX: 1, clientY: 2 })).toBeNull();
    vi.unstubAllGlobals();
    vi.stubGlobal('HTMLElement', undefined);
    expect(getRelativePointerPosition({ clientX: 1, clientY: 2 })).toBeNull();
    vi.unstubAllGlobals();

    expect(getRelativePointerPosition({ clientX: 1, clientY: 2, currentTarget: {} })).toBeNull();
    const detached = document.createElement('span');
    expect(getRelativePointerPosition({ clientX: 1, clientY: 2, target: detached })).toBeNull();

    const container = document.createElement('div');
    container.dataset.chart = 'chart';
    const target = document.createElement('span');
    container.append(target);
    document.body.append(container);
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 5,
      top: 7,
      right: 105,
      bottom: 107,
      width: 100,
      height: 100,
      x: 5,
      y: 7,
      toJSON: () => ({}),
    });
    expect(getRelativePointerPosition({ clientX: 15, clientY: 27, currentTarget: target })).toEqual(
      {
        x: 10,
        y: 20,
      }
    );

    expect(createPieHoverTooltipState(null, null)).toBeNull();
    expect(
      createPieHoverTooltipState(
        { name: 'Slice', x: 'X', series: 'North', value: 4, fill: 'purple' },
        { clientX: 15, clientY: 27, currentTarget: target },
        value => `v=${value}`
      )
    ).toEqual({
      x: 10,
      y: 20,
      label: 'Slice',
      items: [{ color: 'purple', name: 'Slice', value: 'v=4' }],
    });
    expect(createPieHoverTooltipState({ x: 'Fallback', value: 'bad' }, null)).toMatchObject({
      x: 0,
      y: 0,
      label: 'Fallback',
      items: [{ color: '', name: 'Fallback', value: 'bad' }],
    });
    expect(createPieHoverTooltipState({ value: 2 }, null)).toMatchObject({
      label: 'value',
      items: [{ name: 'value' }],
    });
  });

  it('derives static domains, frames, arc points, and pie paths', () => {
    expect(getStaticYDomain([], ['value'])).toEqual({ min: 0, max: 1 });
    expect(getStaticYDomain([{ x: 'A', value: undefined } as any], ['value'])).toEqual({
      min: 0,
      max: 1,
    });
    expect(getStaticYDomain([{ x: 'A', value: null }], ['value'])).toEqual({ min: -1, max: 1 });
    expect(getStaticYDomain([{ x: 'A', value: 5 }], ['value'])).toEqual({ min: 0, max: 5 });
    expect(getStaticYDomain([{ x: 'A', value: -5 }], ['value'])).toEqual({ min: -5, max: 0 });
    expect(getStaticYDomain([{ x: 'A', value: 0 }], ['value'])).toEqual({ min: -1, max: 1 });
    expect(getStaticPlotFrame()).toEqual({
      left: 56,
      top: 24,
      right: 676,
      bottom: 336,
      width: 620,
      height: 312,
    });
    expect(getArcPoint(0, 0, 2, 0)).toEqual({ x: 2, y: 0 });
    expect(getPieSlicePath(10, 10, 5, 0, 0, Math.PI)).toContain('M 10 10');
    expect(getPieSlicePath(10, 10, 5, 2, 0, Math.PI * 1.5)).toContain('A 2 2 0 1 0');
  });
});

const presentation = {
  title: 'Chart',
  showLegend: true,
  showGrid: true,
  showTooltip: true,
};

describe('ChartRenderer SVG and interactive surfaces', () => {
  it('renders cartesian SVG boundaries for grid, axes, bars, lines, and areas', () => {
    const rows = [
      { x: 'A', North: 2, South: 'bad' as any },
      { x: 'B', North: -1, South: 1.5 },
    ];
    const bar = renderToStaticMarkup(
      <StaticCartesianChartSvg
        chartType="bar"
        rows={rows}
        series={['North', 'South']}
        presentation={presentation}
      />
    );
    expect(bar).toContain('<rect');
    expect(bar).not.toContain('NaN');

    const singleLine = renderToStaticMarkup(
      <StaticCartesianChartSvg
        chartType="line"
        rows={[{ x: 'Only', North: null }]}
        series={['North']}
        presentation={{ ...presentation, showGrid: false }}
      />
    );
    expect(singleLine).toContain('<polyline');
    expect(singleLine).not.toContain('stroke-dasharray');

    const area = renderToStaticMarkup(
      <StaticCartesianChartSvg
        chartType="area"
        rows={rows}
        series={['North', 'Missing']}
        presentation={presentation}
      />
    );
    expect(area).toContain('<polygon');
    expect(area).toContain('<polyline');
  });

  it('renders empty, pie, donut, and delegated static chart variants', () => {
    const empty = renderToStaticMarkup(
      <StaticPieChartSvg points={[]} presentation={{ donut: false }} />
    );
    expect(empty).toContain('<circle');

    const piePoints: ChartPoint[] = [
      { x: 'A', series: null, value: 8 },
      { x: 'B', series: 'North', value: 1 },
      { x: 'Ignored', value: -2 },
    ];
    const pie = renderToStaticMarkup(
      <StaticPieChartSvg points={piePoints} presentation={{ donut: false }} />
    );
    const donut = renderToStaticMarkup(
      <StaticPieChartSvg points={piePoints} presentation={{ donut: true }} />
    );
    expect(pie).toContain('<path');
    expect(donut).toContain('<path');

    expect(
      renderToStaticMarkup(
        <StaticChartSvg
          chartType="pie"
          points={piePoints}
          rows={[]}
          series={['value']}
          presentation={{}}
        />
      )
    ).toContain('<svg');
    expect(
      renderToStaticMarkup(
        <StaticChartSvg
          chartType="line"
          points={[]}
          rows={[{ x: 'A', value: 1 }]}
          series={['value']}
          presentation={{}}
        />
      )
    ).toContain('<svg');
  });

  it('constructs all cartesian chart kinds, hover handlers, legends, and tooltip content', () => {
    const onHoverChange = vi.fn();
    const rows = [
      { x: 'A', North: 1, South: 2 },
      { x: 'B', North: 3, South: 4 },
    ];

    for (const chartType of ['bar', 'area', 'line'] as const) {
      const element = CartesianChartContent({
        chartType,
        rows,
        series: ['North', 'South'],
        presentation,
        staticMode: false,
        onHoverChange,
        valueFormatter: value => `#${value}`,
        width: 500,
        height: 300,
      }) as React.ReactElement<any>;
      expect(element.props.width).toBe(500);
      element.props.onMouseMove({
        activeLabel: 'A',
        activePayload: [{ name: 'North', value: 1 }],
      });
      element.props.onMouseLeave();

      const common = React.Children.toArray(element.props.children)[0] as React.ReactElement<any>;
      const commonChildren = React.Children.toArray(
        common.props.children
      ) as React.ReactElement<any>[];
      const tooltip = commonChildren.find(child => typeof child?.props?.content === 'function');
      expect(tooltip?.props.content({})).toBeTruthy();
      const legend = commonChildren.find(
        child => typeof child?.props?.content === 'function' && child !== tooltip
      );
      expect(legend?.props.content({ ref: null })).toBeTruthy();
    }
    expect(onHoverChange).toHaveBeenCalledWith(null);

    const quiet = CartesianChartContent({
      chartType: 'line',
      rows,
      series: ['North'],
      presentation: { showGrid: false, showLegend: false, showTooltip: false },
      staticMode: false,
      width: 500,
    }) as React.ReactElement<any>;
    expect(quiet.props.width).toBeUndefined();

    expect(
      renderToStaticMarkup(
        <CartesianChartContent
          chartType="bar"
          rows={rows}
          series={['North', 'South']}
          presentation={presentation}
          staticMode
          width={500}
          height={300}
        />
      )
    ).toBeTruthy();
  });

  it('constructs pie hover, tooltip, formatter, dimension, and presentation variants', () => {
    const onHoverChange = vi.fn();
    const points: ChartPoint[] = [
      { x: 'A', value: 2, series: null },
      { x: 'B', value: 3, series: 'North' },
    ];
    const element = PieChartContent({
      points,
      presentation,
      staticMode: false,
      onHoverChange,
      valueFormatter: value => `#${value}`,
      width: 500,
      height: 300,
    }) as React.ReactElement<any>;
    expect(element.props.width).toBe(500);
    const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
    const pie = children[0];
    pie.props.onMouseEnter({ name: 'A', value: 2 }, 0, {});
    pie.props.onMouseMove({ name: 'A', value: 2 }, 0, {});
    pie.props.onMouseLeave();
    expect(onHoverChange).toHaveBeenCalled();
    const tooltipContent = children[1].props.content({}) as React.ReactElement<any>;
    const formatted = tooltipContent.props.formatter(2, 'A', { payload: points[0] });
    expect(renderToStaticMarkup(formatted)).toContain('#2');

    const staticElement = PieChartContent({
      points: [points[0]],
      presentation: { ...presentation, donut: false },
      staticMode: true,
      valueFormatter: value => `v${value}`,
    }) as React.ReactElement<any>;
    const staticChildren = React.Children.toArray(
      staticElement.props.children
    ) as React.ReactElement<any>[];
    expect(staticChildren[0].props.innerRadius).toBe(0);
    expect(staticChildren[0].props.paddingAngle).toBe(0);
    expect(
      staticChildren[1].props.formatter(2, 'A', { payload: { ...points[0], name: 'A' } })
    ).toEqual(['v2', 'A']);

    const unformattedStatic = PieChartContent({
      points: [points[0]],
      presentation,
      staticMode: true,
    }) as React.ReactElement<any>;
    const unformattedStaticChildren = React.Children.toArray(
      unformattedStatic.props.children
    ) as React.ReactElement<any>[];
    expect(
      unformattedStaticChildren[1].props.formatter(2, 'A', {
        payload: { ...points[0], name: 'A' },
      })
    ).toEqual([(2).toLocaleString(), 'A']);

    const unformattedInteractive = PieChartContent({
      points,
      presentation,
      staticMode: false,
      onHoverChange,
    }) as React.ReactElement<any>;
    const unformattedInteractiveChildren = React.Children.toArray(
      unformattedInteractive.props.children
    ) as React.ReactElement<any>[];
    const unformattedContent = unformattedInteractiveChildren[1].props.content(
      {}
    ) as React.ReactElement<any>;
    expect(
      renderToStaticMarkup(unformattedContent.props.formatter(2, 'A', { payload: points[0] }))
    ).toContain((2).toLocaleString());

    const noTooltip = PieChartContent({
      points,
      presentation: { showTooltip: false },
      staticMode: false,
      width: 500,
    }) as React.ReactElement<any>;
    expect(noTooltip.props.width).toBeUndefined();
  });

  it('routes the public renderer through empty and both interactive chart families', () => {
    expect(renderToStaticMarkup(<ChartRenderer chartType="line" />)).toContain('No chart data');
    expect(
      renderToStaticMarkup(<ChartRenderer chartType="pie" points={[{ x: 'A', value: 1 }]} />)
    ).toBeTruthy();
    expect(
      renderToStaticMarkup(<ChartRenderer chartType="line" points={[{ x: 'A', value: 1 }]} />)
    ).toBeTruthy();
  });
});
