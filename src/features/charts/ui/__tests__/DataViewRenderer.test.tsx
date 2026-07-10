/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataViewProjection } from '../../api/datasetClient';
import type { DataViewKind, DataViewProjection, TDataViewElement } from '../../types';
import { DataViewRenderer } from '../DataViewRenderer';

vi.mock('../../api/datasetClient', () => ({ createDataViewProjection: vi.fn() }));
vi.mock('../ChartRenderer', () => ({
  ChartRenderer: () => <div data-testid="rendered-chart" />,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'de-DE' },
    t: (key: string, options?: Record<string, unknown>) =>
      key === 'plateJs.dataView.source'
        ? 'Quelle'
        : key === 'plateJs.dataView.dataAsOf'
          ? `Datenstand ${options?.date}`
          : key,
  }),
}));

const baseElement: TDataViewElement = {
  type: 'data_view',
  view: 'chart',
  chartType: 'bar',
  source: {
    kind: 'dataset',
    provider: 'GOVDATA',
    datasetId: 'dataset-id',
    snapshotId: 'snapshot-id',
    title: 'Employment',
    publisher: 'Statistical office',
    sourceUrl: 'https://example.test/dataset',
    snapshotTakenAt: '2026-07-10T12:00:00.000Z',
  },
  query: { filters: {}, aggregation: 'sum', limit: 10 },
  presentation: { title: 'Employment' },
  children: [{ text: '' }],
};

function projectionFor(view: DataViewKind): DataViewProjection {
  if (view === 'table') {
    return {
      view,
      snapshotId: 'snapshot-id',
      columns: ['Year', 'Value'],
      rows: [{ Year: '2025', Value: '42' }],
      rowCount: 1,
    };
  }
  if (view === 'stat') {
    return {
      view,
      snapshotId: 'snapshot-id',
      label: 'Value',
      value: 42,
      aggregation: 'sum',
      rowCount: 1,
    };
  }
  return {
    view,
    snapshotId: 'snapshot-id',
    points: [{ x: '2025', value: 42 }],
    rowCount: 1,
  };
}

describe('DataViewRenderer attribution', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  for (const view of ['chart', 'table', 'stat'] as const) {
    it(`renders attribution for ${view} views`, async () => {
      vi.mocked(createDataViewProjection).mockResolvedValue(projectionFor(view));
      render(<DataViewRenderer element={{ ...baseElement, view }} accessToken="token" />);

      await waitFor(() => expect(screen.getByTestId('data-view-attribution')).toBeTruthy());
      expect(screen.getByTestId('data-view-attribution').textContent).toContain(
        'Statistical office (GovData)'
      );
    });
  }

  it('renders the same attribution in static mode without fetching data', () => {
    render(<DataViewRenderer element={baseElement} staticMode />);

    expect(screen.getByTestId('data-view-attribution').textContent).toContain(
      'Statistical office (GovData)'
    );
    expect(createDataViewProjection).not.toHaveBeenCalled();
  });
});
