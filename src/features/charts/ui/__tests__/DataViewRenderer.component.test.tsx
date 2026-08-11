/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataViewProjection } from '../../api/datasetClient';
import type { DataViewKind, DataViewProjection, TDataViewElement } from '../../types';
import { DataViewRenderer, getDataViewErrorMessage } from '../DataViewRenderer';

const chartCapture = vi.hoisted(() => ({ props: null as any }));

vi.mock('../../api/datasetClient', () => ({ createDataViewProjection: vi.fn() }));
vi.mock('../ChartRenderer', () => ({
  ChartRenderer: (props: any) => {
    chartCapture.props = props;
    return <div data-testid="rendered-chart" />;
  },
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

  it('does not render raw unauthorized errors', async () => {
    vi.mocked(createDataViewProjection).mockRejectedValue(new Error('Unauthorized'));

    render(<DataViewRenderer element={baseElement} accessToken={null} />);

    await waitFor(() =>
      expect(screen.getByText('plateJs.dataView.previewUnavailable')).toBeTruthy()
    );
    expect(screen.queryByText('Unauthorized')).toBeNull();
  });

  it('normalizes non-errors, authorization failures, and safe server messages', () => {
    expect(getDataViewErrorMessage('failure', 'Fallback')).toBe('Fallback');
    expect(getDataViewErrorMessage(new Error('Unauthorized'), 'Fallback')).toBe('Fallback');
    expect(getDataViewErrorMessage(new Error('request returned 401'), 'Fallback')).toBe('Fallback');
    expect(getDataViewErrorMessage(new Error('Dataset missing'), 'Fallback')).toBe(
      'Dataset missing'
    );
  });

  it('falls back to source and projection labels and renders optional descriptions', async () => {
    const staticElement = {
      ...baseElement,
      presentation: { ...baseElement.presentation, title: '' },
    };
    const staticView = render(<DataViewRenderer element={staticElement} staticMode />);
    expect(screen.getByText('Employment')).toBeTruthy();
    staticView.unmount();

    vi.mocked(createDataViewProjection).mockResolvedValueOnce(projectionFor('chart'));
    render(
      <DataViewRenderer
        element={{ ...staticElement, chartType: undefined as any }}
        accessToken="token"
      />
    );
    await waitFor(() => expect(screen.getByTestId('rendered-chart')).toBeTruthy());
    expect(chartCapture.props.chartType).toBe('bar');
    cleanup();

    vi.mocked(createDataViewProjection).mockResolvedValueOnce(projectionFor('stat'));
    render(
      <DataViewRenderer
        element={{
          ...staticElement,
          view: 'stat',
          presentation: { title: '', description: 'Stat details' },
        }}
        accessToken="token"
      />
    );
    await waitFor(() => expect(screen.getByText('Value')).toBeTruthy());
    expect(screen.getByText('Stat details')).toBeTruthy();
    cleanup();

    vi.mocked(createDataViewProjection).mockResolvedValueOnce(projectionFor('table'));
    render(
      <DataViewRenderer
        element={{
          ...staticElement,
          view: 'table',
          presentation: { title: 'Table title', description: 'Table details' },
        }}
        accessToken="token"
      />
    );
    await waitFor(() => expect(screen.getByText('Table details')).toBeTruthy());
    cleanup();

    vi.mocked(createDataViewProjection).mockResolvedValueOnce(projectionFor('table'));
    render(
      <DataViewRenderer
        element={{ ...staticElement, view: 'table', presentation: { title: '' } }}
        accessToken="token"
      />
    );
    await waitFor(() => expect(screen.getByText('Year')).toBeTruthy());
    expect(screen.queryByRole('figure')?.querySelector('figcaption')).toBeNull();
  });

  it('renders the projection fallback when a request returns no projection', async () => {
    vi.mocked(createDataViewProjection).mockResolvedValueOnce(null as any);
    render(<DataViewRenderer element={baseElement} accessToken="token" />);
    await waitFor(() =>
      expect(screen.getByText('plateJs.dataView.previewUnavailable')).toBeTruthy()
    );
  });

  it('ignores both resolved and rejected work after unmount', async () => {
    let resolve!: (value: DataViewProjection) => void;
    vi.mocked(createDataViewProjection).mockReturnValueOnce(
      new Promise(value => {
        resolve = value;
      })
    );
    const resolvedView = render(<DataViewRenderer element={baseElement} accessToken="token" />);
    resolvedView.unmount();
    resolve(projectionFor('chart'));
    await Promise.resolve();

    let reject!: (error: Error) => void;
    vi.mocked(createDataViewProjection).mockReturnValueOnce(
      new Promise((_resolve, failure) => {
        reject = failure;
      })
    );
    const rejectedView = render(<DataViewRenderer element={baseElement} accessToken="token" />);
    rejectedView.unmount();
    reject(new Error('ignored'));
    await Promise.resolve();
  });
});
