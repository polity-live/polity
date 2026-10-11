/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDataViewDialogModel } from '../../hooks/useDataViewDialogModel';
import { useDataViewBuilderModel } from '../../hooks/useDataViewBuilderModel';
import { OPEN_DATA_VIEW_DIALOG_EVENT } from '../chartDialogEvents';
import type {
  DataViewProjection,
  DatasetColumnProfile,
  DatasetSearchResult,
  DatasetSnapshotImportResult,
  TDataViewElement,
} from '../../types';

const mocks = vi.hoisted(() => ({
  language: 'en-US' as string | undefined,
  session: { access_token: 'token', user: { id: 'user-1' } } as any,
  context: {
    defaultGroupId: 'group-1',
    canViewDatasets: true,
    canManageDatasets: true,
    canUploadDatasets: true,
  },
  groups: [{ id: 'group-1', name: 'Group One' }] as any[],
  groupsLoading: false,
  findPath: vi.fn((): number[] | undefined => [0]),
  focus: vi.fn(),
  insertNodes: vi.fn(),
  setNodes: vi.fn(),
  toastError: vi.fn(),
  createDataViewProjection: vi.fn(),
  createProviderSnapshot: vi.fn(),
  prepareProviderDataset: vi.fn(),
  loadDatasetColumnValues: vi.fn(),
  loadDatasetDetails: vi.fn(),
  searchDatasetCatalog: vi.fn(),
  uploadDataset: vi.fn(),
}));

vi.mock('platejs/react', () => ({
  useEditorRef: () => ({
    api: { findPath: mocks.findPath },
    tf: { focus: mocks.focus, insertNodes: mocks.insertNodes, setNodes: mocks.setNodes },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: mocks.language },
    t: (key: string) => key,
  }),
}));

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useCurrentUserActiveGroups: () => ({
    groups: mocks.groups,
    isLoading: mocks.groupsLoading,
  }),
}));
vi.mock('../../context/ChartDatasetContext', () => ({
  useChartDatasetContext: () => mocks.context,
}));
vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: (error: unknown) =>
    `localized:${error instanceof Error ? error.message : String(error)}`,
}));
vi.mock('../../api/datasetClient', () => ({
  createDataViewProjection: mocks.createDataViewProjection,
  createProviderSnapshot: mocks.createProviderSnapshot,
  prepareProviderDataset: mocks.prepareProviderDataset,
  loadDatasetColumnValues: mocks.loadDatasetColumnValues,
  loadDatasetDetails: mocks.loadDatasetDetails,
  searchDatasetCatalog: mocks.searchDatasetCatalog,
  uploadDataset: mocks.uploadDataset,
}));

