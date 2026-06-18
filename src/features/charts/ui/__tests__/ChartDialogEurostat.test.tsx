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

const editorMocks = vi.hoisted(() => ({
  findPath: vi.fn(() => [0]),
  focus: vi.fn(),
  insertNodes: vi.fn(),
  setNodes: vi.fn(),
}));

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
    api: { findPath: editorMocks.findPath },
    tf: {
      focus: editorMocks.focus,
      insertNodes: editorMocks.insertNodes,
      setNodes: editorMocks.setNodes,
    },
  }),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'en' },
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;

      if (key === 'plateJs.chart.editableTableSummary') {
        return `${fallbackOrOptions?.rows} rows · ${fallbackOrOptions?.columns} columns editable`;
      }

      const labels: Record<string, string> = {
        'plateJs.chart.assignColumns': 'Assign columns',
        'plateJs.chart.bar': 'Bar',
        'plateJs.chart.buildEditableTable': 'Build editable table',
        'plateJs.chart.buildEditableTableFirst': 'Build editable table first',
        'plateJs.chart.cancel': 'Cancel',
        'plateJs.chart.category': 'Category / X',
        'plateJs.chart.chartType': 'Chart type',
        'plateJs.chart.compareCountriesInYear': 'Compare countries in one year',
        'plateJs.chart.createChartPreview': 'Create chart preview',
        'plateJs.chart.csvSource': 'CSV',
        'plateJs.chart.dataTable': 'Data table',
        'plateJs.chart.descriptionLabel': 'Description',
        'plateJs.chart.donut': 'Donut',
        'plateJs.chart.editableTableNeeded': 'Build an editable table',
        'plateJs.chart.editableTableReady': 'Editable table ready',
        'plateJs.chart.editTitle': 'Edit chart',
        'plateJs.chart.eurostatSource': 'Eurostat',
        'plateJs.chart.filtersComplete': 'Filters complete',
        'plateJs.chart.firstRows': 'First 5 downloaded rows',
        'plateJs.chart.grid': 'Grid',
        'plateJs.chart.hoverValues': 'Show values on hover',
        'plateJs.chart.legend': 'Legend',
        'plateJs.chart.none': 'None',
        'plateJs.chart.numericValue': 'Numeric value',
        'plateJs.chart.officialDataSource': 'Official data source',
        'plateJs.chart.officialSettingsHint': 'Select official data',
        'plateJs.chart.orientationColumnMapping': 'Column mapping',
        'plateJs.chart.orientationColumnsAsXAxis': 'Columns on X-axis',
        'plateJs.chart.orientationRowsAsXAxis': 'Rows on X-axis',
        'plateJs.chart.preview': 'Preview',
        'plateJs.chart.rebuildEditableTable': 'Rebuild editable table',
        'plateJs.chart.series': 'Series',
        'plateJs.chart.showTimeSeriesForCountry': 'Show time series for one country',
        'plateJs.chart.tableOrientation': 'Table orientation',
        'plateJs.chart.title': 'Title',
        'plateJs.chart.update': 'Update chart',
        'plateJs.chart.xAxisLabel': 'X-axis label',
        'plateJs.chart.yAxisLabel': 'Y-axis label',
        'plateJs.chart.yValue': 'Y-axis / value',
      };

      return labels[key] ?? key;
    },
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
  points: [{ x: '2019', value: 90, series: null }],
  children: [{ text: '' }],
};

describe('ChartDialog Eurostat flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads an existing Eurostat chart as an editable table and saves edited values', async () => {
    vi.mocked(loadEurostatDatasetDetails).mockResolvedValue(details);

    render(<ChartDialog />);

    act(() => {
      openChartDialog(eurostatElement);
    });

    await waitFor(() => expect(loadEurostatDatasetDetails).toHaveBeenCalledWith('DEMO', 'en'));
    expect(await screen.findByText('Data table')).toBeTruthy();
    expect(screen.getByDisplayValue('2019')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('90'), { target: { value: '123' } });
    expect(screen.getByText('Filters complete')).toBeTruthy();
    expect(screen.getByText('Y-axis / value')).toBeTruthy();
    expect(screen.getAllByText('OBS_VALUE').length).toBeGreaterThan(0);
    expect(screen.getByText('Show values on hover')).toBeTruthy();
    expect(screen.getByTestId('chart-points').textContent).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Update chart' }));

    await waitFor(() => expect(editorMocks.setNodes).toHaveBeenCalled());
    const updatedNode = editorMocks.setNodes.mock.calls[0][0];
    expect(updatedNode.source).toMatchObject({
      kind: 'eurostat',
      datasetId: 'dataset-1',
      datasetCode: 'DEMO',
      snapshotKey: 'snap-demo',
      projectionId: 'projection-old',
      columns: ['TIME_PERIOD', 'OBS_VALUE'],
      rows: [{ TIME_PERIOD: '2019', OBS_VALUE: '123' }],
    });
    expect(updatedNode.points).toEqual([{ x: '2019', value: 123, series: null }]);
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
    fireEvent.click(screen.getByRole('button', { name: 'Build editable table' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Build editable table' }));

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
