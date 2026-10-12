/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DatasetExplorer } from '../DatasetExplorer';
import { loadDatasetPreview } from '../../api/datasetClient';
import type { DatasetColumnProfile, DatasetPreview, DatasetPreviewRequest } from '../../types';
import '@/i18n/i18n';
import { encodeAppError } from '@/features/shared/errors/app-error';
import type { ComponentProps } from 'react';
import type { Button } from '@/features/shared/ui/ui/button';

vi.setConfig({ testTimeout: 15000 });

const viewport = vi.hoisted(() => ({
  indices: [0],
  token: 'token' as string | undefined,
  actions: {} as Record<string, ComponentProps<typeof Button>['onClick']>,
}));
vi.mock('@/features/shared/ui/ui/button', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/ui/ui/button')>();
  return {
    ...actual,
    Button: (props: ComponentProps<typeof Button>) => {
      viewport.actions[props['data-action-id' as keyof typeof props] as string] = props.onClick;
      return <actual.Button {...props} />;
    },
  };
});
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: viewport.token ? { access_token: viewport.token } : null }),
}));
vi.mock('../../api/datasetClient', () => ({
  loadDatasetPreview: vi.fn(),
  prepareDatasetRawDownload: vi.fn(),
}));
// The real virtualizer is exercised in DatasetExplorer.browser-component.test.tsx.
// Controlling its visible indices here makes races and the 20-page cache boundary deterministic.
vi.mock('@/features/shared/virtualization', () => ({
  usePolityLocalVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      count
        ? viewport.indices.map(index => ({ index, start: 76 + index * 32, end: 108 + index * 32 }))
        : [],
    getTotalSize: () => count * 32 + 76,
  }),
}));
const columns: DatasetColumnProfile[] = [
  { name: 'period', label: 'Period', role: 'time', type: 'date', distinctCount: 20, nullCount: 0 },
  {
    name: 'value',
    label: 'Value',
    role: 'measure',
    type: 'number',
    distinctCount: 20,
    nullCount: 0,
  },
  { name: 'area', label: 'Area', role: 'geo', type: 'category', distinctCount: 2, nullCount: 0 },
  { name: 'unit', label: 'Unit', role: 'label', type: 'category', distinctCount: 2, nullCount: 0 },
  {
    name: 'code',
    label: 'Code',
    role: 'label',
    type: 'category',
    distinctCount: 1,
    nullCount: 0,
    technical: true,
  },
];
const request: DatasetPreviewRequest = { provider: 'EUROSTAT', providerDatasetId: 'population' };
function response(selected: DatasetPreviewRequest): DatasetPreview {
  const offset = selected.page?.offset ?? 0;
  return {
    identity: selected,
    columns,
    rows: Array.from({ length: 200 }, (_, i) => ({
      period: String(2000 + i),
      value: String(offset + i),
      area: i ? 'FR' : '',
      code: 'technical',
      unit: 'people',
    })),
    appliedFilters: selected.filters ?? {},
    rowFilters: selected.rowFilters ?? {},
    timeRange: selected.timeRange,
    sampled: false,
    sampledRowCount: 6000,
    page: { offset, limit: 200, total: 6000, nextOffset: offset < 5800 ? offset + 200 : null },
    facets: {
      area: { values: ['DE', 'FR', ''], complete: true },
      value: { values: ['1', '2'], complete: true },
      unit: { values: ['people', 'percent'], complete: true },
    },
    metadata: {
      providerDimensions: [
        {
          id: 'area',
          label: 'Country',
          values: [
            { id: 'DE', label: 'Germany' },
            { id: 'FR', label: 'France' },
          ],
        },
        {
          id: 'unit',
          label: 'Measurement',
          values: [
            { id: 'people', label: 'People' },
            { id: 'percent', label: 'Percent' },
          ],
        },
      ],
    },
  };
}
beforeEach(() => {
  viewport.actions = {};
  viewport.indices = [0];
  viewport.token = 'token';
  vi.mocked(loadDatasetPreview)
    .mockReset()
    .mockImplementation(async selected => response(selected));
});

