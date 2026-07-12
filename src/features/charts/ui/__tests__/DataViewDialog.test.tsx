/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDataViewProjection,
  createProviderSnapshot,
  searchDatasetCatalog,
  uploadDataset,
} from '../../api/datasetClient';
import { ChartDatasetContextProvider } from '../../context/ChartDatasetContext';
import { ChartDialog, openDataViewDialog } from '../ChartDialog';

const editorMocks = vi.hoisted(() => ({
  findPath: vi.fn(() => [0]),
  focus: vi.fn(),
  insertNodes: vi.fn(),
  setNodes: vi.fn(),
}));

const dialogMocks = vi.hoisted(() => ({
  contentProps: {} as Record<string, unknown>,
}));

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({
    children,
    className,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => {
    dialogMocks.contentProps = props;
    return (
      <div data-slot="dialog-content" className={className}>
        {children}
      </div>
    );
  },
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('../../api/datasetClient', () => ({
  createDataViewProjection: vi.fn(),
  createDatasetProjection: vi.fn(),
  createProviderSnapshot: vi.fn(),
  loadDatasetColumnValues: vi.fn(),
  loadDatasetDetails: vi.fn(),
  searchDatasetCatalog: vi.fn(),
  uploadDataset: vi.fn(),
}));

vi.mock('../ChartRenderer', () => ({
  ChartRenderer: ({ points }: { points: unknown[] }) => (
    <div data-testid="chart-preview">{points.length}</div>
  ),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { access_token: 'token', user: { id: 'user-id' } } }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useCurrentUserActiveGroups: () => ({
    groups: [
      { id: 'group-id', name: 'Example group' },
      { id: 'research-group-id', name: 'Research group' },
    ],
    isLoading: false,
  }),
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

const labels: Record<string, string> = {
  'plateJs.dataView.insertTitle': 'Insert data',
  'plateJs.dataView.findDescription': 'Find a dataset',
  'plateJs.dataView.buildDescription': 'Build a view',
  'plateJs.dataView.searchLabel': 'Search datasets',
  'plateJs.dataView.searchPlaceholder': 'Search by topic',
  'plateJs.dataView.sources': 'Sources',
  'plateJs.dataView.ownData': 'Own data',
  'plateJs.dataView.addDataset': 'Add a dataset',
  'plateJs.dataView.or': 'Or',
  'plateJs.dataView.addOwnData': 'Add a dataset',
  'plateJs.dataView.uploadGroup': 'Group',
  'plateJs.dataView.selectUploadGroup': 'Select a group',
  'plateJs.dataView.selectUploadGroupDescription': 'Choose a group',
  'plateJs.dataView.noUploadGroups': 'No groups',
  'plateJs.dataView.uploadForGroup': 'Stored for the group',
  'plateJs.dataView.uploadFile': 'Upload file',
  'plateJs.dataView.enterData': 'Enter data',
  'plateJs.dataView.datasetTitle': 'Dataset title',
  'plateJs.dataView.datasetDescription': 'Description',
  'plateJs.dataView.chooseFile': 'Choose CSV or TSV',
  'plateJs.dataView.dropFile': 'Drag a CSV or TSV here',
  'plateJs.dataView.dropFileHere': 'Drop the file here',
  'plateJs.dataView.replaceFile': 'Replace file',
  'plateJs.dataView.removeFile': 'Remove file',
  'plateJs.dataView.fileLimit': 'CSV or TSV, up to 50 MiB',
  'plateJs.dataView.useOwnData': 'Use data',
  'plateJs.dataView.source': 'Source',
  'plateJs.dataView.chooseResult': 'Choose a result',
  'plateJs.dataView.backToResults': 'Back to results',
  'plateJs.dataView.searchHint': 'Search all sources',
  'plateJs.dataView.useDataset': 'Use dataset',
  'plateJs.dataView.changeDataset': 'Change dataset',
  'plateJs.dataView.chart': 'Chart',
  'plateJs.dataView.table': 'Table',
  'plateJs.dataView.stat': 'Metric',
  'plateJs.dataView.show': 'Show',
  'plateJs.dataView.measure': 'Measure',
  'plateJs.dataView.by': 'by',
  'plateJs.dataView.dimension': 'Dimension',
  'plateJs.dataView.filters': 'Filters',
  'plateJs.dataView.aggregation': 'Calculation',
  'plateJs.dataView.series': 'Series',
  'plateJs.dataView.noSeries': 'No series',
  'plateJs.dataView.chartType': 'Chart type',
  'plateJs.dataView.moreOptions': 'More options',
  'plateJs.dataView.preview': 'Preview',
  'plateJs.dataView.livePreview': 'Live',
  'plateJs.dataView.cancel': 'Cancel',
  'plateJs.dataView.insertChart': 'Insert chart',
  'plateJs.dataView.insertTable': 'Insert table',
  'plateJs.dataView.insertStat': 'Insert metric',
  'plateJs.dataView.visibleColumns': 'Visible columns',
  'plateJs.dataView.valueColumns': 'Value columns',
  'plateJs.dataView.multipleMeasures': 'Selected value columns',
  'plateJs.dataView.reset': 'Reset',
  'plateJs.dataView.rows': 'Rows',
  'plateJs.dataView.sortBy': 'Sort by',
  'plateJs.dataView.noSorting': 'No sorting',
  'plateJs.dataView.suggestion.gdp': 'GDP Germany',
  'plateJs.dataView.suggestion.population': 'Population',
  'plateJs.dataView.suggestion.unemployment': 'Unemployment',
  'plateJs.dataView.suggestion.inflation': 'Inflation',
  'plateJs.chart.bar': 'Bar',
  'plateJs.chart.line': 'Line',
  'plateJs.chart.area': 'Area',
  'plateJs.chart.pie': 'Pie',
};

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'en' },
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'plateJs.dataView.dataAsOf') return `Data as of ${options?.date}`;
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const profiles = [
  {
    name: 'Year',
    label: 'Year',
    type: 'date' as const,
    role: 'time' as const,
    nullCount: 0,
    distinctCount: 2,
  },
  {
    name: 'Value',
    label: 'Value',
    type: 'number' as const,
    role: 'measure' as const,
    nullCount: 0,
    distinctCount: 2,
  },
];

const multiMeasureProfiles = [
  profiles[0],
  {
    name: 'Unemployed (absolute)',
    label: 'Unemployed (absolute)',
    type: 'number' as const,
    role: 'measure' as const,
    nullCount: 0,
    distinctCount: 2,
  },
  {
    name: 'Unemployment rate',
    label: 'Unemployment rate',
    type: 'number' as const,
    role: 'measure' as const,
    nullCount: 0,
    distinctCount: 2,
  },
];

async function selectUploadGroup(name = 'Example group') {
  const trigger = screen.getByRole('combobox', { name: /Group/ });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  const option = await screen.findByRole('option', { name });
  fireEvent.click(option);
}

describe('DataViewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchDatasetCatalog).mockResolvedValue({
      results: [
        {
          id: 'govdata:package:resource',
          provider: 'GOVDATA',
          providerDatasetId: 'package',
          providerResourceId: 'resource',
          title: 'Employment in Germany',
          publisher: 'Statistical office',
          structureSummary: 'Annual values',
        },
      ],
      errors: [],
    });
    vi.mocked(createProviderSnapshot).mockResolvedValue({
      datasetId: 'dataset-id',
      snapshotId: 'snapshot-id',
      snapshotKey: 'snapshot-key',
      provider: 'GOVDATA',
      title: 'Employment in Germany',
      columns: ['Year', 'Value'],
      columnProfiles: profiles,
      rows: [],
      rowCount: 2,
      columnCount: 2,
      byteSize: 128,
      snapshotTakenAt: '2026-07-01T00:00:00.000Z',
    });
    vi.mocked(uploadDataset).mockResolvedValue({
      datasetId: 'upload-dataset-id',
      snapshotId: 'upload-snapshot-id',
      snapshotKey: 'upload-snapshot-key',
      provider: 'UPLOAD',
      title: 'Own figures',
      publisher: 'Example group',
      sourceUrl: null,
      columns: ['Year', 'Value'],
      columnProfiles: profiles,
      rows: [],
      rowCount: 1,
      columnCount: 2,
      byteSize: 32,
      snapshotTakenAt: '2026-07-10T12:00:00.000Z',
    });
    vi.mocked(createDataViewProjection).mockImplementation(async request =>
      request.view === 'table'
        ? {
            view: 'table',
            snapshotId: request.snapshotId,
            columns: request.columns ?? ['Year', 'Value'],
            rows: [
              Object.fromEntries(
                (request.columns ?? ['Year', 'Value']).map(column => [
                  column,
                  column === 'Year' ? '2025' : '42',
                ])
              ),
            ],
            rowCount: 1,
          }
        : request.view === 'stat'
          ? {
              view: 'stat',
              snapshotId: request.snapshotId,
              label: 'Value',
              value: 42,
              aggregation: request.aggregation,
              rowCount: 1,
            }
          : {
              view: 'chart',
              snapshotId: request.snapshotId,
              points: (request.valueColumns?.length
                ? request.valueColumns
                : [request.measureColumn ?? 'Value']
              ).map((column, index) => ({
                x: '2025',
                value: 42 + index,
                series: request.layout === 'multi' ? column : null,
              })),
              rowCount: 1,
            }
    );
  });

  afterEach(cleanup);

  it('keeps the finder simple and inserts raw-free chart, table, and metric blocks', async () => {
    render(
      <ChartDatasetContextProvider
        value={{
          defaultGroupId: 'group-id',
          defaultGroupName: 'Example group',
          canViewDatasets: true,
          canManageDatasets: false,
        }}
      >
        <ChartDialog />
      </ChartDatasetContextProvider>
    );
    act(() => openDataViewDialog());

    expect(screen.getByLabelText('Search datasets')).toBeTruthy();
    expect(screen.queryByText(/snapshot/i)).toBeNull();
    expect(screen.queryByText(/import/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a dataset' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    for (const eventName of ['onEscapeKeyDown', 'onPointerDownOutside', 'onInteractOutside']) {
      const preventDefault = vi.fn();
      const handler = dialogMocks.contentProps[eventName] as
        | ((event: { preventDefault: () => void }) => void)
        | undefined;
      handler?.({ preventDefault });
      expect(preventDefault).toHaveBeenCalledOnce();
    }

    fireEvent.change(screen.getByLabelText('Search datasets'), {
      target: { value: 'employment' },
    });
    await waitFor(() =>
      expect(searchDatasetCatalog).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'group-id' })
      )
    );
    fireEvent.click(await screen.findByTestId('dataset-result'));
    fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
    expect(screen.queryByRole('button', { name: 'Use dataset' })).toBeNull();
    fireEvent.click(screen.getByTestId('dataset-result'));
    fireEvent.click(screen.getByRole('button', { name: 'Use dataset' }));

    await waitFor(() => expect(createProviderSnapshot).toHaveBeenCalled());
    expect(await screen.findByRole('tab', { name: 'Chart' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('chart-preview').textContent).toBe('1'));

    fireEvent.click(screen.getByRole('button', { name: 'Insert chart' }));
    let inserted = editorMocks.insertNodes.mock.calls[0][0];
    expect(inserted).toMatchObject({ type: 'data_view', view: 'chart' });
    expect(inserted.points).toBeUndefined();
    expect(inserted.rows).toBeUndefined();
    expect(inserted.source.rows).toBeUndefined();

    act(() => openDataViewDialog());
    fireEvent.change(screen.getByLabelText('Search datasets'), {
      target: { value: 'employment' },
    });
    fireEvent.click(await screen.findByTestId('dataset-result'));
    fireEvent.click(screen.getByRole('button', { name: 'Use dataset' }));
    await screen.findByRole('tab', { name: 'Table' });
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    await waitFor(() =>
      expect(createDataViewProjection).toHaveBeenCalledWith(
        expect.objectContaining({ view: 'table' }),
        'token'
      )
    );
    const valueColumn = screen.getByRole('checkbox', { name: 'Value' });
    fireEvent.click(valueColumn);
    await waitFor(() =>
      expect(createDataViewProjection).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'table', columns: ['Year'] }),
        'token'
      )
    );
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'Value' })).toBeNull());

    fireEvent.click(valueColumn);
    await waitFor(() =>
      expect(createDataViewProjection).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'table', columns: ['Year', 'Value'] }),
        'token'
      )
    );
    expect(await screen.findByRole('columnheader', { name: 'Value' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Insert table' }));
    inserted = editorMocks.insertNodes.mock.calls[1][0];
    expect(inserted).toMatchObject({ type: 'data_view', view: 'table' });
    expect(inserted.rows).toBeUndefined();

    act(() => openDataViewDialog());
    fireEvent.change(screen.getByLabelText('Search datasets'), {
      target: { value: 'employment' },
    });
    fireEvent.click(await screen.findByTestId('dataset-result'));
    fireEvent.click(screen.getByRole('button', { name: 'Use dataset' }));
    await screen.findByRole('tab', { name: 'Metric' });
    fireEvent.click(screen.getByRole('tab', { name: 'Metric' }));
    await waitFor(() =>
      expect(createDataViewProjection).toHaveBeenCalledWith(
        expect.objectContaining({ view: 'stat' }),
        'token'
      )
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Insert metric' }));
    inserted = editorMocks.insertNodes.mock.calls[2][0];
    expect(inserted).toMatchObject({ type: 'data_view', view: 'stat' });
    expect(inserted.rows).toBeUndefined();
  }, 15_000);

  it('updates all selected chart value columns and sends them as separate series', async () => {
    vi.mocked(createProviderSnapshot).mockResolvedValue({
      datasetId: 'dataset-id',
      snapshotId: 'snapshot-id',
      snapshotKey: 'snapshot-key',
      provider: 'GOVDATA',
      title: 'Unemployment in Germany',
      columns: multiMeasureProfiles.map(profile => profile.name),
      columnProfiles: multiMeasureProfiles,
      rows: [],
      rowCount: 2,
      columnCount: 3,
      byteSize: 256,
      snapshotTakenAt: '2026-07-01T00:00:00.000Z',
    });

    render(
      <ChartDatasetContextProvider
        value={{
          defaultGroupId: 'group-id',
          defaultGroupName: 'Example group',
          canViewDatasets: true,
          canManageDatasets: false,
        }}
      >
        <ChartDialog />
      </ChartDatasetContextProvider>
    );
    act(() => openDataViewDialog());
    fireEvent.change(screen.getByLabelText('Search datasets'), {
      target: { value: 'unemployment' },
    });
    fireEvent.click(await screen.findByTestId('dataset-result'));
    fireEvent.click(screen.getByRole('button', { name: 'Use dataset' }));

    await waitFor(() =>
      expect(createDataViewProjection).toHaveBeenLastCalledWith(
        expect.objectContaining({
          view: 'chart',
          layout: 'multi',
          dimensionColumn: 'Year',
          valueColumns: ['Unemployed (absolute)', 'Unemployment rate'],
        }),
        'token'
      )
    );
    await waitFor(() => expect(screen.getByTestId('chart-preview').textContent).toBe('2'));

    const absoluteColumn = screen.getByRole('checkbox', { name: 'Unemployed (absolute)' });
    fireEvent.click(absoluteColumn);
    await waitFor(() =>
      expect(createDataViewProjection).toHaveBeenLastCalledWith(
        expect.objectContaining({
          layout: 'multi',
          valueColumns: ['Unemployment rate'],
        }),
        'token'
      )
    );
    await waitFor(() => expect(screen.getByTestId('chart-preview').textContent).toBe('1'));

    fireEvent.click(absoluteColumn);
    await waitFor(() =>
      expect(createDataViewProjection).toHaveBeenLastCalledWith(
        expect.objectContaining({
          layout: 'multi',
          valueColumns: ['Unemployed (absolute)', 'Unemployment rate'],
        }),
        'token'
      )
    );
    await waitFor(() => expect(screen.getByTestId('chart-preview').textContent).toBe('2'));
  });

  it('uploads own CSV data and opens it directly in the builder', async () => {
    render(
      <ChartDatasetContextProvider
        value={{
          defaultGroupId: 'group-id',
          defaultGroupName: 'Example group',
          canViewDatasets: true,
          canManageDatasets: false,
          canUploadDatasets: true,
        }}
      >
        <ChartDialog />
      </ChartDatasetContextProvider>
    );
    act(() => openDataViewDialog());
    fireEvent.click(screen.getByRole('button', { name: 'Add a dataset' }));

    expect(await screen.findByRole('heading', { name: 'Add a dataset' })).toBeTruthy();
    await selectUploadGroup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['Year,Value\n2025,42'], 'own-figures.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    expect((screen.getByLabelText('Dataset title') as HTMLInputElement).value).toBe('own-figures');

    fireEvent.click(screen.getByRole('button', { name: 'Use data' }));
    await waitFor(() =>
      expect(uploadDataset).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          groupId: 'group-id',
          title: 'own-figures',
        }),
        'token'
      )
    );
    expect(await screen.findByRole('tab', { name: 'Chart' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('chart-preview')).toBeTruthy());
    expect(screen.getByTestId('data-view-attribution').textContent).toContain('Example group');

    fireEvent.click(screen.getByRole('button', { name: 'Insert chart' }));
    const inserted = editorMocks.insertNodes.mock.calls[0][0];
    expect(inserted.source).toMatchObject({
      provider: 'UPLOAD',
      publisher: 'Example group',
      sourceUrl: null,
      snapshotTakenAt: '2026-07-10T12:00:00.000Z',
    });
    expect(inserted.rows).toBeUndefined();
    expect(inserted.points).toBeUndefined();
  });

  it('saves a manually entered table as a group snapshot', async () => {
    render(
      <ChartDatasetContextProvider
        value={{
          defaultGroupId: 'group-id',
          defaultGroupName: 'Example group',
          canViewDatasets: true,
          canManageDatasets: false,
          canUploadDatasets: true,
        }}
      >
        <ChartDialog />
      </ChartDatasetContextProvider>
    );
    act(() => openDataViewDialog());
    fireEvent.click(screen.getByRole('button', { name: 'Add a dataset' }));
    await selectUploadGroup('Research group');
    fireEvent.click(await screen.findByRole('tab', { name: 'Enter data' }));
    fireEvent.change(screen.getByLabelText(/Dataset title/), {
      target: { value: 'Manual figures' },
    });

    await waitFor(() => expect(document.querySelector('table')).toBeTruthy());
    const table = document.querySelector('table') as HTMLTableElement;
    const dataInputs = Array.from(table.querySelectorAll('tbody input'));
    fireEvent.change(dataInputs[0], { target: { value: '2025' } });
    fireEvent.change(dataInputs[1], { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use data' }));

    await waitFor(() => expect(uploadDataset).toHaveBeenCalled());
    const request = vi.mocked(uploadDataset).mock.calls[0][0];
    expect(request).toMatchObject({
      groupId: 'research-group-id',
      title: 'Manual figures',
    });
    expect(request.file).toMatchObject({ name: 'Manual figures.csv', type: 'text/csv' });
    expect(await screen.findByRole('tab', { name: 'Chart' })).toBeTruthy();
  });
});
