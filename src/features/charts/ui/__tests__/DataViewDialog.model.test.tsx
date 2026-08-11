/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDataViewDialogModel } from '../../hooks/useDataViewDialogModel';
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
  mocks.createDataViewProjection.mockResolvedValue(projection());
  mocks.loadDatasetColumnValues.mockResolvedValue(['A', 'B']);
  mocks.uploadDataset.mockResolvedValue(snapshot({ provider: 'UPLOAD', publisher: null }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useDataViewDialogModel boundaries', () => {
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
    expect(result.current.error).toBe('localized:search failed');
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
      'token'
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
      'token'
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
      'token'
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

    act(() => result.current.setView('table'));
    act(() => result.current.save());
    expect(mocks.setNodes).toHaveBeenCalledWith(
      expect.objectContaining({ chartType: undefined }),
      expect.anything()
    );

    mocks.setNodes.mockImplementationOnce(() => {
      throw new Error('editor failed');
    });
    act(() => result.current.save());
    expect(result.current.error).toBe('localized:editor failed');
  });
});
