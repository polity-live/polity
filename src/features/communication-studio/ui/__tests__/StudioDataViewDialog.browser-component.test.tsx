import { StrictMode, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { StudioDataViewDialog } from '../StudioDataViewDialog';
import { StudioLiveTools } from '../StudioLiveTools';
import { Toolbar } from '@/features/shared/ui/layout';
import KonvaStudioCanvas from '../KonvaStudioCanvas';
import Konva from 'konva';
import { createFrameNode, createStudioDocumentV5 } from '../../logic/document-v3';
import { insertStudioDataView } from '../../logic/data-view-import';
import { configuration, projection } from '@/test/studio-data-view.fixture';
import {
  createProviderSnapshot,
  searchDatasetCatalog,
  loadDatasetPreview,
  prepareDatasetRawDownload,
} from '@/features/charts/api/datasetClient';
import {
  interpretDatasetSearch,
  rankDatasetSearchResults,
} from '@/features/charts/logic/datasetSearch';
import type {
  DataViewProjection,
  DatasetSnapshotImportResult,
  DatasetSearchResult,
  DatasetProviderSearchResponse,
  DatasetSearchFilters,
  DatasetPreparation,
} from '@/features/charts/types';
import '@/font-faces.css';
import '@/styles.css';

const pendingLoads = vi.hoisted(() => ({
  accessToken: 'token',
  preparation: null as DatasetPreparation | null,
  snapshot: null as Promise<DatasetSnapshotImportResult> | null,
  projection: null as Promise<DataViewProjection> | null,
  catalog: null as Promise<DatasetProviderSearchResponse> | null,
  results: null as DatasetSearchResult[] | null,
  errors: [] as DatasetProviderSearchResponse['errors'],
  details: null as any,
  sample: null as any,
}));

vi.mock('@/providers/auth-provider', async importOriginal => ({
  ...(await importOriginal<typeof import('@/providers/auth-provider')>()),
  useAuth: () => ({ session: { access_token: pendingLoads.accessToken, user: { id: 'user' } } }),
}));
vi.mock('@/zero/observed-query', async importOriginal => ({
  ...(await importOriginal<typeof import('@/zero/observed-query')>()),
  useQuery: () => [[{ owner_id: 'user' }]],
}));
vi.mock('@/zero/groups/useGroupState', async importOriginal => ({
  ...(await importOriginal<typeof import('@/zero/groups/useGroupState')>()),
  useCurrentUserActiveGroups: () => ({
    groups: [{ id: 'group', name: 'Group' }],
    isLoading: false,
  }),
}));
vi.mock('@/features/charts/api/datasetClient', () => ({
  prepareDatasetRawDownload: vi.fn(),
  loadDatasetPreview: vi.fn(async request => ({
    identity: request,
    columns: [
      { name: 'Year', label: 'Year', type: 'date', role: 'time', nullCount: 0, distinctCount: 3 },
      {
        name: 'People',
        label: 'People',
        type: 'number',
        role: 'measure',
        nullCount: 0,
        distinctCount: 3,
      },
      {
        name: 'Region',
        label: 'Region',
        type: 'category',
        role: 'dimension',
        nullCount: 0,
        distinctCount: 1,
      },
    ],
    rows: [{ Year: '2025', People: '1', Region: 'DE' }],
    rowFilters: request.rowFilters ?? {},
    appliedFilters: request.filters ?? {},
    sampled: false,
    sampledRowCount: 1,
    ...(request.page ? { page: { ...request.page, total: 1, nextOffset: null } } : {}),
    ...pendingLoads.sample,
  })),
  prepareProviderDataset: async (request: { provider: string; code: string }) =>
    pendingLoads.preparation ?? {
      provider: request.provider,
      code: request.code,
      title: 'Population',
      dimensions: [],
      estimatedBytes: 100,
      importAllowed: true,
      suggestedFilters: {},
    },
  searchDatasetCatalog: vi.fn(
    async ({ query, filters }: { query: string; filters?: DatasetSearchFilters }) =>
      pendingLoads.catalog ?? {
        results: pendingLoads.results
          ? rankDatasetSearchResults(pendingLoads.results, interpretDatasetSearch(query, filters))
          : [
              {
                id: 'dataset',
                provider: 'EUROSTAT',
                title: 'Population',
                providerDatasetId: 'population',
                publisher: 'Eurostat',
                sourceUrl: 'https://example.org/data',
              },
            ],
        errors: pendingLoads.errors,
      }
  ),
  createProviderSnapshot: async (request: { code: string }) =>
    pendingLoads.snapshot ?? {
      datasetId: 'dataset',
      snapshotId: 'snapshot',
      provider: 'EUROSTAT',
      providerDatasetId: request.code,
      title: 'Population',
      snapshotTakenAt: '2026-10-11T00:00:00Z',
      rows: [],
      rowCount: 3,
      columnCount: 3,
      columns: ['Year', 'People', 'Region'],
      columnProfiles: [
        { name: 'Year', label: 'Year', type: 'date', role: 'time', nullCount: 0, distinctCount: 3 },
        {
          name: 'People',
          label: 'People',
          type: 'number',
          role: 'measure',
          nullCount: 0,
          distinctCount: 3,
        },
        {
          name: 'Region',
          label: 'Region',
          type: 'category',
          role: 'dimension',
          nullCount: 0,
          distinctCount: 2,
        },
      ],
    },
  createDataViewProjection: async () => pendingLoads.projection ?? projection,
  loadDatasetColumnValues: async () => [],
  loadDatasetDetails: async (id: string, _token: string, snapshotId: string) =>
    pendingLoads.details ?? { id, provider: 'EUROSTAT', snapshotId, columnProfiles: [] },
  uploadDataset: async () => {
    throw new Error('upload failed');
  },
}));

function Harness({
  disabled = false,
  fromToolbar = false,
  withInspector = false,
}: {
  disabled?: boolean;
  fromToolbar?: boolean;
  withInspector?: boolean;
}) {
  const [open, setOpen] = useState(!fromToolbar);
  const [document, setDocument] = useState(() => {
    const d = createStudioDocumentV5('Population');
    d.nodes.push(createFrameNode('widescreen'));
    return d;
  });
  const [selected, setSelected] = useState<string[]>(withInspector ? [document.nodes[0].id] : []);
  const frameId = document.nodes[0].id;
  return (
    <div className="bg-background min-h-screen p-4">
      {fromToolbar && (
        <Toolbar>
          <StudioLiveTools
            document={document}
            frameId={frameId}
            sources={[]}
            assets={[]}
            update={() => undefined}
            portrait={false}
            setPortrait={() => undefined}
            disabled={disabled}
            onInsertData={() => setOpen(true)}
          />
        </Toolbar>
      )}
      <p data-testid="count">{document.nodes.length}</p>
      <div style={{ width: '100%', height: 640 }}>
        <KonvaStudioCanvas
          document={document}
          activeFrameId={frameId}
          selected={selected}
          assets={[]}
          editable={!disabled}
          fit="contain"
          guides={false}
          inspector={withInspector ? <button>Inspector control</button> : undefined}
          contextToolbar={withInspector ? <button>Canvas control</button> : undefined}
        />
      </div>
      {open && (
        <StudioDataViewDialog
          open={open}
          onOpenChange={setOpen}
          disabled={disabled}
          groupId={null}
          userId="user"
          onInsert={(config, result) => {
            const next = structuredClone(document);
            setSelected(insertStudioDataView(next, frameId, config, result, 'en'));
            setDocument(next);
          }}
        />
      )}
    </div>
  );
}

async function chooseDataset() {
  await userEvent.click(screen.getByRole('button', { name: 'Use dataset' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  await userEvent.click(screen.getByRole('button', { name: 'Apply selection' }));
}

async function build() {
  await userEvent.fill(screen.getByRole('textbox', { name: 'Search datasets' }), 'Population');
  await userEvent.click(await screen.findByText('Population'));
  await chooseDataset();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Insert chart' })).toBeEnabled());
}
it('returns from full-screen exploration to the same Studio dataset without inserting or changing it', async () => {
  render(<Harness />);
  await build();
  const count = screen.getByTestId('count').textContent;
  await userEvent.click(screen.getByRole('button', { name: 'Explore dataset in full screen' }));
  await screen.findByRole('heading', { name: 'Explore and select data' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Insert chart' })).toBeEnabled());
  expect(screen.getByRole('combobox', { name: 'Measure' })).toHaveTextContent('People');
  expect(screen.getByTestId('count').textContent).toBe(count);
});

it.each([1280, 390])(
  'reopens the precise monthly snapshot in Strict Mode at width %s with filtered sample rows',
  async width => {
    await page.viewport(width, 900);
    const config = configuration('line');
    config.source.provider = 'GENESIS_DESTATIS';
    config.source.providerDatasetId = '13211-0002';
    config.query = {
      filters: { DINSGF: '__total__:DINSGF', value_variable_code: 'ERW006', value_unit: 'Anzahl' },
      aggregation: 'none',
      dimensionColumn: 'observation_period',
      measureColumn: 'value',
      timeRange: { column: 'observation_period', startYear: 2025, endYear: 2025 },
    };
    const columns = [
      {
        name: 'observation_period',
        label: 'Zeitraum',
        type: 'date',
        role: 'time',
        nullCount: 0,
        distinctCount: 12,
      },
      {
        name: 'value',
        label: 'Wert',
        type: 'number',
        role: 'measure',
        nullCount: 0,
        distinctCount: 12,
      },
      {
        name: 'time_code',
        label: 'time_code',
        type: 'category',
        role: 'label',
        nullCount: 0,
        distinctCount: 1,
        technical: true,
      },
    ];
    pendingLoads.details = {
      id: 'dataset',
      provider: 'GENESIS_DESTATIS',
      providerDatasetId: '13211-0002',
      snapshotId: 'snapshot',
      columnProfiles: columns,
      metadata: {
        measureOptions: [
          { id: 'count', label: 'Arbeitslose', unit: 'Anzahl', filters: config.query.filters },
          {
            id: 'rate',
            label: 'Arbeitslosenquote',
            unit: 'Prozent',
            filters: { value_variable_code: 'ERW112', value_unit: 'Prozent' },
          },
        ],
      },
    };
    pendingLoads.sample = {
      columns,
      rows: Array.from({ length: 5 }, (_, index) => ({
        observation_period: `2025-0${index + 1}`,
        value: String(2900000 + index),
        time_code: 'JAHR',
      })),
      rowFilters: config.query.filters,
      timeRange: config.query.timeRange,
      sampled: false,
      sampledRowCount: 12,
    };
    pendingLoads.projection = Promise.resolve({
      view: 'chart',
      snapshotId: 'snapshot',
      rowCount: 12,
      points: Array.from({ length: 12 }, (_, index) => ({
        x: `2025-${String(index + 1).padStart(2, '0')}`,
        value: 2900000 + index,
        series: 'Arbeitslose · Anzahl',
      })),
    });
    const insert = vi.fn();
    render(
      <StrictMode>
        <StudioDataViewDialog
          open
          onOpenChange={vi.fn()}
          disabled={false}
          groupId={null}
          userId="user"
          editingElement={config}
          onInsert={insert}
        />
      </StrictMode>
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Update data view' })).toBeEnabled()
    );
    expect(screen.getByRole('combobox', { name: 'Measure and unit' })).toHaveTextContent(
      'Arbeitslose · Anzahl'
    );

    const header = screen.getByTestId('compact-data-header');
    expect(header.getBoundingClientRect().height).toBeLessThanOrEqual(90);
    expect(
      screen.getByTestId('compact-data-header-primary').getBoundingClientRect().height
    ).toBeCloseTo(32, 0);
    expect(
      screen.getByTestId('compact-data-header-secondary').getBoundingClientRect().height
    ).toBeCloseTo(24, 0);
    await userEvent.click(screen.getByRole('button', { name: 'Dataset information' }));
    expect(document.querySelector('[data-slot=popover-content]')).toHaveTextContent(
      'Choose what the data should show and review the live preview.'
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(7));
    expect(screen.getByText('2025-03')).toBeVisible();
    const series = screen.queryByRole('combobox', { name: 'Series' });
    if (series) expect(series).not.toHaveTextContent('time_code');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show technical columns' }));
    expect(screen.getByRole('columnheader', { name: 'time_code' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Update data view' }));
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          providerDatasetId: '13211-0002',
          snapshotId: 'snapshot',
        }),
        query: config.query,
      }),
      expect.objectContaining({
        points: expect.arrayContaining([expect.objectContaining({ x: '2025-12' })]),
      })
    );
  }
);

it('preserves the active dataset and filters when the account token refreshes', async () => {
  const { rerender } = render(<Harness />);
  await build();
  expect(screen.getByRole('button', { name: 'Insert chart' })).toBeEnabled();
  pendingLoads.accessToken = 'refreshed-token';
  rerender(<Harness />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Insert chart' })).toBeEnabled());
  expect(screen.getByRole('combobox', { name: 'Measure' })).toHaveTextContent('People');
  expect(screen.queryByRole('textbox', { name: 'Search datasets' })).not.toBeInTheDocument();
});

it.each([1280, 390])(
  'offers import scope at width %s and inserts after confirmation',
  async width => {
    await page.viewport(width, 900);
    pendingLoads.preparation = {
      provider: 'EUROSTAT',
      code: 'population',
      title: 'Population',
      dimensions: [
        { id: 'geo', label: 'Area', position: 1, values: [{ id: 'DE', label: 'Germany' }] },
        { id: 'TIME_PERIOD', label: 'Time', position: 2, values: [{ id: '2024' }, { id: '2025' }] },
      ],
      geoDimension: 'geo',
      timeDimension: 'TIME_PERIOD',
      estimatedBytes: 30 * 1024 * 1024,
      importAllowed: true,
      suggestedFilters: {},
    };
    render(<Harness />);
    await userEvent.fill(
      screen.getByRole('textbox', { name: 'Search datasets' }),
      'Population 2025 Deutschland'
    );
    await userEvent.click(await screen.findByText('Population'));
    await userEvent.click(screen.getByRole('button', { name: 'Narrow the import' }));
    await screen.findByRole('button', { name: 'Load selection' });
    expect(screen.getByRole('combobox', { name: /^Area$/ })).toHaveValue('Deutschland');
    expect(screen.getByRole('spinbutton', { name: 'From year' })).toHaveValue(2025);
    expect(screen.queryByRole('button', { name: 'Insert chart' })).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(width);
    await userEvent.fill(screen.getByRole('spinbutton', { name: 'From year' }), '2024');
    await userEvent.click(screen.getByRole('button', { name: 'Load selection' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insert chart' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Insert chart' }));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('4'));
  }
);
afterEach(async () => {
  pendingLoads.accessToken = 'token';
  pendingLoads.preparation = null;
  pendingLoads.snapshot = null;
  pendingLoads.projection = null;
  pendingLoads.catalog = null;
  pendingLoads.results = null;
  pendingLoads.errors = [];
  pendingLoads.details = null;
  pendingLoads.sample = null;
  vi.mocked(searchDatasetCatalog).mockClear();
  await page.viewport(1280, 900);
});

const searchFixtures: DatasetSearchResult[] = [
  {
    id: 'national',
    provider: 'EUROSTAT',
    providerDatasetId: 'unemployed',
    title: 'Arbeitslose Deutschland',
    description: '#Inhalt: Bundesweite Arbeitslosenzahlen',
    publisher: 'Statistisches Amt',
    spatialCoverage: ['Deutschland'],
    timeCoverage: { start: '2023', end: '2025' },
  },
  {
    id: 'local',
    provider: 'GOVDATA',
    providerDatasetId: 'local',
    providerResourceId: 'csv',
    title: '2023-2025_Arbeitslose_Gesamt_RE',
    description:
      '#Inhalt: Zahlen für Recklinghausen gesamt\n##Datenstand: 31.12.2023, 31.12.2024, 31.12.2025',
    publisher: 'Recklinghausen',
  },
  ...Array.from({ length: 10 }, (_, i): DatasetSearchResult => ({
    id: `unknown-${i}`,
    provider: 'UPLOAD',
    title: `Arbeitslose Kommune ${i}`,
    description: 'Regionale Arbeitslosenzahlen',
  })),
];

it.each([
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
])(
  'interprets, edits and removes filters and retains navigation before insertion on $name',
  async ({ width, height, name }) => {
    pendingLoads.results = searchFixtures;
    await page.viewport(width, height);
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Search datasets' });
    await userEvent.fill(input, 'Arbeitslose 2025 Deutschland');
    expect(screen.getByRole('button', { name: 'Area: Deutschland' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Data period: 2025' })).toBeVisible();
    await waitFor(() => expect(screen.getAllByTestId('dataset-result')).toHaveLength(1));
    expect(screen.getByText(/Period includes 2025/)).toBeVisible();
    expect(screen.getByText('Inhalt: Bundesweite Arbeitslosenzahlen')).toBeVisible();
    await page.screenshot({
      path: `../../../../../output/playwright/dataset-search-matching-${name}.png`,
    });
    const more = screen.getByRole('button', { name: /Other results/ });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    more.focus();
    await userEvent.keyboard('{Enter}');
    expect(more.getAttribute('aria-expanded')).toBe('true');
    const local = screen.getByText('2023-2025 Arbeitslose Gesamt RE');
    expect(local).toBeVisible();
    // Find the actual scroll container, retained in the DOM when mobile details open.
    const scrollContainer = screen.getAllByTestId('dataset-result')[0].closest('.overflow-y-auto')!;
    local.scrollIntoView({ block: 'center' });
    const previousScroll = scrollContainer.scrollTop;
    await userEvent.click(local);
    if (name === 'mobile') {
      await userEvent.click(screen.getByRole('button', { name: 'Back to results' }));
      expect(scrollContainer.scrollTop).toBe(previousScroll);
      expect(input).toHaveValue('Arbeitslose 2025 Deutschland');
    }
    await page.screenshot({ path: `../../../../../output/playwright/dataset-search-${name}.png` });
    await userEvent.click(screen.getByRole('button', { name: 'Area: Deutschland' }));
    await userEvent.fill(screen.getByRole('textbox', { name: 'Area' }), 'Recklinghausen');
    await userEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
    await waitFor(() => expect(screen.getAllByTestId('dataset-result')).toHaveLength(1));
    expect(screen.getByText('2023-2025 Arbeitslose Gesamt RE')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Data period: 2025' }));
    await userEvent.fill(screen.getByRole('spinbutton', { name: 'From year' }), '2024');
    await userEvent.fill(screen.getByRole('spinbutton', { name: 'To year' }), '2024');
    await userEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
    await screen.findByText(/Period includes 2024/);
    await userEvent.click(screen.getByRole('button', { name: 'Remove period' }));
    await waitFor(() =>
      expect(vi.mocked(searchDatasetCatalog).mock.calls.at(-1)![0].filters).toEqual({
        area: 'Recklinghausen',
        period: null,
      })
    );
    expect(screen.queryByRole('button', { name: 'Data period: 2025' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Remove area' }));
    await waitFor(() => expect(screen.getAllByTestId('dataset-result')).toHaveLength(12));
    expect(input).toHaveValue('Arbeitslose 2025 Deutschland');
    await userEvent.click(screen.getByText('Arbeitslose Deutschland'));
    await chooseDataset();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insert chart' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Insert chart' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThan(2);
  }
);

it('keeps searching visible, hides stale rows, ignores old responses and handles empty sources and partial failures', async () => {
  pendingLoads.results = searchFixtures;
  render(<Harness />);
  const input = screen.getByRole('textbox', { name: 'Search datasets' });
  await userEvent.fill(input, 'Arbeitslose 2025 Deutschland');
  await screen.findByText('Arbeitslose Deutschland');
  let resolve!: (value: DatasetProviderSearchResponse) => void;
  pendingLoads.catalog = new Promise(fulfil => {
    resolve = fulfil;
  });
  await userEvent.fill(input, 'Arbeitslose 2024 Deutschland');
  expect(screen.queryAllByTestId('dataset-result')).toHaveLength(0);
  expect(screen.getByText('Searching datasets…')).toBeVisible();
  expect(screen.queryByText('No suitable datasets were found.')).toBeNull();
  await waitFor(() =>
    expect(vi.mocked(searchDatasetCatalog).mock.calls.at(-1)![0].query).toBe(
      'Arbeitslose 2024 Deutschland'
    )
  );
  const obsolete = vi.mocked(searchDatasetCatalog).mock.calls.at(-1)![0].signal!;
  pendingLoads.catalog = null;
  pendingLoads.errors = [{ provider: 'GOVDATA', message: 'Timeout' }];
  await userEvent.fill(input, 'Arbeitslose 2025 Deutschland');
  expect(obsolete.aborted).toBe(true);
  await screen.findByRole('button', { name: 'Search again' });
  await screen.findByText('Arbeitslose Deutschland');
  resolve({ results: [{ id: 'stale', provider: 'UPLOAD', title: 'Stale response' }], errors: [] });
  await waitFor(() => expect(screen.queryByText('Stale response')).toBeNull());
  pendingLoads.errors = [];
  await userEvent.click(screen.getByRole('button', { name: 'Search again' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Search again' })).toBeNull());
  await userEvent.click(screen.getByRole('button', { name: 'Sources' }));
  await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await userEvent.keyboard('{Escape}');
  await screen.findByText('Please select a data source.');
  const calls = vi.mocked(searchDatasetCatalog).mock.calls.length;
  await userEvent.fill(input, 'Arbeitslose 2026 Deutschland');
  expect(screen.getByText('Please select a data source.')).toBeVisible();
  expect(vi.mocked(searchDatasetCatalog).mock.calls.length).toBe(calls);
});

it('opens unconfirmed results honestly and offers explicit actions when no results exist', async () => {
  pendingLoads.results = searchFixtures.filter(result => result.id === 'local');
  render(<Harness />);
  await userEvent.fill(
    screen.getByRole('textbox', { name: 'Search datasets' }),
    'Arbeitslose 2025 Deutschland'
  );
  await screen.findByText(/No fully matching dataset/);
  expect(screen.getByRole('button', { name: /Other results/ }).getAttribute('aria-expanded')).toBe(
    'true'
  );
  expect(screen.getByText(/Different area/)).toBeVisible();
  pendingLoads.results = [];
  await userEvent.fill(
    screen.getByRole('textbox', { name: 'Search datasets' }),
    'Arbeitslose 2026 Deutschland'
  );
  await screen.findByText('No suitable datasets were found.');
  expect(screen.getAllByRole('button', { name: 'Remove period' })).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: 'Remove area' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Area: Deutschland' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Data period: 2026' })).toBeVisible();
});

it('aborts a search on close and ignores its response after reopening', async () => {
  let fulfil!: (result: DatasetProviderSearchResponse) => void;
  pendingLoads.catalog = new Promise(resolve => {
    fulfil = resolve;
  });
  render(<Harness fromToolbar />);
  const openDialog = async () =>
    userEvent.click(screen.getAllByRole('button', { name: 'Insert data visualization' }).at(-1)!);
  await openDialog();
  await userEvent.fill(
    screen.getByRole('textbox', { name: 'Search datasets' }),
    'Arbeitslose 2025 Deutschland'
  );
  await waitFor(() => expect(vi.mocked(searchDatasetCatalog)).toHaveBeenCalledOnce());
  const signal = vi.mocked(searchDatasetCatalog).mock.calls[0][0].signal!;
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(signal.aborted).toBe(true);
  pendingLoads.catalog = null;
  await openDialog();
  fulfil({ results: searchFixtures, errors: [] });
  expect(screen.getByRole('textbox', { name: 'Search datasets' })).toHaveValue('');
  expect(screen.queryAllByTestId('dataset-result')).toHaveLength(0);
  await build();
});

it.each([
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
])('keeps the data dialog above canvas properties on $name', async ({ width, height }) => {
  await page.viewport(width, height);
  render(<Harness fromToolbar withInspector />);
  const inspector = screen.getByRole('button', { name: 'Inspector control' }).closest('aside')!;
  expect(inspector).toBeVisible();
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Insert data visualization' }).at(-1)!
  );
  const dialog = await screen.findByRole('dialog', { name: 'Insert data' });
  // Modal pointer suppression can hide a panel from hit testing even when it paints on top.
  const previousPointerEvents = inspector.style.pointerEvents;
  inspector.style.pointerEvents = 'auto';
  try {
    await waitFor(() => {
      const panel = inspector.getBoundingClientRect();
      const modal = dialog.getBoundingClientRect();
      const left = Math.max(panel.left, modal.left);
      const right = Math.min(panel.right, modal.right);
      const top = Math.max(panel.top, modal.top);
      const bottom = Math.min(panel.bottom, modal.bottom);
      expect(right).toBeGreaterThan(left);
      expect(bottom).toBeGreaterThan(top);
      expect(
        dialog.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2))
      ).toBe(true);
    });
  } finally {
    inspector.style.pointerEvents = previousPointerEvents;
  }
  await userEvent.fill(screen.getByRole('textbox', { name: 'Search datasets' }), 'Population');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('button', { name: 'Inspector control' })).toBeVisible();
});

it.each([
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
])(
  'shows the Studio spinner through dataset and preview loading on $name',
  async ({ width, height, name }) => {
    const snapshot = await createProviderSnapshot(
      { provider: 'EUROSTAT', code: 'population', language: 'en' },
      'token'
    );
    let resolveSnapshot!: (value: DatasetSnapshotImportResult) => void;
    let resolveProjection!: (value: DataViewProjection) => void;
    pendingLoads.snapshot = new Promise(resolve => {
      resolveSnapshot = resolve;
    });
    pendingLoads.projection = new Promise(resolve => {
      resolveProjection = resolve;
    });
    await page.viewport(width, height);
    render(<Harness />);
    await userEvent.fill(screen.getByRole('textbox', { name: 'Search datasets' }), 'Population');
    await userEvent.click(await screen.findByText('Population'));
    await chooseDataset();
    const loading = screen.getByText('Loading data').closest('[role="status"]')!;
    expect(loading).toBeVisible();
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Insert data' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
    const arc = loading.querySelector('.polity-presentation-loading-arc')!;
    expect(getComputedStyle(arc).animationName).toBe('polity-presentation-loading-spin');
    expect(screen.queryByRole('button', { name: 'Use dataset' })).toBeNull();
    await page.screenshot({
      path: `../../../../../output/playwright/studio-dataset-loading-${name}.png`,
    });
    resolveSnapshot(snapshot);
    const previewLoading = await screen.findByText('Updating preview');
    expect(previewLoading.closest('[role="status"]')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Insert chart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change dataset' })).toBeEnabled();
    previewLoading.scrollIntoView({ block: 'center' });
    await page.screenshot({
      path: `../../../../../output/playwright/studio-preview-loading-${name}.png`,
    });
    resolveProjection(projection);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insert chart' })).toBeEnabled());
    expect(screen.queryByText('Loading data')).toBeNull();
    expect(screen.queryByText('Updating preview')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Insert chart' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThan(2);
  }
);

it.each([
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
])('reuses the complete data finder and imports from $name', async ({ width, height, name }) => {
  await page.viewport(width, height);
  render(<Harness fromToolbar />);
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Insert data visualization' }).at(-1)!
  );
  await waitFor(() => expect(screen.getByRole('dialog', { name: 'Insert data' })).toBeVisible());
  await build();
  await page.screenshot({ path: `../../../../../output/playwright/studio-dataview-${name}.png` });
  await userEvent.click(screen.getByRole('button', { name: 'Insert chart' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThan(2);
  await waitFor(() => expect(Konva.stages.some(s => s.find('Shape').length > 0)).toBe(true));
  await page.screenshot({
    path: `../../../../../output/playwright/studio-dataview-canvas-${name}.png`,
  });
});

it('keeps insertion disabled for read-only Studio documents', async () => {
  render(<Harness disabled />);
  await userEvent.fill(screen.getByRole('textbox', { name: 'Search datasets' }), 'Population');
  await userEvent.click(await screen.findByText('Population'));
  await chooseDataset();
  await screen.findByText('Editing is disabled for this Studio document.');
  expect(screen.getByRole('button', { name: 'Insert chart' })).toBeDisabled();
  expect(screen.getByTestId('count').textContent).toBe('1');
});

it('cancels without adding Studio elements', async () => {
  render(<Harness fromToolbar />);
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Insert data visualization' }).at(-1)!
  );
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByTestId('count').textContent).toBe('1');
});

it('removes the dataset spinner on failure and allows another attempt', async () => {
  let reject!: (error: Error) => void;
  pendingLoads.snapshot = new Promise((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  render(<Harness />);
  await userEvent.fill(screen.getByRole('textbox', { name: 'Search datasets' }), 'Population');
  await userEvent.click(await screen.findByText('Population'));
  await chooseDataset();
  expect(screen.getByText('Loading data')).toBeVisible();
  reject(new Error('Dataset could not be loaded'));
  await waitFor(() => expect(screen.queryByText('Loading data')).toBeNull());
  expect(screen.getByRole('button', { name: 'Use dataset' })).toBeEnabled();
  pendingLoads.snapshot = null;
  await chooseDataset();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Insert chart' })).toBeEnabled());
});

it('closes during loading and ignores the previous response after reopening', async () => {
  const snapshot = await createProviderSnapshot(
    { provider: 'EUROSTAT', code: 'population', language: 'en' },
    'token'
  );
  let resolve!: (value: DatasetSnapshotImportResult) => void;
  pendingLoads.snapshot = new Promise(resolvePromise => {
    resolve = resolvePromise;
  });
  render(<Harness fromToolbar />);
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Insert data visualization' }).at(-1)!
  );
  await userEvent.fill(screen.getByRole('textbox', { name: 'Search datasets' }), 'Population');
  await userEvent.click(await screen.findByText('Population'));
  await chooseDataset();
  expect(screen.getByText('Loading data')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  pendingLoads.snapshot = null;
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Insert data visualization' }).at(-1)!
  );
  resolve(snapshot);
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Search datasets' })).toBeVisible()
  );
  expect(screen.queryByRole('button', { name: 'Insert chart' })).toBeNull();
  expect(screen.queryByText('Loading data')).toBeNull();
  expect(screen.getByTestId('count').textContent).toBe('1');
  await build();
  await userEvent.click(screen.getByRole('button', { name: 'Insert chart' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThan(2);
});

it.each(['bar', 'line', 'area', 'pie'] as const)(
  'renders saved %s imports on the canvas without dataset queries',
  async kind => {
    await page.viewport(1280, 900);
    const d = createStudioDocumentV5('Saved data');
    const frame = createFrameNode('widescreen');
    d.nodes.push(frame);
    insertStudioDataView(d, frame.id, configuration(kind), projection);
    render(
      <div style={{ width: 1200, height: 720 }}>
        <KonvaStudioCanvas
          document={d}
          activeFrameId={frame.id}
          selected={[]}
          assets={[]}
          editable={false}
          fit="contain"
          guides={false}
        />
      </div>
    );
    await waitFor(() => expect(Konva.stages.some(s => s.find('Shape').length > 0)).toBe(true));
    await page.screenshot({ path: `../../../../../output/playwright/studio-dataview-${kind}.png` });
  }
);

it('offers complete raw recovery from a failed saved-dataset sample in the Studio dialog', async () => {
  await page.viewport(390, 844);
  const config = configuration('line');
  config.source.providerDatasetId = 'DEMO_CODE';
  pendingLoads.details = {
    id: 'dataset',
    provider: 'EUROSTAT',
    providerDatasetId: 'DEMO_CODE',
    snapshotId: 'snapshot',
    columnProfiles: [],
  };
  vi.mocked(loadDatasetPreview).mockRejectedValueOnce(new Error('Unreadable source file'));
  const popup = {
    opener: {},
    document: { title: '', body: { textContent: '' } },
    closed: false,
    close: vi.fn(),
    location: { replace: vi.fn() },
  };
  const opened = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  vi.mocked(prepareDatasetRawDownload).mockResolvedValueOnce({
    url: '/api/datasets/raw-download?ticket=test',
    fileName: 'DEMO_CODE.csv',
    kind: 'provider',
    fullDataset: true,
  });
  render(
    <StudioDataViewDialog
      open
      onOpenChange={() => undefined}
      groupId={null}
      userId="user"
      editingElement={config}
      onInsert={() => undefined}
      disabled={false}
    />
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Download complete raw data' }));
  await screen.findByText('Download started. Your browser manages the transfer.');
  expect(vi.mocked(prepareDatasetRawDownload).mock.calls.at(-1)?.[0]).toMatchObject({
    provider: 'EUROSTAT',
    providerDatasetId: 'DEMO_CODE',
    snapshotId: 'snapshot',
  });
  expect(vi.mocked(prepareDatasetRawDownload).mock.calls.at(-1)?.[0]).not.toHaveProperty('filters');
  opened.mockRestore();
});

it('offers raw recovery when the known source file exceeds the import limit, before parsing fails', async () => {
  await page.viewport(390, 844);
  pendingLoads.results = [
    {
      id: 'dataset',
      provider: 'EUROSTAT',
      providerDatasetId: 'population',
      title: 'Large population',
      byteSize: 100 * 1024 * 1024,
      sourceUrl: 'https://example.org/data',
    },
  ];
  render(<Harness />);
  await userEvent.fill(screen.getByRole('textbox', { name: 'Search datasets' }), 'Population');
  await userEvent.click(await screen.findByText('Large population'));
  expect(screen.getByRole('button', { name: 'Use dataset' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Download complete raw data' })).toBeEnabled();
  expect(
    screen.getByText('The download contains the complete dataset and does not apply your filters.')
  ).toBeVisible();
});
