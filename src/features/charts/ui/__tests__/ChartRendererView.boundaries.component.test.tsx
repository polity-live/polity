/* @vitest-environment jsdom */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AxisLabelFrame, ChartRendererView, HoverValueTooltip } from '../ChartRendererView';

const baseProps = {
  chartType: 'bar',
  points: [{ x: 'A', value: 1 }],
  presentation: {},
  className: undefined,
  heightClassName: 'h-80',
  staticMode: false,
  valueFormatter: undefined,
  series: ['value'],
  rows: [{ x: 'A', value: 1 }],
  config: {},
  hoverTooltip: null,
  onHoverChange: undefined,
  chart: <svg data-testid="chart" />,
};

describe('ChartRendererView boundaries', () => {
  it('renders the empty state with caller styling', () => {
    const html = renderToStaticMarkup(
      <ChartRendererView {...baseProps} points={[]} className="custom-empty" />
    );
    expect(html).toContain('custom-empty');
    expect(html).toContain('No chart data');
  });

  it('renders static title, description, and both axis labels', () => {
    const html = renderToStaticMarkup(
      <ChartRendererView
        {...baseProps}
        staticMode
        className="custom-figure"
        presentation={{
          title: 'Population',
          description: 'Residents',
          xAxisLabel: 'Year',
          yAxisLabel: 'People',
        }}
      />
    );
    expect(html).toContain('Population');
    expect(html).toContain('Residents');
    expect(html).toContain('Year');
    expect(html).toContain('People');
    expect(html).toContain('custom-figure');
  });

  it('renders interactive tooltip values and supports hidden tooltips', () => {
    const state = {
      label: '2026',
      x: 12,
      y: 24,
      items: [
        { name: 'North', value: '5', color: 'red' },
        { name: 'South', value: '4' },
      ],
    };
    const visible = renderToStaticMarkup(
      <ChartRendererView
        {...baseProps}
        presentation={{ title: 'Only title' }}
        hoverTooltip={state}
      />
    );
    expect(visible).toContain('2026');
    expect(visible).toContain('North');
    expect(visible).toContain('background-color:red');
    expect(visible).toContain('h-80');

    const hidden = renderToStaticMarkup(
      <ChartRendererView {...baseProps} presentation={{ showTooltip: false }} />
    );
    expect(hidden).not.toContain('North');
  });

  it('handles tooltip and axis-label short circuits directly', () => {
    expect(renderToStaticMarkup(<HoverValueTooltip state={null} />)).toBe('');
    expect(
      renderToStaticMarkup(
        <HoverValueTooltip state={{ x: 0, y: 0, items: [{ name: 'Value', value: '1' }] }} />
      )
    ).not.toContain('font-medium">Value</div>');

    expect(
      renderToStaticMarkup(
        <AxisLabelFrame chartType="pie" presentation={{ xAxisLabel: 'Ignored' }}>
          <span>Pie</span>
        </AxisLabelFrame>
      )
    ).toBe('<span>Pie</span>');
    expect(
      renderToStaticMarkup(
        <AxisLabelFrame chartType="line" presentation={{}}>
          <span>Plain</span>
        </AxisLabelFrame>
      )
    ).toBe('<span>Plain</span>');
    expect(
      renderToStaticMarkup(
        <AxisLabelFrame chartType="line" presentation={{ xAxisLabel: ' X ' }}>
          <span>X only</span>
        </AxisLabelFrame>
      )
    ).toContain('X');
    expect(
      renderToStaticMarkup(
        <AxisLabelFrame chartType="line" presentation={{ yAxisLabel: ' Y ' }}>
          <span>Y only</span>
        </AxisLabelFrame>
      )
    ).toContain('Y');
  });
});