it('keeps quick actions defensive before metadata arrives and while the year range is invalid', async () => {
  const view = show();
  await act(async () =>
    viewport.actions['charts.dataset-explorer.scope.apply']!(
      {} as Parameters<NonNullable<ComponentProps<typeof Button>['onClick']>>[0]
    )
  );
  expect(loadDatasetPreview).not.toHaveBeenCalled();
  input('Area', 'Draft');
  fireEvent.click(screen.getByRole('button', { name: 'Remove quick filters' }));
  fireEvent.click(screen.getByRole('button', { name: 'Visible columns' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show technical columns' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  await ready();
  input('From year', 'invalid');
  const before = vi.mocked(loadDatasetPreview).mock.calls.length;
  await act(async () =>
    viewport.actions['charts.dataset-explorer.scope.apply']!(
      {} as Parameters<NonNullable<ComponentProps<typeof Button>['onClick']>>[0]
    )
  );
  expect(vi.mocked(loadDatasetPreview).mock.calls.length).toBe(before);
  view.unmount();
});

it('rejects a different identity from a quick-scope validation', async () => {
  show();
  await ready();
  vi.mocked(loadDatasetPreview).mockImplementationOnce(async selected => ({
    ...response(selected),
    identity: { ...selected, providerDatasetId: 'wrong' },
  }));
  input('Area', 'Germany');
  fireEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  await screen.findByRole('alert');
  expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.area).toBe('Germany');
});

it('cannot let an older quick response complete a newer quick validation', async () => {
  show();
  await ready();
  const pending: { selected: DatasetPreviewRequest; resolve: (value: DatasetPreview) => void }[] =
    [];
  vi.mocked(loadDatasetPreview).mockImplementationOnce(
    selected => new Promise(resolve => pending.push({ selected, resolve }))
  );
  input('Area', 'Germany');
  fireEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  openFilter('Unit');
  operator('empty');
  await applyFilter();
  vi.mocked(loadDatasetPreview).mockImplementationOnce(
    selected => new Promise(resolve => pending.push({ selected, resolve }))
  );
  input('Area', 'France');
  fireEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  await act(async () => pending[0].resolve(response(pending[0].selected)));
  expect(
    (screen.getByRole('button', { name: 'Apply quick filters' }) as HTMLButtonElement).disabled
  ).toBe(true);
  await act(async () => pending[1].resolve(response(pending[1].selected)));
  await ready();
  expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.area).toBe('France');
});

it('initializes a quick period on a numeric time column without appending text range sentinels', async () => {
  vi.mocked(loadDatasetPreview).mockImplementation(async selected => ({
    ...response(selected),
    columns: columns.map(column =>
      column.name === 'period' ? { ...column, type: 'number' as const } : column
    ),
  }));
  show({ ...request, filters: { period: { start: 2020, end: 2025 } } });
  await ready();
  openFilter('Period');
  expect((screen.getByRole('textbox', { name: 'To' }) as HTMLInputElement).value).toBe('2025');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function show(selected = request, initialColumns?: string[]) {
  const props = {
    request: selected,
    title: 'Boundary dataset',
    onBack: vi.fn(),
    onApply: vi.fn(),
    initialColumns,
  };
  return { ...render(<DatasetExplorer {...props} />), props };
}
async function ready() {
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Apply selection' }) as HTMLButtonElement).disabled
    ).toBe(false)
  );
}
function openFilter(name: string) {
  fireEvent.click(screen.getByRole('button', { name: `Filter ${name}` }));
}
function operator(value: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter type' }), { target: { value } });
}
function input(name: string, value: string) {
  fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
}
async function applyFilter() {
  fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
  await ready();
}

it('rejects invalid numeric ranges, supports open time ranges and missing-value filters, and restores each filter draft', async () => {
  const view = show();
  await ready();
  openFilter('Value');
  operator('range');
  input('From', 'invalid');
  expect((screen.getByRole('button', { name: 'Apply filter' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  input('From', '20');
  input('To', '10');
  expect(screen.getByRole('alert').textContent).toContain('valid');
  input('From', '');
  await applyFilter();
  openFilter('Value');
  expect((screen.getByRole('textbox', { name: 'From' }) as HTMLInputElement).value).toBe('');
  expect((screen.getByRole('textbox', { name: 'To' }) as HTMLInputElement).value).toBe('10');
  input('To', '');
  input('From', '5');
  await applyFilter();
  openFilter('Period');
  operator('range');
  input('To', '2025');
  await applyFilter();
  openFilter('Period');
  expect((screen.getByRole('textbox', { name: 'To' }) as HTMLInputElement).value).toBe('2025');
  input('From', '2024');
  input('To', '2025-12');
  await applyFilter();
  openFilter('Area');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Germany' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'France' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Germany' }));
  operator('empty');
  await applyFilter();
  openFilter('Unit');
  operator('contains');
  input('Text contains', '  people  ');
  await applyFilter();
  openFilter('Unit');
  expect((screen.getByRole('textbox', { name: 'Text contains' }) as HTMLInputElement).value).toBe(
    '  people  '
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove filter' }));
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Apply selection' }));
  expect(view.props.onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      rowConditions: [
        { column: 'value', operator: 'range', min: '5', max: undefined, numeric: true },
        { column: 'period', operator: 'range', min: '2024', max: '2025-12', numeric: false },
        { column: 'area', operator: 'empty' },
      ],
    })
  );
});

it('sends one live dimension upstream, clears it for multiple or empty values, and handles a non-geographic dimension', async () => {
  show({
    ...request,
    filters: { dimensions: { area: 'DE', unit: 'people', unrelated: 'keep' } },
    rowFilters: { area: 'DE', unit: 'people', unknown: 'raw', empty: '' },
  });
  await ready();
  openFilter('Area');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Germany' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'France' }));
  await applyFilter();
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.dimensions?.area).toBe(
      'FR'
    )
  );
  openFilter('Area');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Germany' }));
  await applyFilter();
  await waitFor(() =>
    expect(
      vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.dimensions?.area
    ).toBeUndefined()
  );
  openFilter('Area');
  operator('empty');
  await applyFilter();
  openFilter('Area');
  operator('in');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Missing' }));
  await applyFilter();
  expect(
    vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.dimensions?.area
  ).toBeUndefined();
  openFilter('Unit');
  fireEvent.click(screen.getByRole('checkbox', { name: 'People' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Percent' }));
  await applyFilter();
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.dimensions?.unit).toBe(
      'percent'
    )
  );
});