const profiles: DatasetColumnProfile[] = [
  {
    name: 'Year',
    label: 'Year',
    type: 'date',
    role: 'time',
    nullCount: 0,
    distinctCount: 3,
  },
  {
    name: 'Value',
    label: 'Value',
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
];

function searchResult(overrides: Partial<DatasetSearchResult> = {}): DatasetSearchResult {
  return {
    id: 'dataset-1',
    provider: 'EUROSTAT',
    providerDatasetId: 'demo-code',
    title: 'Dataset',
    columnProfiles: profiles,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<DatasetSnapshotImportResult> = {}
): DatasetSnapshotImportResult {
  return {
    datasetId: 'dataset-1',
    snapshotId: 'snapshot-1',
    snapshotKey: 'snapshot-key',
    provider: 'EUROSTAT',
    title: 'Dataset',
    columns: profiles.map(profile => profile.name),
    columnProfiles: profiles,
    rows: [],
    rowCount: 3,
    columnCount: 3,
    byteSize: 100,
    snapshotTakenAt: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

function projection(view: 'chart' | 'table' | 'stat' = 'chart'): DataViewProjection {
  if (view === 'table') {
    return { view, snapshotId: 'snapshot-1', columns: ['Year'], rows: [], rowCount: 0 };
  }
  if (view === 'stat') {
    return {
      view,
      snapshotId: 'snapshot-1',
      label: 'Value',
      value: 1,
      aggregation: 'sum',
      rowCount: 1,
    };
  }
  return { view, snapshotId: 'snapshot-1', points: [{ x: '2026', value: 1 }], rowCount: 1 };
}

function openDialog(element?: TDataViewElement) {
  window.dispatchEvent(
    new CustomEvent(OPEN_DATA_VIEW_DIALOG_EVENT, {
      detail: { element },
    })
  );
}

async function flushTimers(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.language = 'en-US';
  mocks.session = { access_token: 'token', user: { id: 'user-1' } };
  mocks.context.defaultGroupId = 'group-1';
  mocks.context.canViewDatasets = true;
  mocks.context.canManageDatasets = true;
  mocks.context.canUploadDatasets = true;
  mocks.groups = [{ id: 'group-1', name: 'Group One' }];
  mocks.groupsLoading = false;
  mocks.findPath.mockReturnValue([0]);
  mocks.searchDatasetCatalog.mockResolvedValue({ results: [], errors: [] });
  mocks.loadDatasetDetails.mockResolvedValue({ columnProfiles: profiles });
  mocks.createProviderSnapshot.mockResolvedValue(snapshot());
  mocks.prepareProviderDataset.mockImplementation(async request => ({
    provider: request.provider,
    code: request.code,
    title: 'Dataset',
    dimensions: [],
    estimatedBytes: 100,
    importAllowed: true,
    suggestedFilters: request.filters ?? {},
  }));
  mocks.createDataViewProjection.mockResolvedValue(projection());
  mocks.loadDatasetColumnValues.mockResolvedValue(['A', 'B']);
  mocks.uploadDataset.mockResolvedValue(snapshot({ provider: 'UPLOAD', publisher: null }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useDataViewDialogModel boundaries', () => {
  it('discards obsolete filter errors and upload errors without replacing the next dialog state', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => {
      openDialog();
      result.current.setSelectedResult(searchResult());
    });
    await act(async () => result.current.useSelectedDataset());
    const filters = deferred<string[]>();
    mocks.loadDatasetColumnValues.mockReturnValueOnce(filters.promise);
    let loading!: Promise<void>;
    act(() => {
      loading = result.current.loadFilterValues();
    });
    act(() => openDialog());
    await act(async () => {
      filters.reject(new Error('obsolete values'));
      await loading;
    });
    expect(result.current.projectionError).toBeNull();
    const upload = deferred<DatasetSnapshotImportResult>();
    mocks.uploadDataset.mockReturnValueOnce(upload.promise);
    act(() => {
      result.current.setUploadGroupId('group-1');
      result.current.setUploadFile(new File(['a,b'], 'late.csv'));
    });
    act(() => {
      loading = result.current.submitUpload();
    });
    act(() => openDialog());
    await act(async () => {
      upload.reject(new Error('obsolete upload'));
      await loading;
    });
    expect(result.current.uploadError).toBeNull();
  });
  it('discards obsolete successful filter loads and accepts the selected stored snapshot after editing', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    const element: TDataViewElement = {
      type: 'data_view',
      view: 'chart',
      source: {
        kind: 'dataset',
        provider: 'UPLOAD',
        datasetId: 'stored',
        snapshotId: 'snapshot',
        title: 'Stored',
      },
      query: { filters: {}, aggregation: 'sum' },
      presentation: {},
      children: [{ text: '' }],
    };
    act(() => openDialog(element));
    await act(async () => Promise.resolve());
    await act(async () => result.current.useSelectedDataset());
    const filters = deferred<string[]>();
    mocks.loadDatasetColumnValues.mockReturnValueOnce(filters.promise);
    let loading!: Promise<void>;
    act(() => {
      loading = result.current.loadFilterValues();
    });
    act(() => openDialog());
    await act(async () => {
      filters.resolve(['obsolete']);
      await loading;
    });
    expect(result.current.filterValues).toEqual({});
    expect(result.current.filterValuesLoading).toBe(false);
  });
  it('reuses prepared metadata, cancels scope selection and preserves functional modal updates', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => {
      openDialog();
      result.current.setSelectedResult(searchResult());
    });
    await act(async () => result.current.useSelectedDataset(true));
    expect(result.current.stage).toBe('prepare');
    await act(async () => result.current.useSelectedDataset(true));
    expect(mocks.prepareProviderDataset).toHaveBeenCalledOnce();
    expect(mocks.createProviderSnapshot).not.toHaveBeenCalled();
    act(() => result.current.cancelPreparation());
    expect(result.current.stage).toBe('find');
    expect(result.current.error).toBeNull();
    act(() => result.current.setOpen(current => !current));
    expect(result.current.open).toBe(false);
  });
  it.each([true, false])(
    'imports GENESIS from prepared metadata with restrictImport=%s',
    async restrict => {
      const { result } = renderHook(() => useDataViewDialogModel());
      act(() => {
        openDialog();
        result.current.setSelectedResult(searchResult({ provider: 'GENESIS_DESTATIS' }));
      });
      await act(async () => result.current.useSelectedDataset(true));
      act(() => {
        result.current.setRestrictImport(restrict);
        result.current.setImportFilters({});
      });
      await act(async () => result.current.useSelectedDataset());
      const request = mocks.createProviderSnapshot.mock.lastCall?.[0];
      expect(request.provider).toBe('GENESIS_DESTATIS');
      if (restrict) expect(request.filters).toEqual({});
      else expect(request).not.toHaveProperty('filters');
      expect(result.current.stage).toBe('build');
    }
  );
  it('returns an oversized import to preparation without broadening the selection', async () => {
    const failure = Object.assign(new Error('selection too large'), {
      payload: { code: 'dataset_scope_too_large' },
    });
    mocks.createProviderSnapshot.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => {
      openDialog();
      result.current.setSelectedResult(searchResult());
    });
    await act(async () => result.current.useSelectedDataset());
    expect(result.current.stage).toBe('prepare');
    expect(result.current.error).toBe('localized:selection too large');
    expect(result.current.preparing).toBe(false);
  });
  it('ignores obsolete editing-detail failures and accepts empty profile metadata', async () => {
    const pending = deferred<any>();
    mocks.loadDatasetDetails.mockReturnValueOnce(pending.promise);
    const element: TDataViewElement = {
      type: 'data_view',
      view: 'chart',
      source: {
        kind: 'dataset',
        provider: 'UPLOAD',
        datasetId: 'stored',
        snapshotId: 'snapshot',
        title: 'Stored',
      },
      query: { filters: {}, aggregation: 'sum' },
      presentation: {},
      children: [{ text: '' }],
    };
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => openDialog(element));
    act(() => openDialog());
    await act(async () => pending.reject(new Error('obsolete details')));
    expect(result.current.error).toBeNull();
    mocks.loadDatasetDetails.mockResolvedValueOnce({});
    act(() => openDialog(element));
    await act(async () => Promise.resolve());
    expect(result.current.columnProfiles).toEqual([]);
  });
  it('discards an upload that completes after the dialog has been reset', async () => {
    const pending = deferred<DatasetSnapshotImportResult>();
    mocks.uploadDataset.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => {
      openDialog();
      result.current.setUploadGroupId('group-1');
      result.current.setUploadFile(new File(['a,b'], 'late.csv'));
    });
    let loading!: Promise<void>;
    act(() => {
      loading = result.current.submitUpload();
    });
    act(() => openDialog());
    await act(async () => {
      pending.resolve(snapshot());
      await loading;
    });
    expect(result.current.stage).toBe('find');
    expect(result.current.snapshot).toBeNull();
  });
  it.each([null, 25 * 1024 * 1024])(
    'prepares size %s before import and preserves manual scope changes',
    async estimatedBytes => {
      mocks.prepareProviderDataset.mockResolvedValueOnce({
        provider: 'EUROSTAT',
        code: 'demo-code',
        title: 'Dataset',
        dimensions: [],
        estimatedBytes,
        importAllowed: true,
        suggestedFilters: {},
      });
      const dimensions = [
        {
          id: 'Region',
          label: 'Region',
          position: 0,
          values: [
            { id: 'DE', label: 'Germany' },
            { id: 'FR', label: 'France' },
          ],
        },
      ];
      mocks.createProviderSnapshot.mockResolvedValueOnce(
        snapshot({
          columnProfiles: profiles.map(item =>
            item.name === 'Region' ? { ...item, role: 'geo' } : item
          ),
          provenance: {
            providerDimensions: dimensions,
            geoDimension: 'Region',
            timeDimension: 'Year',
            importScope: { Region: ['FR'] },
          },
        })
      );
      const { result } = renderHook(() => useDataViewDialogModel());
      act(() => {
        openDialog();
        result.current.setSearchQuery('Population 2025 Deutschland');
      });
      act(() => result.current.setSelectedResult(searchResult()));
      await act(async () => result.current.useSelectedDataset());
      expect(result.current.stage).toBe('prepare');
      expect(result.current.preparing).toBe(false);
      expect(mocks.createProviderSnapshot).not.toHaveBeenCalled();
      expect(result.current.importFilters).toEqual({
        area: 'Deutschland',
        period: { start: 2025, end: 2025 },
      });
      act(() =>
        result.current.setImportFilters({ area: 'France', period: { start: 2024, end: 2024 } })
      );
      await act(async () => result.current.useSelectedDataset());
      expect(mocks.createProviderSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { area: 'France', period: { start: 2024, end: 2024 } },
        }),
        'token',
        expect.any(AbortSignal)
      );
      expect(result.current.query).toMatchObject({
        filters: { Region: 'FR' },
        timeRange: { column: 'Year', startYear: 2024, endYear: 2024 },
      });
    }
  );

  it('fully imports a small dataset while carrying search scope into the preview', async () => {
    mocks.createProviderSnapshot.mockResolvedValueOnce(
      snapshot({
        columnProfiles: profiles.map(item =>
          item.name === 'Region' ? { ...item, role: 'geo' } : item
        ),
        provenance: {
          providerDimensions: [
            {
              id: 'Region',
              label: 'Region',
              position: 0,
              values: [{ id: 'DE', label: 'Germany' }],
            },
          ],
          geoDimension: 'Region',
          timeDimension: 'Year',
        },
      })
    );
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => {
      openDialog();
      result.current.setSearchQuery('Population 2024–2025 Deutschland');
    });
    act(() => result.current.setSelectedResult(searchResult()));
    await act(async () => result.current.useSelectedDataset());
    expect(mocks.createProviderSnapshot.mock.calls[0][0]).not.toHaveProperty('filters');
    expect(result.current.query).toMatchObject({
      filters: { Region: 'DE' },
      timeRange: { column: 'Year', startYear: 2024, endYear: 2025 },
    });
  });

  it('aborts preparation on closing and ignores late metadata after reopening', async () => {
    const pending = deferred<any>();
    mocks.prepareProviderDataset.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => openDialog());
    act(() => result.current.setSelectedResult(searchResult()));
    let loading!: Promise<void>;
    act(() => {
      loading = result.current.useSelectedDataset();
    });
    const signal = mocks.prepareProviderDataset.mock.calls[0][2];
    expect(result.current.preparing).toBe(true);
    act(() => result.current.setOpen(false));
    expect(signal.aborted).toBe(true);
    act(() => openDialog());
    await act(async () => {
      pending.resolve({
        provider: 'EUROSTAT',
        code: 'demo-code',
        dimensions: [],
        estimatedBytes: null,
      });
      await loading;
    });
    expect(result.current.stage).toBe('find');
    expect(result.current.preparation).toBeNull();
    expect(mocks.createProviderSnapshot).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'shows preparation until a stored=%s dataset settles before projecting',
    async stored => {
      const pending = deferred<DatasetSnapshotImportResult>();
      const api = stored ? mocks.loadDatasetDetails : mocks.createProviderSnapshot;
      api.mockReturnValueOnce(pending.promise);
      const { result } = renderHook(() => useDataViewDialogModel());
      act(() => openDialog());
      act(() =>
        result.current.setSelectedResult(searchResult(stored ? { snapshotId: 'snapshot-1' } : {}))
      );
      let loading!: Promise<void>;
      act(() => {
        loading = result.current.useSelectedDataset();
      });
      expect(result.current.preparing).toBe(true);
      expect(result.current.canInsert).toBe(false);
      await act(async () => result.current.useSelectedDataset());
      expect(api).toHaveBeenCalledTimes(1);
      await flushTimers(500);
      expect(mocks.createDataViewProjection).not.toHaveBeenCalled();
      await act(async () => {
        pending.resolve(snapshot());
        await loading;
      });
      expect(result.current.preparing).toBe(false);
      expect(result.current.stage).toBe('build');
      expect(result.current.projectionLoading).toBe(true);
      await flushTimers(250);
      expect(result.current.canInsert).toBe(true);
    }
  );

  it.each([false, true])(
    'clears preparation and permits retry after a stored=%s dataset fails',
    async stored => {
      const pending = deferred<DatasetSnapshotImportResult>();
      (stored ? mocks.loadDatasetDetails : mocks.createProviderSnapshot).mockReturnValueOnce(
        pending.promise
      );
      const { result } = renderHook(() => useDataViewDialogModel());
      act(() => openDialog());
      act(() =>
        result.current.setSelectedResult(searchResult(stored ? { snapshotId: 'snapshot-1' } : {}))
      );
      let loading!: Promise<void>;
      act(() => {
        loading = result.current.useSelectedDataset();
      });
      await act(async () => {
        pending.reject(new Error('dataset failed'));
        await loading;
      });
      expect(result.current.preparing).toBe(false);
      expect(result.current.error).toBe('localized:dataset failed');
      expect(result.current.stage).toBe('find');
      await act(async () => result.current.useSelectedDataset());
      expect(result.current.error).toBeNull();
      expect(result.current.stage).toBe('build');
    }
  );

  it('waits for restored metadata before requesting the preview', async () => {
    const pending = deferred<{ columnProfiles: DatasetColumnProfile[] }>();
    mocks.loadDatasetDetails.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useDataViewDialogModel());
    const element: TDataViewElement = {
      type: 'data_view',
      view: 'chart',
      chartType: 'line',
      source: {
        kind: 'dataset',
        provider: 'UPLOAD',
        datasetId: 'dataset-1',
        snapshotId: 'snapshot-1',
        title: 'Stored',
      },
      query: { filters: {}, aggregation: 'sum', dimensionColumn: 'Year', measureColumn: 'Value' },
      presentation: {},
      children: [{ text: '' }],
    };
    act(() => openDialog(element));
    expect(result.current.preparing).toBe(true);
    expect(result.current.canInsert).toBe(false);
    await flushTimers(500);
    expect(mocks.createDataViewProjection).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve({ columnProfiles: profiles });
    });
    expect(result.current.preparing).toBe(false);
    expect(result.current.columnProfiles).toEqual(profiles);
    await flushTimers(250);
    expect(result.current.canInsert).toBe(true);
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores an old import that %ss after closing and reopening',
    async settle => {
      const previous = deferred<DatasetSnapshotImportResult>();
      const current = deferred<DatasetSnapshotImportResult>();
      mocks.createProviderSnapshot
        .mockReturnValueOnce(previous.promise)
        .mockReturnValueOnce(current.promise);
      const { result } = renderHook(() => useDataViewDialogModel());
      act(() => openDialog());
      act(() => result.current.setSelectedResult(searchResult()));
      let previousLoading!: Promise<void>;
      act(() => {
        previousLoading = result.current.useSelectedDataset();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(mocks.createProviderSnapshot).toHaveBeenCalledOnce();
      act(() => result.current.setOpen(false));
      expect(result.current.preparing).toBe(false);
      expect(result.current.projectionLoading).toBe(false);
      act(() => openDialog());
      act(() => result.current.setSelectedResult(searchResult({ id: 'new' })));
      let currentLoading!: Promise<void>;
      act(() => {
        currentLoading = result.current.useSelectedDataset();
      });
      await act(async () => {
        if (settle === 'resolve') previous.resolve(snapshot());
        else previous.reject(new Error('obsolete'));
        await previousLoading;
      });
      expect(result.current.preparing).toBe(true);
      expect(result.current.stage).toBe('find');
      expect(result.current.snapshot).toBeNull();
      expect(result.current.error).toBeNull();
      await act(async () => {
        current.resolve(snapshot({ datasetId: 'new' }));
        await currentLoading;
      });
      expect(result.current.preparing).toBe(false);
      expect(result.current.snapshot?.datasetId).toBe('new');
    }
  );

  it('clears an obsolete preview spinner when the configuration becomes incomplete', async () => {
    const pending = deferred<DataViewProjection>();
    mocks.createDataViewProjection.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => openDialog());
    act(() => result.current.setSelectedResult(searchResult()));
    await act(async () => result.current.useSelectedDataset());
    await flushTimers(250);
    expect(result.current.projectionLoading).toBe(true);
    act(() => result.current.setQuery({ filters: {}, aggregation: 'sum' }));
    expect(result.current.projectionLoading).toBe(false);
    await act(async () => {
      pending.resolve(projection());
    });
    expect(result.current.projection).toBeNull();
    expect(result.current.canInsert).toBe(false);
  });

  it('uses a local builder callback without Plate events, and blocks invalid or pending previews', async () => {
    const insert = vi.fn();
    let blocked = false;
    let readOnly = false;
    const { result, rerender } = renderHook(() =>
      useDataViewBuilderModel({
        onInsert: insert,
        canInsert: !readOnly,
        validate: () => (blocked ? 'Reduce to 49 rows' : null),
      })
    );
    act(() => openDialog());
    expect(result.current.open).toBe(false);
    act(() => {
      result.current.resetDialog();
      result.current.setOpen(true);
      result.current.setSelectedResult(searchResult());
    });
    await act(async () => result.current.useSelectedDataset());
    expect(result.current.canInsert).toBe(false);
    act(() => result.current.save());
    expect(insert).not.toHaveBeenCalled();
    await flushTimers(250);
    blocked = true;
    rerender();
    expect(result.current.error).toBe('Reduce to 49 rows');
    act(() => result.current.save());
    expect(insert).not.toHaveBeenCalled();
    blocked = false;
    readOnly = true;
    rerender();
    act(() => result.current.save());
    expect(insert).not.toHaveBeenCalled();
    readOnly = false;
    rerender();
    act(() => result.current.setQuery(q => ({ ...q, limit: 25 })));
    expect(result.current.canInsert).toBe(false);
    await flushTimers(250);
    act(() => result.current.save());
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'data_view', query: expect.objectContaining({ limit: 25 }) }),
      projection(),
      null
    );
    expect(mocks.insertNodes).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });
  it('resets new dialogs and handles finder guards, success, failure, and cancellation', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    expect(result.current).toMatchObject({
      open: false,
      stage: 'find',
      canManageDatasets: true,
      canUploadDatasets: true,
    });
    await act(async () => result.current.useSelectedDataset());
    await act(async () => result.current.loadFilterValues());
    act(() => {
      result.current.setView('table');
      result.current.setUploadOpen(false);
      result.current.setUploadFile(null);
    });

    act(() => openDialog());
    expect(result.current.open).toBe(true);
    act(() => result.current.setSearchQuery('x'));
    await flushTimers(300);
    expect(mocks.searchDatasetCatalog).not.toHaveBeenCalled();

    act(() => {
      result.current.setProviders([]);
      result.current.setSearchQuery('population');
    });
    await flushTimers(300);
    expect(mocks.searchDatasetCatalog).not.toHaveBeenCalled();

    const deferred: { resolve?: (value: any) => void } = {};
    mocks.searchDatasetCatalog.mockReturnValueOnce(
      new Promise(resolve => {
        deferred.resolve = resolve;
      })
    );
    act(() => result.current.setProviders(['EUROSTAT']));
    await flushTimers(300);
    expect(result.current.searching).toBe(true);
    act(() => result.current.setSearchQuery('other'));
    deferred.resolve?.({
      results: [searchResult()],
      errors: [{ provider: 'EUROSTAT', message: 'x' }],
    });
    await act(async () => Promise.resolve());
    expect(result.current.searchResults).toEqual([]);

    mocks.searchDatasetCatalog.mockResolvedValueOnce({
      results: [searchResult()],
      errors: [{ provider: 'EUROSTAT', message: 'partial' }],
    });
    await flushTimers(300);
    expect(result.current.searchResults).toHaveLength(1);
    expect(result.current.providerErrors).toHaveLength(1);
    expect(result.current.searching).toBe(false);

    mocks.context.canViewDatasets = false;
    mocks.searchDatasetCatalog.mockRejectedValueOnce(new Error('search failed'));
    act(() => result.current.setSearchQuery('failure'));
    await flushTimers(300);
    expect(result.current.error).toBe('localized:search failed');
    expect(mocks.searchDatasetCatalog).toHaveBeenLastCalledWith(
      expect.objectContaining({ groupId: null })
    );

    let rejectCancelled!: (error: Error) => void;
    mocks.searchDatasetCatalog.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectCancelled = reject;
      })
    );
    act(() => result.current.setSearchQuery('cancelled'));
    await flushTimers(300);
    act(() => result.current.setSearchQuery('cancelled-next'));
    rejectCancelled(new Error('ignored'));
    await act(async () => Promise.resolve());
    expect(result.current.error).toBeNull();
    expect(mocks.searchDatasetCatalog.mock.calls.at(-1)![0].signal.aborted).toBe(true);
  });

  it('shows search immediately, preserves removed filters and cancels obsolete and closed searches', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => openDialog());
    act(() => result.current.setSearchQuery('Arbeitslose 2025 Deutschland'));
    expect(result.current.searching).toBe(true);
    expect(result.current.searchIntent).toMatchObject({
      topic: 'Arbeitslose',
      area: 'Deutschland',
      period: { start: 2025, end: 2025 },
    });
    await flushTimers(299);
    expect(mocks.searchDatasetCatalog).not.toHaveBeenCalled();
    await flushTimers(1);
    expect(result.current.searching).toBe(false);

    let resolveOld!: (value: any) => void;
    mocks.searchDatasetCatalog.mockReturnValueOnce(
      new Promise(resolve => {
        resolveOld = resolve;
      })
    );
    act(() => result.current.setSearchFilters({ period: null, area: 'Recklinghausen' }));
    expect(result.current.searching).toBe(true);
    await flushTimers(300);
    const oldSignal = mocks.searchDatasetCatalog.mock.calls.at(-1)![0].signal;
    expect(result.current.searchIntent).toMatchObject({ area: 'Recklinghausen', period: null });
    act(() => result.current.retrySearch());
    expect(oldSignal.aborted).toBe(true);
    resolveOld({ results: [searchResult()], errors: [] });
    await act(async () => Promise.resolve());
    expect(result.current.searchResults).toEqual([]);
    await flushTimers(300);
    expect(mocks.searchDatasetCatalog).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { period: null, area: 'Recklinghausen' } })
    );
    act(() => result.current.setSearchQuery('Arbeitslose 2026 Deutschland'));
    expect(result.current.searchIntent).toMatchObject({ area: 'Recklinghausen', period: null });
    await flushTimers(300);
    act(() => result.current.setOpen(false));
    expect(mocks.searchDatasetCatalog.mock.calls.at(-1)![0].signal.aborted).toBe(true);
  });

  it('defaults unsupported or absent UI languages to English', () => {
    mocks.language = undefined;
    const absent = renderHook(() => useDataViewDialogModel());
    expect(absent.result.current.open).toBe(false);
    absent.unmount();

    mocks.language = 'es-ES';
    const unsupported = renderHook(() => useDataViewDialogModel());
    expect(unsupported.result.current.open).toBe(false);
  });

  it('restores editing state, refreshes profiles, and reports detail failures', async () => {
    const element: TDataViewElement = {
      type: 'data_view',
      view: 'chart',
      source: {
        kind: 'dataset',
        provider: 'UPLOAD',
        datasetId: 'stored',
        snapshotId: 'stored-snapshot',
        title: 'Stored',
      },
      query: {
        filters: {},
        aggregation: 'sum',
        valueColumns: ['2024'],
      },
      presentation: {},
      children: [{ text: '' }],
    };
    mocks.loadDatasetDetails.mockResolvedValueOnce({ columnProfiles: profiles });
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => openDialog(element));
    await act(async () => Promise.resolve());

    expect(result.current).toMatchObject({
      open: true,
      stage: 'build',
      editingElement: element,
      chartType: 'bar',
    });
    expect(result.current.snapshot).toMatchObject({
      datasetId: 'stored',
      snapshotId: 'stored-snapshot',
      snapshotKey: 'stored-snapshot',
      rowCount: 0,
      byteSize: 0,
    });
    expect(result.current.columnProfiles).toEqual(profiles);

    mocks.loadDatasetDetails.mockRejectedValueOnce(new Error('details failed'));
    act(() => openDialog({ ...element, source: { ...element.source, datasetId: 'broken' } }));
    await act(async () => Promise.resolve());
    expect(result.current.error).toBe('localized:details failed');
    expect(result.current.preparing).toBe(false);
    await flushTimers(500);
    expect(mocks.createDataViewProjection).not.toHaveBeenCalled();

    let resolveDetails!: (value: any) => void;
    mocks.loadDatasetDetails.mockReturnValueOnce(
      new Promise(resolve => {
        resolveDetails = resolve;
      })
    );
    act(() =>
      openDialog({
        ...element,
        source: { ...element.source, datasetId: 'late', snapshotId: undefined as never },
      })
    );
    act(() => openDialog());
    resolveDetails({});
    await act(async () => Promise.resolve());
    expect(result.current.snapshot).toBeNull();
  });

  it('prepares stored, Eurostat, GovData, and Genesis datasets and rejects unavailable sources', async () => {
    mocks.language = 'de-DE';
    const { result, rerender } = renderHook(() => useDataViewDialogModel());
    act(() => openDialog());

    act(() => result.current.setSelectedResult(searchResult({ snapshotId: 'stored-snapshot' })));
    await act(async () => result.current.useSelectedDataset());
    expect(mocks.loadDatasetDetails).toHaveBeenCalled();
    expect(result.current.stage).toBe('build');

    mocks.createProviderSnapshot.mockResolvedValueOnce(
      snapshot({ columnProfiles: undefined, publisher: 'Provider Publisher' })
    );
    act(() => {
      result.current.changeDataset();
      result.current.setSelectedResult(searchResult());
    });
    await act(async () => result.current.useSelectedDataset());
    expect(mocks.createProviderSnapshot).toHaveBeenLastCalledWith(
      { provider: 'EUROSTAT', code: 'demo-code', language: 'de' },
      'token',
      expect.any(AbortSignal)
    );
    expect(result.current.columnProfiles).toEqual(profiles);

    act(() => {
      result.current.changeDataset();
      result.current.setSelectedResult(
        searchResult({ provider: 'GENESIS_DESTATIS', providerDatasetId: 'genesis-de' })
      );
    });
    await act(async () => result.current.useSelectedDataset());
    expect(mocks.createProviderSnapshot).toHaveBeenLastCalledWith(
      { provider: 'GENESIS_DESTATIS', code: 'genesis-de', language: 'de' },
      'token',
      expect.any(AbortSignal)
    );

    act(() => {
      result.current.changeDataset();
      result.current.setSelectedResult(
        searchResult({
          provider: 'GOVDATA',
          providerDatasetId: 'package',
          providerResourceId: 'resource',
        })
      );
    });
    await act(async () => result.current.useSelectedDataset());
    expect(mocks.createProviderSnapshot).toHaveBeenLastCalledWith(
      { provider: 'GOVDATA', packageId: 'package', resourceId: 'resource' },
      'token'
    );

    mocks.language = 'en-US';
    rerender();
    act(() => {
      result.current.changeDataset();
      result.current.setSelectedResult(
        searchResult({ provider: 'GENESIS_DESTATIS', providerDatasetId: 'genesis-code' })
      );
    });
    await act(async () => result.current.useSelectedDataset());
    expect(mocks.createProviderSnapshot).toHaveBeenLastCalledWith(
      { provider: 'GENESIS_DESTATIS', code: 'genesis-code', language: 'en' },
      'token',
      expect.any(AbortSignal)
    );

    act(() => {
      result.current.changeDataset();
      result.current.setSelectedResult(
        searchResult({ provider: 'UPLOAD', providerDatasetId: null })
      );
    });
    await act(async () => result.current.useSelectedDataset());
    expect(result.current.error).toBe('plateJs.dataView.datasetUnavailable');

    mocks.createProviderSnapshot.mockRejectedValueOnce(new Error('prepare failed'));
    act(() => result.current.setSelectedResult(searchResult()));
    await act(async () => result.current.useSelectedDataset());
    expect(result.current.error).toBe('localized:prepare failed');
    expect(result.current.preparing).toBe(false);
  });

  it('falls back from stored and imported profile metadata to selected metadata and empty lists', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => openDialog());

    mocks.loadDatasetDetails.mockResolvedValueOnce({});
    act(() =>
      result.current.setSelectedResult(
        searchResult({ snapshotId: 'stored', columnProfiles: profiles })
      )
    );
    await act(async () => result.current.useSelectedDataset());
    expect(result.current.columnProfiles).toEqual(profiles);

    act(() => result.current.changeDataset());
    mocks.loadDatasetDetails.mockResolvedValueOnce({});
    act(() =>
      result.current.setSelectedResult(
        searchResult({ snapshotId: 'stored-2', columnProfiles: undefined })
      )
    );
    await act(async () => result.current.useSelectedDataset());
    expect(result.current.columnProfiles).toEqual([]);

    act(() => result.current.changeDataset());
    mocks.createProviderSnapshot.mockResolvedValueOnce(snapshot({ columnProfiles: undefined }));
    act(() => result.current.setSelectedResult(searchResult({ columnProfiles: undefined })));
    await act(async () => result.current.useSelectedDataset());
    expect(result.current.columnProfiles).toEqual([]);
  });

  it('projects valid views, rejects incomplete chart queries, and loads filter values once', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => openDialog());
    act(() => result.current.setSelectedResult(searchResult()));
    await act(async () => result.current.useSelectedDataset());
    await flushTimers(250);
    expect(mocks.createDataViewProjection).toHaveBeenCalled();
    expect(result.current.projection).toEqual(projection());

    mocks.loadDatasetColumnValues.mockRejectedValueOnce(new Error('values failed'));
    await act(async () => result.current.loadFilterValues());
    expect(result.current.projectionError).toBe('localized:values failed');
    await act(async () => result.current.loadFilterValues());
    expect(mocks.loadDatasetColumnValues).toHaveBeenCalledWith('snapshot-1', 'Year', '', 'token');
    await act(async () => result.current.loadFilterValues());
    expect(mocks.loadDatasetColumnValues).toHaveBeenCalledTimes(4);

    act(() => result.current.setQuery({ filters: {}, aggregation: 'sum' }));
    await flushTimers(250);
    expect(result.current.projection).toBeNull();

    act(() => {
      result.current.setView('table');
      result.current.setQuery({ filters: {}, aggregation: 'count' });
    });
    mocks.createDataViewProjection.mockResolvedValueOnce(projection('table'));
    await flushTimers(250);
    expect(result.current.projection?.view).toBe('table');

    expect(result.current.filterValuesLoading).toBe(false);

    act(() => {
      result.current.setView('stat');
      result.current.setQuery({ filters: {}, aggregation: 'count' });
    });
    mocks.createDataViewProjection.mockResolvedValueOnce(projection('stat'));
    await flushTimers(250);
    expect(result.current.projection?.view).toBe('stat');

    act(() =>
      result.current.setQuery({
        filters: {},
        aggregation: 'sum',
        measureColumn: 'Value',
      })
    );
    mocks.createDataViewProjection.mockResolvedValueOnce(projection('stat'));
    await flushTimers(250);
    expect(result.current.projection?.view).toBe('stat');
  });

  it('ignores settled projection work after cancellation and reports active projection failures', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => openDialog());
    act(() => result.current.setSelectedResult(searchResult()));
    await act(async () => result.current.useSelectedDataset());

    let rejectProjection!: (error: Error) => void;
    mocks.createDataViewProjection.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectProjection = reject;
      })
    );
    await flushTimers(250);
    act(() => result.current.changeDataset());
    rejectProjection(new Error('ignored projection'));
    await act(async () => Promise.resolve());
    expect(result.current.projectionError).toBeNull();

    act(() => result.current.setSelectedResult(searchResult()));
    await act(async () => result.current.useSelectedDataset());
    let resolveProjection!: (value: DataViewProjection) => void;
    mocks.createDataViewProjection.mockReturnValueOnce(
      new Promise(resolve => {
        resolveProjection = resolve;
      })
    );
    await flushTimers(250);
    act(() => result.current.changeDataset());
    resolveProjection(projection());
    await act(async () => Promise.resolve());
    expect(result.current.projection).toBeNull();

    act(() => result.current.setSelectedResult(searchResult()));
    await act(async () => result.current.useSelectedDataset());
    mocks.createDataViewProjection.mockRejectedValueOnce(new Error('projection failed'));
    await flushTimers(250);
    expect(result.current.projectionError).toBe('localized:projection failed');
    expect(result.current.projectionLoading).toBe(false);
  });

  it('validates upload permissions, group, manual data, file presence, and upload failures', async () => {
    mocks.context.canUploadDatasets = false;
    const { result, rerender } = renderHook(() => useDataViewDialogModel());
    await act(async () => result.current.submitUpload());
    expect(result.current.uploadError).toBe('plateJs.dataView.uploadPermission');

    mocks.context.canUploadDatasets = true;
    rerender();
    await act(async () => result.current.submitUpload());
    expect(result.current.uploadError).toBe('plateJs.dataView.uploadGroupRequired');

    act(() => {
      result.current.setUploadGroupId('group-1');
      result.current.setUploadMode('manual');
    });
    await act(async () => result.current.submitUpload());
    expect(result.current.uploadError).toBe('plateJs.dataView.manualTitleRequired');

    act(() => result.current.setUploadTitle('Manual'));
    await act(async () => result.current.submitUpload());
    expect(result.current.uploadError).toBe('plateJs.dataView.manualDataRequired');
    act(() => result.current.setManualTable({ columns: ['Category', 'Value'], rows: [{}] }));
    await act(async () => result.current.submitUpload());
    expect(result.current.uploadError).toBe('plateJs.dataView.manualDataRequired');

    act(() => {
      result.current.setUploadMode('file');
      result.current.setUploadTitle('');
    });
    await act(async () => result.current.submitUpload());
    expect(result.current.uploadError).toBe('plateJs.dataView.fileRequired');

    const firstFile = new File(['a,b'], 'first.csv', { type: 'text/csv' });
    const secondFile = new File(['c,d'], 'second.csv', { type: 'text/csv' });
    act(() => result.current.setUploadFile(firstFile));
    expect(result.current.uploadTitle).toBe('first');
    act(() => result.current.setUploadTitle('Custom'));
    act(() => result.current.setUploadFile(secondFile));
    expect(result.current.uploadTitle).toBe('Custom');
    act(() => result.current.setUploadTitle('   '));

    mocks.uploadDataset.mockRejectedValueOnce(new Error('upload failed'));
    await act(async () => result.current.submitUpload());
    expect(result.current.uploadError).toBe('localized:upload failed');
    expect(result.current.uploading).toBe(false);
    expect(mocks.uploadDataset).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'second.csv' }),
      'token'
    );
  });

  it('uploads manual data, derives publisher fallbacks, and guards modal closure while uploading', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => {
      result.current.setUploadOpen(true);
      result.current.setUploadGroupId('group-1');
      result.current.setUploadMode('manual');
      result.current.setUploadTitle('Manual');
      result.current.setUploadDescription(' Description ');
      result.current.setManualTable({
        columns: ['Category', 'Value'],
        rows: [{ Category: 'A', Value: '1' }],
      });
    });

    let resolveUpload!: (value: DatasetSnapshotImportResult) => void;
    mocks.uploadDataset.mockReturnValueOnce(
      new Promise(resolve => {
        resolveUpload = resolve;
      })
    );
    let uploadPromise!: Promise<void>;
    act(() => {
      uploadPromise = result.current.submitUpload();
    });
    expect(result.current.uploading).toBe(true);
    act(() => result.current.setUploadOpen(false));
    expect(result.current.uploadOpen).toBe(true);
    resolveUpload(snapshot({ provider: 'UPLOAD', publisher: null, sourceUrl: null }));
    await act(async () => uploadPromise);

    expect(mocks.uploadDataset).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'group-1',
        title: 'Manual',
        description: 'Description',
        file: expect.objectContaining({ name: 'Manual.csv' }),
      }),
      'token'
    );
    expect(result.current.selectedResult?.publisher).toBe('Group One');
    expect(result.current.uploadOpen).toBe(false);

    act(() => {
      result.current.setUploadOpen(true);
      result.current.setUploadMode('file');
      result.current.setUploadGroupId('group-1');
      result.current.setUploadFile(new File(['a,b'], 'fallback.csv', { type: 'text/csv' }));
      result.current.setUploadTitle(' ');
      result.current.setUploadDescription(' ');
    });
    mocks.uploadDataset.mockResolvedValueOnce(
      snapshot({ provider: 'UPLOAD', publisher: 'Publisher', sourceUrl: null })
    );
    await act(async () => result.current.submitUpload());
    expect(mocks.uploadDataset).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'fallback.csv', description: '' }),
      'token'
    );
    expect(result.current.selectedResult?.description).toBeNull();
  });

  it('guards saves, inserts and edits nodes, reports missing paths, and catches editor failures', async () => {
    const { result } = renderHook(() => useDataViewDialogModel());
    act(() => result.current.save());
    expect(mocks.insertNodes).not.toHaveBeenCalled();

    act(() => openDialog());
    act(() => result.current.setSelectedResult(searchResult()));
    await act(async () => result.current.useSelectedDataset());
    await flushTimers(250);
    act(() => result.current.save());
    expect(mocks.insertNodes).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'data_view', chartType: 'line' })
    );
    await flushTimers(0);
    expect(mocks.focus).toHaveBeenCalled();

    const element = mocks.insertNodes.mock.calls[0][0] as TDataViewElement;
    mocks.findPath.mockReturnValueOnce(undefined);
    act(() => openDialog(element));
    await act(async () => Promise.resolve());
    await flushTimers(250);
    act(() => result.current.save());
    expect(result.current.error).toBe('plateJs.dataView.elementMissing');
    expect(mocks.toastError).toHaveBeenCalledWith('plateJs.dataView.elementMissing');

    mocks.findPath.mockReturnValueOnce([0]);
    act(() => result.current.save());
    expect(mocks.setNodes).toHaveBeenCalled();

    mocks.createDataViewProjection.mockResolvedValueOnce(projection('table'));
    act(() => {
      result.current.setOpen(true);
      result.current.setView('table');
    });
    expect(result.current.canInsert).toBe(false);
    await flushTimers(250);
    act(() => result.current.save());
    expect(mocks.setNodes).toHaveBeenCalledWith(
      expect.objectContaining({ chartType: undefined }),
      expect.anything()
    );

    mocks.createDataViewProjection.mockResolvedValueOnce(projection('table'));
    act(() => result.current.setOpen(true));
    await flushTimers(250);
    mocks.setNodes.mockImplementationOnce(() => {
      throw new Error('editor failed');
    });
    act(() => result.current.save());
    expect(result.current.error).toBe('localized:editor failed');
  });
});
