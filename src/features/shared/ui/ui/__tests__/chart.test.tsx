// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => <div data-testid="recharts-tooltip" />,
  Legend: () => <div data-testid="recharts-legend" />,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: () => 'dot',
}));

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent as TypedChartTooltipContent,
  type ChartConfig,
} from '../chart';

const ChartTooltipContent = TypedChartTooltipContent as React.ComponentType<any>;

function Icon() {
  return <svg data-testid="series-icon" />;
}

function renderInChart(child: ReactNode, config: ChartConfig, id = 'test') {
  return render(
    <ChartContainer id={id} config={config}>
      {child as any}
    </ChartContainer>
  );
}

describe('chart primitives', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('provides stable chart ids, emits color variables, and skips empty styles', () => {
    const { container, rerender } = render(
      <ChartContainer id="revenue" className="custom-chart" config={{}} data-extra="kept">
        <span>chart-body</span>
      </ChartContainer>
    );

    const chart = container.querySelector('[data-chart="chart-revenue"]');
    expect(chart?.getAttribute('data-extra')).toBe('kept');
    expect(chart?.className).toContain('custom-chart');
    expect(container.querySelector('style')).toBeNull();
    expect(screen.getByText('chart-body')).toBeTruthy();

    rerender(
      <ChartContainer
        config={
          {
            direct: { color: '#123456' },
            themed: { theme: { light: '#ffffff', dark: '#000000' } },
            missingDark: { theme: { light: '#eeeeee', dark: '' } },
            labelOnly: { label: 'No color' },
          } as ChartConfig
        }
      >
        <span>themed-body</span>
      </ChartContainer>
    );

    const generatedChart = container.querySelector('[data-chart^="chart-"]');
    expect(generatedChart).toBeTruthy();
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toContain('--color-direct: #123456');
    expect(css).toContain('--color-themed: #ffffff');
    expect(css).toContain('--color-themed: #000000');
    expect(css).not.toContain('--color-labelOnly');
  });

  it('rejects tooltip and legend consumers outside a chart context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<ChartTooltipContent active payload={[] as any} />)).toThrow(
      'useChart must be used within a <ChartContainer />'
    );
    expect(() => render(<ChartLegendContent payload={[]} />)).toThrow(
      'useChart must be used within a <ChartContainer />'
    );
  });

  it('keeps inactive and empty tooltips hidden while exposing recharts aliases', () => {
    expect(ChartTooltip).toBeTypeOf('function');
    expect(ChartLegend).toBeTypeOf('function');

    const { container, rerender } = render(
      <ChartContainer id="inactive" config={{}}>
        <ChartTooltipContent active={false} payload={[] as any} />
      </ChartContainer>
    );
    expect(container.querySelector('[class*="min-w"]')).toBeNull();

    rerender(
      <ChartContainer id="empty" config={{}}>
        <ChartTooltipContent active payload={undefined as any} />
      </ChartContainer>
    );
    expect(container.querySelector('[class*="min-w"]')).toBeNull();

    rerender(
      <ChartContainer id="invalid-payload" config={{ explicit: { label: 'Explicit' } }}>
        <ChartTooltipContent active={false} labelKey="explicit" payload={[null] as any} />
      </ChartContainer>
    );
    expect(container.querySelector('[class*="min-w"]')).toBeNull();
  });

  it('renders dot tooltip labels, icons, values, payload colors, and fallback keys', () => {
    const config: ChartConfig = {
      series: { label: 'Series label', icon: Icon, color: '#series' },
      nested: { label: 'Nested label', color: '#nested' },
      value: { label: 'Value fallback', color: '#value' },
    };
    const payload = [
      {
        dataKey: 'series',
        name: 'series',
        value: 1234,
        color: '#item',
        payload: { fill: '#fill' },
      },
      {
        dataKey: undefined,
        name: 'nested',
        value: 0,
        color: '#second',
        payload: { fill: '#second-fill' },
      },
      {
        dataKey: undefined,
        name: undefined,
        value: null,
        color: '#third',
        payload: {},
      },
    ];

    renderInChart(<ChartTooltipContent active label="series" payload={payload as any} />, config);

    expect(screen.getAllByText('Series label').length).toBeGreaterThan(0);
    expect(screen.getByTestId('series-icon')).toBeTruthy();
    expect(screen.getByText(/1[.,]234/)).toBeTruthy();
    expect(screen.getByText('Nested label')).toBeTruthy();
    expect(screen.getByText('Value fallback')).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();
  });

  it('falls back to the value key and a raw string label', () => {
    renderInChart(
      <ChartTooltipContent
        active
        label="raw-label"
        payload={[{ value: 1, payload: {}, color: '#raw' }] as any}
      />,
      { value: { label: 'Value fallback', color: '#value' } },
      'raw-label'
    );

    expect(screen.getByText('raw-label')).toBeTruthy();
    expect(screen.getByText('Value fallback')).toBeTruthy();
  });

  it('supports nested line and dashed labels, label keys, formatters, and hidden indicators', () => {
    const config: ChartConfig = {
      outerMapped: { label: 'Outer mapped', color: '#outer' },
      nestedMapped: { label: 'Nested mapped', color: '#nested' },
      explicit: { label: 'Explicit label', color: '#explicit' },
      raw: { color: '#raw' },
    };

    const line = renderInChart(
      <ChartTooltipContent
        active
        indicator="line"
        label="ignored"
        labelKey="kind"
        labelFormatter={(value: unknown, payload: readonly unknown[]) =>
          `formatted:${String(value)}:${payload.length}`
        }
        payload={
          [
            {
              kind: 'outerMapped',
              name: 'raw',
              value: 5,
              payload: { fill: '#payload-fill' },
            },
          ] as any
        }
      />,
      config,
      'line'
    );
    expect(screen.getByText('formatted:Outer mapped:1')).toBeTruthy();
    line.unmount();

    const dashed = renderInChart(
      <ChartTooltipContent
        active
        indicator="dashed"
        color="#forced"
        nameKey="kind"
        payload={
          [
            {
              kind: 42,
              name: 'raw',
              value: undefined,
              color: '#item-color',
              payload: { kind: 'nestedMapped' },
            },
          ] as any
        }
      />,
      config,
      'dashed'
    );
    expect(screen.getByText('Nested mapped')).toBeTruthy();
    dashed.unmount();

    const formatter = vi.fn(() => <strong>custom-value</strong>);
    renderInChart(
      <ChartTooltipContent
        active
        hideLabel
        hideIndicator
        formatter={formatter as any}
        payload={
          [
            {
              dataKey: 'explicit',
              name: 'Named',
              value: 7,
              payload: {},
            },
          ] as any
        }
      />,
      config,
      'formatter'
    );
    expect(screen.getByText('custom-value')).toBeTruthy();
    expect(formatter).toHaveBeenCalledWith(7, 'Named', expect.anything(), 0, {});
  });

  it('renders legend variants and resolves outer, nested, fallback, and invalid payloads', () => {
    const config: ChartConfig = {
      iconSeries: { label: 'Icon series', icon: Icon, color: '#icon' },
      outerMapped: { label: 'Outer legend', color: '#outer' },
      nestedMapped: { label: 'Nested legend', color: '#nested' },
      value: { label: 'Value legend', color: '#value' },
    };

    const empty = renderInChart(<ChartLegendContent payload={undefined} />, config, 'empty-legend');
    expect(screen.getByTestId('responsive-container').childElementCount).toBe(0);
    empty.unmount();

    const { rerender } = render(
      <ChartContainer id="legend" config={config}>
        <ChartLegendContent
          verticalAlign="top"
          payload={
            [
              { dataKey: 'iconSeries', value: 'icon', color: '#icon' },
              { dataKey: undefined, value: 'outerMapped', color: '#outer' },
              { dataKey: undefined, value: undefined, color: '#value' },
            ] as any
          }
        />
      </ChartContainer>
    );
    expect(screen.getByTestId('series-icon')).toBeTruthy();
    expect(screen.getByText('Icon series')).toBeTruthy();
    expect(screen.getByText('Value legend')).toBeTruthy();

    rerender(
      <ChartContainer id="legend-hidden" config={config}>
        <ChartLegendContent
          hideIcon
          nameKey="kind"
          verticalAlign="bottom"
          payload={
            [
              {
                dataKey: 'iconSeries',
                value: 'fallback',
                color: '#hidden',
                kind: 'outerMapped',
                payload: { kind: 'nestedMapped' },
              },
            ] as any
          }
        />
      </ChartContainer>
    );
    expect(screen.queryByTestId('series-icon')).toBeNull();
    expect(screen.getByText('Outer legend')).toBeTruthy();
  });
});