it('adopts explicit technical columns and scoped sampled metadata, then disables adoption when every column is hidden', async () => {
  viewport.token = undefined;
  vi.mocked(loadDatasetPreview).mockImplementation(async selected => ({
    ...response(selected),
    sampled: true,
    metadata: { ...response(selected).metadata, importScope: { area: 'DE' } },
  }));
  show(
    {
      ...request,
      filters: {
        area: 'Germany',
        period: { start: 1800, end: 2199 },
        dimensions: { area: 'DE', unknown: 'raw' },
      },
      rowFilters: { area: 'DE', unit: 'people' },
    },
    ['code']
  );
  await ready();
  expect(screen.getByRole('button', { name: 'Filter Code' })).toBeTruthy();
  expect(screen.getByText(/1800–2199/)).toBeTruthy();
  expect(screen.getByText(/Country: Germany/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Visible columns' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show technical columns' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(
    (screen.getByRole('button', { name: 'Apply selection' }) as HTMLButtonElement).disabled
  ).toBe(true);
  expect(screen.getByText('Choose at least one visible column.')).toBeTruthy();
});

it('evicts old pages after 20 cache entries and refetches the oldest visible page', async () => {
  const view = show();
  await ready();
  for (let page = 1; page <= 21; page++) {
    viewport.indices = [page * 200];
    view.rerender(<DatasetExplorer {...view.props} title={`Page ${page}`} />);
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).getAllByText(String(page * 200)).length
      ).toBeGreaterThan(0)
    );
  }
  const calls = vi.mocked(loadDatasetPreview).mock.calls.length;
  viewport.indices = [200];
  view.rerender(<DatasetExplorer {...view.props} title="Back to evicted page" />);
  await waitFor(() => expect(vi.mocked(loadDatasetPreview).mock.calls.length).toBe(calls + 1));
  expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].page?.offset).toBe(200);
});

