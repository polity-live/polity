/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { DatasetSamplePreview } from '../DatasetSamplePreview';
import type { DatasetPreview } from '../../types';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
const preview: DatasetPreview = {
  identity: { provider: 'GENESIS_DESTATIS', providerDatasetId: '13211-0002' },
  columns: [
    {
      name: 'period',
      label: 'Zeitraum',
      role: 'time',
      type: 'date',
      distinctCount: 5,
      nullCount: 0,
    },
    {
      name: 'code',
      label: 'statistics_code',
      role: 'label',
      type: 'category',
      distinctCount: 1,
      nullCount: 0,
      technical: true,
    },
  ],
  rows: Array.from({ length: 5 }, (_, index) => ({
    period: index === 0 ? '' : `2025-0${index}`,
    code: '13211',
  })),
  appliedFilters: { area: 'Deutschland' },
  rowFilters: {},
  sampled: true,
  sampledRowCount: 12,
};
it('shows names, a separate type row, five samples, missing values and a technical-column toggle', async () => {
  render(<DatasetSamplePreview preview={preview} />);
  expect(screen.getAllByRole('row')).toHaveLength(7);
  expect(within(screen.getAllByRole('row')[0]).getByText('Zeitraum')).toBeTruthy();
  expect(
    within(screen.getAllByRole('row')[1]).getByText('plateJs.dataView.dataTypes.date')
  ).toBeTruthy();
  expect(screen.getByText('plateJs.dataView.missingValue')).toBeTruthy();
  expect(screen.queryByText('statistics_code')).toBeNull();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByText('statistics_code')).toBeTruthy();
  const checkbox = screen.getByRole('checkbox');
  checkbox.focus();
  expect(document.activeElement).toBe(checkbox);
  await userEvent.setup().keyboard(' ');
  expect(screen.queryByText('statistics_code')).toBeNull();
});
it('keeps sample loading, empty and error states independent of a chart', async () => {
  const retry = vi.fn();
  const { rerender } = render(<DatasetSamplePreview loading />);
  expect(screen.getByRole('status')).toBeTruthy();
  rerender(<DatasetSamplePreview preview={{ ...preview, rows: [] }} />);
  expect(screen.getByRole('status').textContent).toContain('sampleEmpty');
  rerender(<DatasetSamplePreview error="Timed out" onRetry={retry} />);
  const button = screen.getByRole('button');
  button.focus();
  expect(document.activeElement).toBe(button);
  await userEvent.setup().keyboard('{Enter}');
  expect(retry).toHaveBeenCalledOnce();
});
it.each([
  { start: 1800, end: 2199, startYear: 1800, endYear: 2199, expected: '…–…' },
  { start: 2024, end: 2025, startYear: 2023, endYear: 2026, expected: '2024–2025' },
])('describes period and dimension scope and resolves sample codes ($expected)', scope => {
  render(
    <DatasetSamplePreview
      preview={{
        ...preview,
        rows: [
          { period: '2025', code: '13211' },
          { period: 'unknown', code: '13211' },
        ],
        appliedFilters: {
          period: { start: scope.start, end: scope.end },
          dimensions: { period: '2025', unknown: 'raw', unlisted: 'raw' },
        },
        rowFilters: { code: '13211' },
        timeRange: { column: 'period', startYear: scope.startYear, endYear: scope.endYear },
        metadata: {
          providerDimensions: [
            { id: 'period', label: 'Year', values: [{ id: '2025', label: 'Year 2025' }] },
            { id: 'unknown', label: 'Unknown dimension', values: [] },
            {
              id: 'code',
              label: 'Code',
              values: [{ id: '13211', label: 'Decoded technical code' }],
            },
          ],
        },
      }}
    />
  );
  expect(screen.getByText(/sampleScope/).textContent).toContain(scope.expected);
  expect(screen.getByText(/sampleScope/).textContent).toContain('Year: Year 2025');
  expect(screen.getByText(/sampleScope/).textContent).toContain('Unknown dimension: raw');
  expect(screen.getByText(/sampleScope/).textContent).toContain('unlisted: raw');
  expect(within(screen.getByRole('table')).getByText('Year 2025')).toBeTruthy();
  expect(within(screen.getByRole('table')).getByText('unknown')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(within(screen.getByRole('table')).queryByText('Decoded technical code')).toBeNull();
  expect(within(screen.getByRole('table')).getAllByText('13211')).toHaveLength(2);
});

const isolatedScopes: (Pick<DatasetPreview, 'appliedFilters' | 'rowFilters' | 'timeRange'> & {
  scope: string | null;
})[] = [
  {
    appliedFilters: { dimensions: { period: '2025' } },
    rowFilters: {},
    timeRange: undefined,
    scope: 'period: 2025',
  },
  {
    appliedFilters: {},
    rowFilters: { period: '2025' },
    timeRange: undefined,
    scope: 'period: 2025',
  },
  {
    appliedFilters: {},
    rowFilters: {},
    timeRange: { column: 'period', startYear: 2020, endYear: 2025 },
    scope: '2020–2025',
  },
  { appliedFilters: {}, rowFilters: {}, timeRange: undefined, scope: null },
];
it.each(isolatedScopes)(
  'describes scope independently when the only restriction is $scope',
  selection => {
    render(
      <DatasetSamplePreview
        preview={{
          ...preview,
          appliedFilters: selection.appliedFilters,
          rowFilters: selection.rowFilters,
          timeRange: selection.timeRange,
        }}
      />
    );
    if (selection.scope) {
      expect(screen.getByText(/sampleScope/).textContent).toContain(selection.scope);
    } else {
      expect(screen.queryByText(/sampleScope/)).toBeNull();
    }
    expect(screen.getByRole('table')).toBeTruthy();
  }
);
