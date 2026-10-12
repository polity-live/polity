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