it.each(['identity', 'offset', 'failure'] as const)(
  'rejects a paged %s and preserves retry recovery',
  async kind => {
    const view = show();
    await ready();
    vi.mocked(loadDatasetPreview).mockImplementation(async selected => {
      if (selected.page?.offset) {
        if (kind === 'failure') throw new Error('Paged provider failure');
        return {
          ...response(selected),
          ...(kind === 'identity'
            ? { identity: { ...selected, providerDatasetId: 'different' } }
            : { page: { ...response(selected).page!, offset: 0 } }),
        };
      }
      return response(selected);
    });
    viewport.indices = [200];
    view.rerender(<DatasetExplorer {...view.props} title="Broken page" />);
    await screen.findByRole('alert');
    expect(
      (screen.getByRole('button', { name: 'Apply selection' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Download complete raw data' })).toBeTruthy();
  }
);

it('ignores late paged responses and cancelled quick validations after a scope change', async () => {
  const view = show();
  await ready();
  let resolve!: (value: DatasetPreview) => void;
  vi.mocked(loadDatasetPreview).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  viewport.indices = [200];
  view.rerender(<DatasetExplorer {...view.props} title="Pending page" />);
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].page?.offset).toBe(200)
  );
  const selected = vi.mocked(loadDatasetPreview).mock.calls.at(-1)!;
  fireEvent.click(screen.getByRole('button', { name: 'Sort Value' }));
  expect(selected[2]?.aborted).toBe(true);
  await act(async () => resolve(response(selected[0])));
  await ready();
  let fail!: (error: Error) => void;
  vi.mocked(loadDatasetPreview).mockImplementationOnce(
    () =>
      new Promise((_done, reject) => {
        fail = reject;
      })
  );
  input('Area', 'Germany');
  fireEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove quick filters' }));
  await act(async () => fail(new Error('Cancelled')));
  expect(screen.queryByText('Cancelled')).toBeNull();
});

it('does not duplicate an in-flight page, and ignores its rejection after changing the table sort', async () => {
  const view = show();
  await ready();
  let reject!: (error: Error) => void;
  vi.mocked(loadDatasetPreview).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      })
  );
  viewport.indices = [200];
  view.rerender(<DatasetExplorer {...view.props} title="First pending page" />);
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].page?.offset).toBe(200)
  );
  viewport.indices = [200, 400];
  view.rerender(<DatasetExplorer {...view.props} title="Two pending pages" />);
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].page?.offset).toBe(400)
  );
  expect(
    vi.mocked(loadDatasetPreview).mock.calls.filter(([selected]) => selected.page?.offset === 200)
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Sort Value' }));
  await act(async () => reject(new Error('Obsolete page failure')));
  await ready();
  expect(screen.queryByText('Obsolete page failure')).toBeNull();
});

it('validates quick scopes against the exact dataset, removes spatial conditions and keeps unrelated filters', async () => {
  show({
    ...request,
    filters: { dimensions: { area: 'DE', unit: 'people' } },
    rowFilters: { area: 'DE', unit: 'people' },
    rowConditions: [
      { column: 'period', operator: 'range', min: '2020', max: '2025' },
      { column: 'value', operator: 'contains', value: '1' },
    ],
  });
  await ready();
  input('To year', '2025');
  fireEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  await ready();
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.period).toEqual({
      start: 1800,
      end: 2025,
    })
  );
  expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0]).toMatchObject({
    filters: { dimensions: { unit: 'people' } },
    rowFilters: { unit: 'people' },
    rowConditions: [{ column: 'value', operator: 'contains', value: '1' }],
  });
  input('From year', 'invalid');
  expect(screen.getByRole('alert').textContent).toContain('valid');
  input('From year', '');
  input('To year', '');
  openFilter('Period');
  expect((screen.getByRole('textbox', { name: 'To' }) as HTMLInputElement).value).toBe('');
  fireEvent.keyDown(document, { key: 'Escape' });
  input('Area', 'Mismatch');
  vi.mocked(loadDatasetPreview).mockImplementationOnce(async selected => ({
    ...response(selected),
    identity: { ...selected, providerDatasetId: 'other' },
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Remove quick filters' }));
  await ready();
  expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].rowFilters).toEqual({
    unit: 'people',
  });
});

