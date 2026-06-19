/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importGovDataCsvResource, searchGovDataDatasets } from '../../api/govdataClient';
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
  DialogContent: ({
    children,
    className,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
    <div {...props} data-slot="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [undefined, { type: 'complete' }],
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    eurostat: {
      datasetById: (args: unknown) => ({ type: 'datasetById', args }),
      observationPreview: (args: unknown) => ({ type: 'observationPreview', args }),
    },
  },
}));

vi.mock('../../api/govdataClient', () => ({
  importGovDataCsvResource: vi.fn(),
  searchGovDataDatasets: vi.fn(),
}));

vi.mock('../../api/eurostatClient', () => ({
  continueEurostatImport: vi.fn(),
  createEurostatChartProjection: vi.fn(),
  loadEurostatDatasetDetails: vi.fn(),
  searchEurostatDatasets: vi.fn(() => Promise.resolve([])),
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

      if (key === 'plateJs.chart.govDataImportedSummary') {
        return `${fallbackOrOptions?.rows} rows · ${fallbackOrOptions?.columns} columns imported`;
      }
      if (key === 'plateJs.chart.csvResources') {
        return `${fallbackOrOptions?.count} CSV resources`;
      }

      const labels: Record<string, string> = {
        'plateJs.chart.bar': 'Bar',
        'plateJs.chart.cancel': 'Cancel',
        'plateJs.chart.category': 'Category / X',
        'plateJs.chart.chartType': 'Chart type',
        'plateJs.chart.dataTable': 'Data table',
        'plateJs.chart.description': 'Add chart data',
        'plateJs.chart.descriptionLabel': 'Description',
        'plateJs.chart.donut': 'Donut',
        'plateJs.chart.eurostatSource': 'Eurostat',
        'plateJs.chart.csvSource': 'CSV',
        'plateJs.chart.govDataDataset': 'GovData dataset',
        'plateJs.chart.govDataDatasetPlaceholder': 'Search GovData',
        'plateJs.chart.govDataImportHint': 'Import the selected CSV resource.',
        'plateJs.chart.govDataPreviewReady': 'GovData preview ready',
        'plateJs.chart.govDataResource': 'CSV resource',
        'plateJs.chart.govDataSearchHint': 'Search GovData',
        'plateJs.chart.govDataSource': 'GovData',
        'plateJs.chart.officialDataSource': 'Official data source',
        'plateJs.chart.officialSearch': 'Search official data',
        'plateJs.chart.officialSearchPlaceholder': 'Search official data',
        'plateJs.chart.officialSettingsHint': 'Select official data',
        'plateJs.chart.providerFilter': 'Provider filter',
        'plateJs.chart.providerFilterPlaceholder': 'Search providers',
        'plateJs.chart.tableOrientation': 'Table orientation',
        'plateJs.chart.orientationColumnMapping': 'Column mapping',
        'plateJs.chart.orientationColumnsAsXAxis': 'Columns on X-axis',
        'plateJs.chart.orientationRowsAsXAxis': 'Rows on X-axis',
        'plateJs.chart.grid': 'Grid',
        'plateJs.chart.hoverValues': 'Show values on hover',
        'plateJs.chart.importResource': 'Import resource',
        'plateJs.chart.insert': 'Insert chart',
        'plateJs.chart.insertTitle': 'Insert chart',
        'plateJs.chart.legend': 'Legend',
        'plateJs.chart.manualSource': 'CSV / manual',
        'plateJs.chart.none': 'None',
        'plateJs.chart.numericValue': 'Numeric value',
        'plateJs.chart.preview': 'Preview',
        'plateJs.chart.series': 'Series',
        'plateJs.chart.snapshotReady': 'Snapshot ready',
        'plateJs.chart.title': 'Title',
        'plateJs.chart.xAxisLabel': 'X-axis label',
        'plateJs.chart.yAxisLabel': 'Y-axis label',
      };

      return labels[key] ?? key;
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

function expectFullscreenChartDialog() {
  const dialogContent = document.querySelector('[data-slot="dialog-content"]');
  if (!dialogContent) {
    throw new Error('Expected chart dialog content to be rendered');
  }

  const dialogClasses = Array.from(dialogContent.classList);
  expect(dialogClasses).toContain('h-dvh');
  expect(dialogClasses).toContain('w-screen');
  expect(dialogClasses).toContain('max-w-none');
  expect(dialogClasses).toContain('rounded-none');
  expect(dialogClasses).toContain('border-0');
  expect(dialogClasses).toContain('p-0');
  expect(dialogClasses).toContain('shadow-none');
}

describe('ChartDialog GovData flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('searches GovData, imports a CSV resource, previews it, and inserts a chart', async () => {
    vi.mocked(searchGovDataDatasets).mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'arbeitslosigkeit',
        title: 'Arbeitslosigkeit',
        publisher: 'Statistisches Amt',
        organizationTitle: 'Open Data BW',
        modified: '2026-01-01T00:00:00Z',
        resources: [
          {
            id: 'res-1',
            name: 'Zeitreihe',
            format: 'CSV',
            mimetype: 'text/csv',
            size: 128,
            modified: '2026-01-01T00:00:00Z',
            url: 'https://example.com/data.csv',
          },
        ],
      },
    ]);
    vi.mocked(importGovDataCsvResource).mockResolvedValue({
      snapshotKey: 'snapshot-1',
      columns: ['Jahr', 'Wert'],
      rows: [
        { Jahr: '2024', Wert: '42' },
        { Jahr: '2025', Wert: '51' },
      ],
      provenance: {
        packageId: 'pkg-1',
        packageName: 'arbeitslosigkeit',
        packageTitle: 'Arbeitslosigkeit',
        resourceId: 'res-1',
        resourceName: 'Zeitreihe',
        resourceUrl: 'https://example.com/data.csv',
        publisher: 'Statistisches Amt',
        organizationTitle: 'Open Data BW',
        modified: '2026-01-01T00:00:00Z',
        resourceModified: '2026-01-01T00:00:00Z',
        licenseTitle: 'DL-DE BY 2.0',
        importedAt: '2026-06-16T00:00:00.000Z',
      },
    });

    render(<ChartDialog />);

    act(() => {
      openChartDialog();
    });

    expectFullscreenChartDialog();
    fireEvent.click(screen.getByRole('tab', { name: 'Official data source' }));
    expect(screen.getByText('Select official data')).toBeTruthy();
    expect(screen.queryByTestId('chart-points')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search official data'), {
      target: { value: 'arbeitslosigkeit' },
    });

    await waitFor(() => expect(searchGovDataDatasets).toHaveBeenCalledWith('arbeitslosigkeit'));
    fireEvent.click(await screen.findByRole('button', { name: /Arbeitslosigkeit/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import resource' }));

    await waitFor(() =>
      expect(importGovDataCsvResource).toHaveBeenCalledWith(
        { packageId: 'pkg-1', resourceId: 'res-1' },
        'token'
      )
    );
    expect(await screen.findByText('2 rows · 2 columns imported')).toBeTruthy();
    expect(screen.getByTestId('chart-points').textContent).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: 'Insert chart' }));

    await waitFor(() => expect(editorMocks.insertNodes).toHaveBeenCalled());
    const insertedNode = editorMocks.insertNodes.mock.calls[0][0];
    expect(insertedNode.source).toMatchObject({
      kind: 'govdata',
      packageId: 'pkg-1',
      resourceId: 'res-1',
      snapshotKey: 'snapshot-1',
    });
    expect(insertedNode.points).toHaveLength(2);
  });
});
