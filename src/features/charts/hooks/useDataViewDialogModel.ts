import * as React from 'react';
import { useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { useCurrentUserActiveGroups } from '@/zero/groups/useGroupState';
import {
  createDataViewProjection,
  createProviderSnapshot,
  loadDatasetColumnValues,
  loadDatasetDetails,
  searchDatasetCatalog,
  uploadDataset,
} from '../api/datasetClient';
import { useChartDatasetContext } from '../context/ChartDatasetContext';
import {
  getDataViewTitle,
  getFilterableProfiles,
  getValueColumnLayout,
  inferDataViewConfiguration,
  serializeDatasetTable,
} from '../logic/dataView';
import type { ParsedChartTable } from '../logic/chartData';
import type {
  ChartPresentation,
  ChartType,
  DataViewKind,
  DataViewProjection,
  DataViewQuery,
  DatasetColumnProfile,
  DatasetProviderError,
  DatasetProviderId,
  DatasetSearchResult,
  DatasetSnapshotImportResult,
  TDataViewElement,
} from '../types';
import { OPEN_DATA_VIEW_DIALOG_EVENT } from '../ui/chartDialogEvents';
import { localizeAppError } from '@/features/shared/errors/app-error';

const ALL_PROVIDERS: DatasetProviderId[] = ['EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA', 'UPLOAD'];

function createEmptyManualTable(
  t: (key: 'plateJs.dataView.manualCategoryColumn' | 'plateJs.dataView.manualValueColumn') => string
): ParsedChartTable {
  const category = t('plateJs.dataView.manualCategoryColumn');
  const value = t('plateJs.dataView.manualValueColumn');
  return {
    columns: [category, value],
    rows: [
      { [category]: '', [value]: '' },
      { [category]: '', [value]: '' },
      { [category]: '', [value]: '' },
    ],
  };
}

function emptyPresentation(): ChartPresentation {
  return {
    title: '',
    description: '',
    showLegend: true,
    showGrid: true,
    showTooltip: true,
    donut: false,
  };
}

function snapshotFromStoredResult(
  result: DatasetSearchResult,
  profiles: DatasetColumnProfile[]
): DatasetSnapshotImportResult {
  const snapshotId = result.snapshotId ?? result.snapshotKey ?? result.id;
  return {
    datasetId: result.id,
    snapshotId,
    snapshotKey: result.snapshotKey ?? snapshotId,
    provider: result.provider,
    title: result.title,
    columns: profiles.map(profile => profile.name),
    columnProfiles: profiles,
    rows: [],
    rowCount: result.rowCount ?? 0,
    columnCount: result.columnCount ?? profiles.length,
    byteSize: result.byteSize ?? 0,
    snapshotTakenAt: result.snapshotTakenAt ?? new Date().toISOString(),
    publisher: result.publisher,
    sourceUrl: result.sourceUrl,
  };
}

export function useDataViewDialogModel() {
  const editor = useEditorRef();
  const { session } = useAuth();
  const { i18n, t } = useTranslation();
  const {
    defaultGroupId,
    canViewDatasets = false,
    canManageDatasets = false,
    canUploadDatasets = false,
  } = useChartDatasetContext();
  const { groups: uploadGroups, isLoading: uploadGroupsLoading } = useCurrentUserActiveGroups();
  const language = ['de', 'fr'].includes(i18n.resolvedLanguage?.split('-')[0] ?? '')
    ? (i18n.resolvedLanguage?.split('-')[0] as 'de' | 'fr')
    : 'en';

  const [open, setOpen] = React.useState(false);
  const [stage, setStage] = React.useState<'find' | 'build'>('find');
  const [editingElement, setEditingElement] = React.useState<TDataViewElement>();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [providers, setProviders] = React.useState<DatasetProviderId[]>(ALL_PROVIDERS);
  const [searchResults, setSearchResults] = React.useState<DatasetSearchResult[]>([]);
  const [providerErrors, setProviderErrors] = React.useState<DatasetProviderError[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selectedResult, setSelectedResult] = React.useState<DatasetSearchResult | null>(null);
  const [preparing, setPreparing] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<DatasetSnapshotImportResult | null>(null);
  const [columnProfiles, setColumnProfiles] = React.useState<DatasetColumnProfile[]>([]);
  const [view, setViewState] = React.useState<DataViewKind>('chart');
  const [query, setQuery] = React.useState<DataViewQuery>({
    filters: {},
    aggregation: 'sum',
    limit: 10,
  });
  const [chartType, setChartType] = React.useState<ChartType>('bar');
  const [presentation, setPresentation] = React.useState<ChartPresentation>(emptyPresentation);
  const [projection, setProjection] = React.useState<DataViewProjection | null>(null);
  const [projectionLoading, setProjectionLoading] = React.useState(false);
  const [projectionError, setProjectionError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filterValues, setFilterValues] = React.useState<Record<string, string[]>>({});
  const [filterValuesLoading, setFilterValuesLoading] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadGroupId, setUploadGroupId] = React.useState('');
  const [uploadMode, setUploadMode] = React.useState<'file' | 'manual'>('file');
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = React.useState('');
  const [uploadDescription, setUploadDescription] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [manualTable, setManualTable] = React.useState<ParsedChartTable>(() =>
    createEmptyManualTable(t)
  );

  const resetDialog = React.useCallback(
    (element?: TDataViewElement) => {
      setEditingElement(element);
      setError(null);
      setProjectionError(null);
      setProviderErrors([]);
      setSearchResults([]);
      setSelectedResult(null);
      setFilterValues({});
      setUploadOpen(false);
      setUploadGroupId('');
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      setUploadError(null);
      setManualTable(createEmptyManualTable(t));

      if (!element) {
        setStage('find');
        setSearchQuery('');
        setSnapshot(null);
        setColumnProfiles([]);
        setViewState('chart');
        setQuery({ filters: {}, aggregation: 'sum', limit: 10 });
        setChartType('bar');
        setPresentation(emptyPresentation());
        setProjection(null);
        return;
      }

      const source = element.source;
      setStage('build');
      setSearchQuery(source.title);
      setSelectedResult({
        id: source.datasetId,
        provider: source.provider,
        providerDatasetId: source.providerDatasetId,
        providerResourceId: source.providerResourceId,
        title: source.title,
        publisher: source.publisher,
        sourceUrl: source.sourceUrl,
        license: source.license,
        snapshotId: source.snapshotId,
        snapshotKey: source.snapshotKey,
        snapshotTakenAt: source.snapshotTakenAt,
        groupId: source.groupId,
      });
      setSnapshot(
        snapshotFromStoredResult(
          {
            id: source.datasetId,
            provider: source.provider,
            title: source.title,
            publisher: source.publisher,
            sourceUrl: source.sourceUrl,
            snapshotId: source.snapshotId,
            snapshotKey: source.snapshotKey,
            snapshotTakenAt: source.snapshotTakenAt,
          },
          []
        )
      );
      setColumnProfiles([]);
      setViewState(element.view);
      setQuery(element.query);
      setChartType(element.chartType ?? 'bar');
      setPresentation(element.presentation);
      setProjection(null);

      void loadDatasetDetails(source.datasetId, session?.access_token)
        .then(details => {
          const profiles = details.columnProfiles ?? [];
          setColumnProfiles(profiles);
          setQuery(current => {
            if (!current.valueColumns?.length) return current;
            return {
              ...current,
              layout: getValueColumnLayout(profiles, current.valueColumns),
            };
          });
          setSnapshot(current =>
            current
              ? {
                  ...current,
                  columns: profiles.map(profile => profile.name),
                  columnProfiles: profiles,
                }
              : current
          );
        })
        .catch(loadError => setError(localizeAppError(loadError)));
    },
    [session?.access_token, t]
  );

  React.useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ element?: TDataViewElement }>).detail;
      resetDialog(detail?.element);
      setOpen(true);
    };
    window.addEventListener(OPEN_DATA_VIEW_DIALOG_EVENT, listener);
    return () => window.removeEventListener(OPEN_DATA_VIEW_DIALOG_EVENT, listener);
  }, [resetDialog]);

  React.useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (!open || stage !== 'find' || normalizedQuery.length < 2 || providers.length === 0) {
      setSearchResults([]);
      setProviderErrors([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setSearching(true);
      void searchDatasetCatalog({
        query: normalizedQuery,
        providers,
        groupId: canViewDatasets ? defaultGroupId : null,
        language,
        accessToken: session?.access_token,
      })
        .then(result => {
          if (cancelled) return;
          setSearchResults(result.results);
          setProviderErrors(result.errors);
        })
        .catch(searchError => {
          if (!cancelled) setError(localizeAppError(searchError));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    canViewDatasets,
    defaultGroupId,
    language,
    open,
    providers,
    searchQuery,
    session?.access_token,
    stage,
  ]);

  const activateSnapshot = React.useCallback(
    (nextSnapshot: DatasetSnapshotImportResult, result: DatasetSearchResult) => {
      const profiles = nextSnapshot.columnProfiles ?? result.columnProfiles ?? [];
      const inferred = inferDataViewConfiguration(profiles);
      setSnapshot(nextSnapshot);
      setSelectedResult({
        ...result,
        id: nextSnapshot.datasetId,
        snapshotId: nextSnapshot.snapshotId,
        snapshotKey: nextSnapshot.snapshotKey,
        snapshotTakenAt: nextSnapshot.snapshotTakenAt,
        rowCount: nextSnapshot.rowCount,
        columnCount: nextSnapshot.columnCount,
        byteSize: nextSnapshot.byteSize,
        columnProfiles: profiles,
        publisher: nextSnapshot.publisher ?? result.publisher,
        sourceUrl: nextSnapshot.sourceUrl ?? result.sourceUrl,
      });
      setColumnProfiles(profiles);
      setViewState('chart');
      setQuery(inferred.query);
      setChartType(inferred.chartType);
      setPresentation({
        ...inferred.presentation,
        title: getDataViewTitle({
          datasetTitle: result.title,
          measureLabel: profiles.find(profile => profile.name === inferred.query.measureColumn)
            ?.label,
          dimensionLabel: profiles.find(profile => profile.name === inferred.query.dimensionColumn)
            ?.label,
          view: 'chart',
        }),
      });
      setProjection(null);
      setStage('build');
      setError(null);
    },
    []
  );

  const useSelectedDataset = React.useCallback(async () => {
    if (!selectedResult) return;
    setPreparing(true);
    setError(null);
    try {
      let result: DatasetSnapshotImportResult;
      if (selectedResult.snapshotId) {
        const details = await loadDatasetDetails(selectedResult.id, session?.access_token);
        const profiles = details.columnProfiles ?? selectedResult.columnProfiles ?? [];
        result = snapshotFromStoredResult(
          { ...selectedResult, ...details, snapshotId: selectedResult.snapshotId },
          profiles
        );
      } else if (selectedResult.provider === 'EUROSTAT' && selectedResult.providerDatasetId) {
        result = await createProviderSnapshot(
          { provider: 'EUROSTAT', code: selectedResult.providerDatasetId, language },
          session?.access_token
        );
      } else if (
        selectedResult.provider === 'GOVDATA' &&
        selectedResult.providerDatasetId &&
        selectedResult.providerResourceId
      ) {
        result = await createProviderSnapshot(
          {
            provider: 'GOVDATA',
            packageId: selectedResult.providerDatasetId,
            resourceId: selectedResult.providerResourceId,
          },
          session?.access_token
        );
      } else if (
        selectedResult.provider === 'GENESIS_DESTATIS' &&
        selectedResult.providerDatasetId
      ) {
        result = await createProviderSnapshot(
          {
            provider: 'GENESIS_DESTATIS',
            code: selectedResult.providerDatasetId,
            language: language === 'de' ? 'de' : 'en',
          },
          session?.access_token
        );
      } else {
        setError(t('plateJs.dataView.datasetUnavailable'));
        return;
      }
      activateSnapshot(result, selectedResult);
    } catch (prepareError) {
      setError(localizeAppError(prepareError));
    } finally {
      setPreparing(false);
    }
  }, [activateSnapshot, language, selectedResult, session?.access_token, t]);

  const setView = React.useCallback(
    (nextView: DataViewKind) => {
      setViewState(nextView);
      const measureLabel = columnProfiles.find(
        profile => profile.name === query.measureColumn
      )?.label;
      const dimensionLabel = columnProfiles.find(
        profile => profile.name === query.dimensionColumn
      )?.label;
      if (selectedResult) {
        setPresentation(current => ({
          ...current,
          title: getDataViewTitle({
            datasetTitle: selectedResult.title,
            measureLabel,
            dimensionLabel,
            view: nextView,
          }),
        }));
      }
    },
    [columnProfiles, query.dimensionColumn, query.measureColumn, selectedResult]
  );

  React.useEffect(() => {
    if (!open || stage !== 'build' || !snapshot) return;
    const valid =
      view === 'table' ||
      (view === 'chart' &&
        Boolean(query.dimensionColumn) &&
        (query.aggregation === 'count' || Boolean(query.measureColumn))) ||
      (view === 'stat' && (query.aggregation === 'count' || Boolean(query.measureColumn)));
    if (!valid) {
      setProjection(null);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setProjectionLoading(true);
      setProjectionError(null);
      void createDataViewProjection(
        { snapshotId: snapshot.snapshotId, view, ...query },
        session?.access_token
      )
        .then(result => {
          if (!cancelled) setProjection(result);
        })
        .catch(projectionFailure => {
          if (cancelled) return;
          setProjection(null);
          setProjectionError(localizeAppError(projectionFailure));
        })
        .finally(() => {
          if (!cancelled) setProjectionLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, query, session?.access_token, snapshot, stage, view]);

  const loadFilterValues = React.useCallback(async () => {
    if (!snapshot || filterValuesLoading) return;
    const profiles = getFilterableProfiles(columnProfiles).filter(
      profile => filterValues[profile.name] == null
    );
    if (profiles.length === 0) return;
    setFilterValuesLoading(true);
    try {
      const entries = await Promise.all(
        profiles.map(
          async profile =>
            [
              profile.name,
              await loadDatasetColumnValues(
                snapshot.snapshotId,
                profile.name,
                '',
                session?.access_token
              ),
            ] as const
        )
      );
      setFilterValues(current => ({ ...current, ...Object.fromEntries(entries) }));
    } catch (loadError) {
      setProjectionError(localizeAppError(loadError));
    } finally {
      setFilterValuesLoading(false);
    }
  }, [columnProfiles, filterValues, filterValuesLoading, session?.access_token, snapshot]);

  const submitUpload = React.useCallback(async () => {
    if (!canUploadDatasets || !session?.user) {
      setUploadError(t('plateJs.dataView.uploadPermission'));
      return;
    }
    const uploadGroup = uploadGroups.find(group => group.id === uploadGroupId);
    if (!uploadGroupId || !uploadGroup) {
      setUploadError(t('plateJs.dataView.uploadGroupRequired'));
      return;
    }
    let file = uploadFile;
    if (uploadMode === 'manual') {
      if (!uploadTitle.trim()) {
        setUploadError(t('plateJs.dataView.manualTitleRequired'));
        return;
      }
      const hasValues = manualTable.rows.some(row =>
        manualTable.columns.some(column => String(row[column] ?? '').trim())
      );
      if (!hasValues) {
        setUploadError(t('plateJs.dataView.manualDataRequired'));
        return;
      }
      file = new File(
        [serializeDatasetTable(manualTable.columns, manualTable.rows)],
        `${uploadTitle.trim()}.csv`,
        { type: 'text/csv' }
      );
    }
    if (!file) {
      setUploadError(t('plateJs.dataView.fileRequired'));
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadDataset(
        {
          file,
          groupId: uploadGroupId,
          title: uploadTitle.trim() || file.name,
          description: uploadDescription.trim(),
        },
        session?.access_token
      );
      const searchResult: DatasetSearchResult = {
        id: result.datasetId,
        provider: 'UPLOAD',
        providerDatasetId: file.name,
        title: uploadTitle.trim() || file.name,
        description: uploadDescription.trim() || null,
        publisher: result.publisher || uploadGroup.name,
        sourceUrl: result.sourceUrl,
        snapshotId: result.snapshotId,
        snapshotKey: result.snapshotKey,
        snapshotTakenAt: result.snapshotTakenAt,
        rowCount: result.rowCount,
        columnCount: result.columnCount,
        byteSize: result.byteSize,
        groupId: uploadGroupId,
        columnProfiles: result.columnProfiles,
      };
      setUploadOpen(false);
      activateSnapshot(result, searchResult);
    } catch (uploadError) {
      setUploadError(localizeAppError(uploadError));
    } finally {
      setUploading(false);
    }
  }, [
    activateSnapshot,
    canUploadDatasets,
    manualTable,
    session?.access_token,
    t,
    uploadDescription,
    uploadFile,
    uploadGroupId,
    uploadGroups,
    uploadMode,
    uploadTitle,
  ]);

  const save = React.useCallback(() => {
    if (!snapshot || !selectedResult || !projection) return;
    const node: TDataViewElement = {
      type: 'data_view',
      view,
      source: {
        kind: 'dataset',
        provider: snapshot.provider,
        datasetId: snapshot.datasetId,
        snapshotId: snapshot.snapshotId,
        snapshotKey: snapshot.snapshotKey,
        title: selectedResult.title,
        providerDatasetId: selectedResult.providerDatasetId,
        providerResourceId: selectedResult.providerResourceId,
        publisher: selectedResult.publisher,
        sourceUrl: selectedResult.sourceUrl,
        license: selectedResult.license,
        snapshotTakenAt: snapshot.snapshotTakenAt,
        groupId: selectedResult.groupId,
      },
      query,
      chartType: view === 'chart' ? chartType : undefined,
      presentation,
      children: [{ text: '' }],
    };

    try {
      if (editingElement) {
        const path = editor.api.findPath(editingElement);
        if (!path) {
          const message = t('plateJs.dataView.elementMissing');
          setError(message);
          toast.error(message);
          return;
        }
        editor.tf.setNodes(node, { at: path });
      } else {
        editor.tf.insertNodes(node);
      }
      setOpen(false);
      window.setTimeout(() => editor.tf.focus(), 0);
    } catch (saveError) {
      const message = localizeAppError(saveError);
      setError(message);
      toast.error(message);
    }
  }, [
    chartType,
    editingElement,
    editor,
    presentation,
    projection,
    query,
    selectedResult,
    snapshot,
    t,
    view,
  ]);

  const numericProfiles = columnProfiles.filter(profile => profile.role === 'measure');
  const dimensionProfiles = columnProfiles.filter(profile => profile.role !== 'measure');
  const filterableProfiles = getFilterableProfiles(columnProfiles);
  const activeFilterCount = Object.values(query.filters).filter(Boolean).length;
  const canInsert = Boolean(snapshot && projection && !projectionLoading && !projectionError);

  return {
    open,
    setOpen,
    stage,
    editingElement,
    searchQuery,
    setSearchQuery,
    providers,
    setProviders,
    searchResults,
    providerErrors,
    searching,
    selectedResult,
    setSelectedResult,
    preparing,
    snapshot,
    columnProfiles,
    numericProfiles,
    dimensionProfiles,
    filterableProfiles,
    view,
    setView,
    query,
    setQuery,
    chartType,
    setChartType,
    presentation,
    setPresentation,
    projection,
    projectionLoading,
    projectionError,
    error,
    setError,
    filterValues,
    filterValuesLoading,
    activeFilterCount,
    loadFilterValues,
    useSelectedDataset,
    changeDataset: () => {
      setStage('find');
      setSelectedResult(null);
      setSnapshot(null);
      setProjection(null);
      setError(null);
    },
    uploadOpen,
    setUploadOpen: (nextOpen: boolean) => {
      if (uploading && !nextOpen) return;
      if (nextOpen) setUploadGroupId('');
      setUploadOpen(nextOpen);
      setUploadError(null);
    },
    uploadMode,
    setUploadMode: (nextMode: 'file' | 'manual') => {
      setUploadMode(nextMode);
      setUploadError(null);
    },
    uploadFile,
    uploadGroupId,
    setUploadGroupId: (groupId: string) => {
      setUploadGroupId(groupId);
      setUploadError(null);
    },
    uploadGroups,
    uploadGroupsLoading,
    setUploadFile: (file: File | null) => {
      const previousAutomaticTitle = uploadFile?.name.replace(/\.[^.]+$/, '') ?? '';
      setUploadFile(file);
      setUploadError(null);
      if (file) {
        const nextAutomaticTitle = file.name.replace(/\.[^.]+$/, '');
        setUploadTitle(current =>
          !current.trim() || current === previousAutomaticTitle ? nextAutomaticTitle : current
        );
      }
    },
    uploadTitle,
    setUploadTitle,
    uploadDescription,
    setUploadDescription,
    uploading,
    uploadError,
    setUploadError,
    manualTable,
    setManualTable,
    submitUpload,
    selectedUploadGroupName: uploadGroups.find(group => group.id === uploadGroupId)?.name ?? null,
    canManageDatasets: Boolean(defaultGroupId && canManageDatasets),
    canUploadDatasets: Boolean(session?.user && canUploadDatasets),
    canInsert,
    save,
  };
}

export type DataViewDialogModel = ReturnType<typeof useDataViewDialogModel>;