it('ignores a late successful quick validation after a header filter supersedes it', async () => {
  show();
  await ready();
  let resolve!: (value: DatasetPreview) => void;
  vi.mocked(loadDatasetPreview).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  input('Area', 'Germany');
  fireEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  const selected = vi.mocked(loadDatasetPreview).mock.calls.at(-1)![0];
  openFilter('Unit');
  operator('empty');
  await applyFilter();
  await act(async () => resolve(response(selected)));
  expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.area).toBeUndefined();
});

it.each(['initial', 'scope'] as const)(
  'does not offer a download for an unrecoverable %s authorization failure',
  async kind => {
    if (kind === 'initial')
      vi.mocked(loadDatasetPreview).mockRejectedValueOnce(
        new Error(encodeAppError('permission_denied'))
      );
    show();
    if (kind === 'scope') {
      await ready();
      input('Area', 'Germany');
      vi.mocked(loadDatasetPreview).mockRejectedValueOnce(
        new Error(encodeAppError('permission_denied'))
      );
      fireEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
    }
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Download complete raw data' })).toBeNull();
  }
);

it.each(['date', 'number'] as const)(
  'initializes a saved %s time range without treating it as quick scope',
  async type => {
    vi.mocked(loadDatasetPreview).mockImplementation(async selected => ({
      ...response(selected),
      columns: columns.map(column => (column.name === 'period' ? { ...column, type } : column)),
      rows: [{}],
      page: undefined,
    }));
    show({ ...request, timeRange: { column: 'period', startYear: 2020, endYear: 2025 } });
    await ready();
    openFilter('Period');
    expect((screen.getByRole('textbox', { name: 'From' }) as HTMLInputElement).value).toBe('2020');
    expect((screen.getByRole('textbox', { name: 'To' }) as HTMLInputElement).value).toBe('2025');
    input('From', '');
    input('To', '2025');
    await applyFilter();
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].timeRange).toBeNull();
  }
);

it('does not send GENESIS value-unit row selection as a provider dimension', async () => {
  vi.mocked(loadDatasetPreview).mockImplementation(async selected => ({
    ...response(selected),
    columns: columns.map(column =>
      column.name === 'unit' ? { ...column, name: 'value_unit' } : column
    ),
    metadata: {
      providerDimensions: [
        { id: 'value_unit', label: 'Unit', values: [{ id: 'people', label: 'People' }] },
      ],
    },
  }));
  show({ provider: 'GENESIS_DESTATIS', providerDatasetId: '13211-0002' });
  await ready();
  openFilter('Unit');
  fireEvent.click(screen.getByRole('checkbox', { name: 'People' }));
  await applyFilter();
  expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.dimensions).toBeUndefined();
});

it('rejects an initial dataset identity mismatch and ignores an aborted initial failure', async () => {
  vi.mocked(loadDatasetPreview).mockImplementationOnce(async selected => ({
    ...response(selected),
    identity: { ...selected, providerDatasetId: 'wrong' },
  }));
  const view = show();
  await screen.findByRole('alert');
  view.unmount();
  let reject!: (error: Error) => void;
  vi.mocked(loadDatasetPreview).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      })
  );
  const pending = show();
  await waitFor(() => expect(vi.mocked(loadDatasetPreview).mock.calls.length).toBe(2));
  pending.unmount();
  await act(async () => reject(new Error('Aborted initial response')));
  expect(screen.queryByText('Aborted initial response')).toBeNull();
});
