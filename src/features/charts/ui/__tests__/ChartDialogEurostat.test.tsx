/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EurostatDatasetDetails, TChartElement } from '../../types';
import {
  createEurostatChartProjection,
  loadEurostatDatasetDetails,
} from '../../api/eurostatClient';
import { ChartDialog, openChartDialog } from '../ChartDialog';

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { type: string; args: { limit?: number } } | undefined) => {
    if (!query) return [undefined, { type: 'complete' }];
    if (query.type === 'datasetById') {
      return [
        {
          id: 'dataset-1',
          status: 'ready',
          observation_count: 6,
        },
        { type: 'complete' },
      ];
    }
    if (query.type === 'observationPreview') {
      const rows = Array.from({ length: 6 }, (_, index) => ({
        id: `row-${index}`,
        value: 100 + index,
        dimensions: {
          geo: 'DE',
          unit: 'PC_GDP',
          TIME_PERIOD: `202${index}`,
        },
        attributes: index === 0 ? { OBS_STATUS: 'A' } : {},
      }));
      return [rows.slice(0, query.args.limit ?? 5), { type: 'complete' }];
    }
    return [undefined, { type: 'complete' }];
  },
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    eurostat: {
      datasetById: (args: unknown) => ({ type: 'datasetById', args }),
      observationPreview: (args: unknown) => ({ type: 'observationPreview', args }),
    },
  },
}));

vi.mock('../../api/eurostatClient', () => ({
  continueEurostatImport: vi.fn(),
  createEurostatChartProjection: vi.fn(),
  loadEurostatDatasetDetails: vi.fn(),
  searchEurostatDatasets: vi.fn(),
  startEurostatImport: vi.fn(),
}));

vi.mock('../ChartRenderer', () => ({
  ChartRenderer: ({ points }: { points: unknown[] }) => (
    <div data-testid="chart-points">{points.length}</div>
  ),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { access_token: 'token' } }),
}));

vi.mock('platejs/react', () => ({
  useEditorRef: () => ({
    api: { findPath: vi.fn(() => [0]) },
    tf: { focus: vi.fn(), insertNodes: vi.fn(), setNodes: vi.fn() },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'en' },
    t: (_key: string, fallbackOrOptions?: string | Record<string, unknown>) =>
      typeof fallbackOrOptions === 'string' ? fallbackOrOptions : _key,
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const details: EurostatDatasetDetails = {
  code: 'DEMO',
  title: 'Demo dataset',
  type: 'dataset',
  lastUpdate: null,
  structureLastChange: null,
  dataStart: null,
  dataEnd: null,
  valueCount: 6,
  language: 'en',
  snapshotKey: 'snap-demo',
  sampleRowBytes: 64,
  estimatedBytes: 1024,
  importAllowed: true,
  attributes: ['OBS_STATUS'],
  dimensions: [
    {
      id: 'geo',
      label: 'Geography',
      position: 0,
      values: [{ id: 'DE', label: 'Germany' }],
    },
    {
      id: 'unit',
      label: 'Unit',
      position: 1,
      values: [{ id: 'PC_GDP' }],
    },
    {
      id: 'TIME_PERIOD',
      label: 'Time',
      position: 2,
      values: [{ id: '2020' }, { id: '2021' }, { id: '2022' }],
    },
  ],
};

const eurostatElement: TChartElement = {
  type: 'chart',
  chartType: 'bar',
  mapping: {
    xColumn: 'TIME_PERIOD',
    valueColumn: 'OBS_VALUE',
    seriesColumn: null,
  },
  presentation: {},
  source: {
    kind: 'eurostat',
    datasetId: 'dataset-1',
    datasetCode: 'DEMO',
    snapshotKey: 'snap-demo',
    projectionId: 'projection-old',
    filters: { geo: 'DE', unit: 'PC_GDP' },
  },
  points: [],
  children: [{ text: '' }],
};

describe('ChartDialog Eurostat flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows downloaded preview rows and creates a chart projection preview', async () => {
    vi.mocked(loadEurostatDatasetDetails).mockResolvedValue(details);
    vi.mocked(createEurostatChartProjection).mockResolvedValue({
      projectionId: 'projection-new',
      points: [{ x: '2020', value: 100, series: null }],
    });

    render(<ChartDialog />);

    act(() => {
      openChartDialog(eurostatElement);
    });

    await waitFor(() => expect(loadEurostatDatasetDetails).toHaveBeenCalledWith('DEMO', 'en'));
    expect(await screen.findByText('First 5 downloaded rows')).toBeTruthy();
    expect(screen.getAllByTestId('eurostat-observation-preview-row')).toHaveLength(5);
    expect(screen.getAllByText('DE · Germany').length).toBeGreaterThan(0);
    expect(screen.getByText('OBS_STATUS: A')).toBeTruthy();
    expect(screen.getByText('Filters complete')).toBeTruthy();
    expect(screen.getByText('Y-axis / value')).toBeTruthy();
    expect(screen.getAllByText('OBS_VALUE').length).toBeGreaterThan(0);
    expect(screen.getByText('Show values on hover')).toBeTruthy();
    expect(screen.getByTestId('chart-points').textContent).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: 'Create chart preview' }));

    await waitFor(() =>
      expect(createEurostatChartProjection).toHaveBeenCalledWith(
        {
          datasetId: 'dataset-1',
          filters: { geo: 'DE', unit: 'PC_GDP' },
          xDimension: 'TIME_PERIOD',
          seriesDimension: null,
          valueField: 'OBS_VALUE',
        },
        'token'
      )
    );
    expect(screen.getByTestId('chart-points').textContent).toBe('1');
  });

  it('sets geo on the X-axis when comparing countries in one year', async () => {
    vi.mocked(loadEurostatDatasetDetails).mockResolvedValue(details);
    vi.mocked(createEurostatChartProjection).mockResolvedValue({
      projectionId: 'projection-country',
      points: [{ x: 'DE', value: 100, series: null }],
    });

    render(<ChartDialog />);

    act(() => {
      openChartDialog(eurostatElement);
    });

    await screen.findByText('Assign columns');
    fireEvent.click(screen.getByRole('button', { name: 'Compare countries in one year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create chart preview' }));

    await waitFor(() =>
      expect(createEurostatChartProjection).toHaveBeenCalledWith(
        {
          datasetId: 'dataset-1',
          filters: { unit: 'PC_GDP', TIME_PERIOD: '2020' },
          xDimension: 'geo',
          seriesDimension: null,
          valueField: 'OBS_VALUE',
        },
        'token'
      )
    );
  });

  it('sets TIME_PERIOD on the X-axis when showing a country time series', async () => {
    vi.mocked(loadEurostatDatasetDetails).mockResolvedValue(details);
    vi.mocked(createEurostatChartProjection).mockResolvedValue({
      projectionId: 'projection-time',
      points: [{ x: '2020', value: 100, series: null }],
    });

    render(<ChartDialog />);

    act(() => {
      openChartDialog(eurostatElement);
    });

    await screen.findByText('Assign columns');
    fireEvent.click(screen.getByRole('button', { name: 'Show time series for one country' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create chart preview' }));

    await waitFor(() =>
      expect(createEurostatChartProjection).toHaveBeenCalledWith(
        {
          datasetId: 'dataset-1',
          filters: { geo: 'DE', unit: 'PC_GDP' },
          xDimension: 'TIME_PERIOD',
          seriesDimension: null,
          valueField: 'OBS_VALUE',
        },
        'token'
      )
    );
  });
});
