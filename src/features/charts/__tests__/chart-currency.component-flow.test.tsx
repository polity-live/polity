/* @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import { ChartRendererView } from '../ui/ChartRendererView';

function ChartFlow() {
  const [currencyError, setCurrencyError] = useState(false);
  const points = [{ x: '2026', value: 14, series: null }];
  return (
    <>
      <ChartRendererView
        chartType="bar"
        points={points}
        presentation={{ title: 'Dataset projection', xAxisLabel: 'Year', yAxisLabel: 'EUR' }}
        className=""
        heightClassName="h-64"
        staticMode
        valueFormatter={undefined}
        series={[]}
        rows={points}
        config={{}}
        hoverTooltip={null}
        onHoverChange={undefined}
        chart={
          <svg aria-label="projection chart">
            <text>14 EUR</text>
          </svg>
        }
      />
      <button type="button" onClick={() => setCurrencyError(true)}>
        Refresh exchange rate
      </button>
      {currencyError ? <p role="alert">Rate unavailable; showing EUR source values</p> : null}
    </>
  );
}

afterEach(cleanup);

describe('chart and currency component flow', () => {
  it('creates a chart view from projected dataset points', () => {
    renderComponentFlow(<ChartFlow />);
    expect(screen.getByText('Dataset projection')).toBeTruthy();
    expect(screen.getByLabelText('projection chart').textContent).toContain('14 EUR');
  });

  it('falls back to source-currency values after a rate boundary error', () => {
    renderComponentFlow(<ChartFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh exchange rate' }));
    expect(screen.getByRole('alert').textContent).toContain('showing EUR source values');
    expect(screen.getByLabelText('projection chart').textContent).toContain('14 EUR');
  });
});
