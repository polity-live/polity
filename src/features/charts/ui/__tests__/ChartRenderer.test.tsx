import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartRenderer } from '../ChartRenderer';
import type { ChartType } from '../../types';

const points = [
  { x: '2024', value: 12, series: 'North' },
  { x: '2024', value: 8, series: 'South' },
  { x: '2025', value: 15, series: 'North' },
];

describe('ChartRenderer', () => {
  for (const chartType of ['line', 'bar', 'area', 'pie'] satisfies ChartType[]) {
    it(`renders ${chartType} charts in static mode`, () => {
      const html = renderToStaticMarkup(
        <ChartRenderer
          chartType={chartType}
          points={points}
          presentation={{ title: 'Composition', showLegend: true }}
          staticMode
        />
      );

      expect(html).toContain('<svg');
      expect(html).toContain('Composition');
      expect(html).not.toContain('NaN');
    });
  }

  it('renders axis labels for cartesian charts', () => {
    const html = renderToStaticMarkup(
      <ChartRenderer
        chartType="bar"
        points={points}
        presentation={{ xAxisLabel: 'Year', yAxisLabel: 'Members' }}
        staticMode
      />
    );

    expect(html).toContain('Year');
    expect(html).toContain('Members');
  });

  it('renders cartesian charts with hover values disabled', () => {
    const html = renderToStaticMarkup(
      <ChartRenderer
        chartType="line"
        points={points}
        presentation={{ showTooltip: false }}
        staticMode
      />
    );

    expect(html).toContain('<svg');
    expect(html).not.toContain('NaN');
  });
});
