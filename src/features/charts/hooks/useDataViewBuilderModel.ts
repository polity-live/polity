import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { useCurrentUserActiveGroups } from '@/zero/groups/useGroupState';
import {
  createDataViewProjection,
  createProviderSnapshot,
  prepareProviderDataset,
  loadDatasetColumnValues,
  loadDatasetDetails,
  loadDatasetPreview,
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
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetTableSelection,
  DatasetColumnProfile,
  DatasetProviderError,
  DatasetProviderId,
  DatasetSearchResult,
  DatasetSnapshotImportResult,
  DatasetPreparation,
  DatasetImportFilters,
  DatasetSearchIntent,
  TDataViewElement,
} from '../types';
import { canRecoverDatasetFile } from '../logic/datasetRawDownload';
import { localizeAppError } from '@/features/shared/errors/app-error';
import { DataViewInsertionError } from '../logic/dataViewInsertion';
import { interpretDatasetSearch } from '../logic/datasetSearch';
import { applyDatasetTableSelection } from '../logic/datasetTableSelection';
import { applyDatasetSearchIntent, requiredProviderDimensions } from '../logic/providerDataView';
import {
  sameDatasetSelection,
  datasetMeasureOptions,
  selectedDatasetMeasure,
} from '../logic/datasetSelection';
import type { DatasetSearchFilters } from '../types';
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
    providerDatasetId: result.providerDatasetId,
    providerResourceId: result.providerResourceId,
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
    provenance: result.metadata,
  };
}
export interface DataViewBuilderOptions {
  onInsert: (
    configuration: TDataViewElement,
    projection: DataViewProjection,
    editingElement: TDataViewElement | null
  ) => void;
  validate?: (projection: DataViewProjection, chartType: ChartType) => string | null;
  canInsert?: boolean;
}
export function useDataViewBuilderModel(options: DataViewBuilderOptions) {
  const { session } = useAuth();
  const { i18n, t } = useTranslation();
  const {
    defaultGroupId,
    canViewDatasets = false,
    canManageDatasets = false,
    canUploadDatasets = false,
  } = useChartDatasetContext();
  const { groups: uploadGroups, isLoading: uploadGroupsLoading } = useCurrentUserActiveGroups();
  const language: 'de' | 'en' | 'fr' = ['de', 'fr'].includes(
    i18n.resolvedLanguage?.split('-')[0] ?? ''
  )
    ? (i18n.resolvedLanguage?.split('-')[0] as 'de' | 'fr')
    : 'en';
  const [open, setOpenState] = React.useState(false);
  const openRef = React.useRef(false);
  const requestVersion = React.useRef(0);
  const [stage, setStage] = React.useState<'find' | 'prepare' | 'build'>('find');
  const [datasetExplorerOpen, setDatasetExplorerOpen] = React.useState(false);
  const pendingTableSelection = React.useRef<DatasetTableSelection | null>(null);
  const datasetAbort = React.useRef<AbortController | null>(null);
  const chosenIntent = React.useRef<DatasetSearchIntent | null>(null);
  const [preparation, setPreparation] = React.useState<DatasetPreparation | null>(null);
  const [importFilters, setImportFilters] = React.useState<DatasetImportFilters>({});
  const [restrictImport, setRestrictImport] = React.useState(true);
  const [editingElement, setEditingElement] = React.useState<TDataViewElement>();
  const [searchQuery, setSearchQueryState] = React.useState('');
  const [searchFilters, setSearchFilters] = React.useState<DatasetSearchFilters>({});
  const [searchRevision, setSearchRevision] = React.useState(0);
  const searchIntent = React.useMemo(
    () => interpretDatasetSearch(searchQuery, searchFilters),
    [searchQuery, searchFilters]
  );
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
  const [dataPreview, setDataPreview] = React.useState<DatasetPreview | null>(null);
  const [dataPreviewLoading, setDataPreviewLoading] = React.useState(false);
  const [dataPreviewError, setDataPreviewError] = React.useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = React.useState(0);
  const [projectionError, setProjectionError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [errorDownloadAvailable, setErrorDownloadAvailable] = React.useState(false);
  const [sampleDownloadAvailable, setSampleDownloadAvailable] = React.useState(false);
  const [projectionDownloadAvailable, setProjectionDownloadAvailable] = React.useState(false);
  const [uploadDownloadAvailable, setUploadDownloadAvailable] = React.useState(false);
  const [rejectedUploadFile, setRejectedUploadFile] = React.useState<File | null>(null);
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
  const setSearchQuery = React.useCallback((value: string) => {
    setSearchQueryState(value);
    setSelectedResult(null);
  }, []);
  const invalidateDatasetLoads = React.useCallback(() => {
    datasetAbort.current?.abort();
    requestVersion.current += 1;
    setPreparing(false);
    setProjectionLoading(false);
    setFilterValuesLoading(false);
    setUploading(false);
  }, []);
  const setOpen = React.useCallback(
    (next: React.SetStateAction<boolean>) => {
      const nextOpen = typeof next === 'function' ? next(openRef.current) : next;
      openRef.current = nextOpen;
      if (!nextOpen) invalidateDatasetLoads();
      setOpenState(nextOpen);
    },
    [invalidateDatasetLoads]
  );
  React.useEffect(() => {
    return () => {
      datasetAbort.current?.abort();
      requestVersion.current += 1;
    };
  }, []);
  const resetDialog = React.useCallback(
    (element?: TDataViewElement) => {
      invalidateDatasetLoads();
      const version = requestVersion.current;
      setEditingElement(element);
      setError(null);
      setErrorDownloadAvailable(false);
      setProjectionError(null);
      setProjectionDownloadAvailable(false);
      setProviderErrors([]);
      setSearchResults([]);
      setSearchFilters({});
      setSelectedResult(null);
      setDatasetExplorerOpen(false);
      pendingTableSelection.current = null;
      setPreparation(null);
      chosenIntent.current = null;
      setFilterValues({});
      setUploadOpen(false);
      setUploadGroupId('');
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      setUploadError(null);
      setUploadDownloadAvailable(false);
      setRejectedUploadFile(null);
      setManualTable(createEmptyManualTable(t));
      if (!element) {
        setStage('find');
        setSearchQueryState('');
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
      setSearchQueryState(source.title);
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
        timeCoverage: source.dataPeriod,
      });
      const editingSnapshot = snapshotFromStoredResult(
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
      );
      setSnapshot(editingSnapshot);
      setColumnProfiles([]);
      setViewState(element.view);
      setQuery(element.query);
      setChartType(element.chartType ?? 'bar');
      setPresentation(element.presentation);
      setProjection(null);
      setPreparing(true);
      const controller = new AbortController();
      datasetAbort.current = controller;
      void loadDatasetDetails(
        source.datasetId,
        session?.access_token,
        source.snapshotId,
        controller.signal
      )
        .then(details => {
          if (version !== requestVersion.current) return;
          if (
            !sameDatasetSelection(source, { ...details, datasetId: details.id }) ||
            details.snapshotId !== source.snapshotId
          )
            throw new Error(t('plateJs.dataView.selectionMismatch'));
          const profiles = details.columnProfiles ?? [];
          setColumnProfiles(profiles);
          setQuery(current => {
            if (!current.valueColumns?.length) return current;
            return {
              ...current,
              layout: getValueColumnLayout(profiles, current.valueColumns),
            };
          });
          setSnapshot({
            ...editingSnapshot,
            columns: profiles.map(profile => profile.name),
            columnProfiles: profiles,
            provenance: details.metadata,
            providerResourceId: details.providerResourceId,
          });
        })
        .catch(loadError => {
          if (version !== requestVersion.current) return;
          setSnapshot(null);
          setError(localizeAppError(loadError));
          setErrorDownloadAvailable(canRecoverDatasetFile(loadError));
        })
        .finally(() => {
          if (version === requestVersion.current) setPreparing(false);
        });
    },
    [invalidateDatasetLoads, session?.access_token, t]
  );
  React.useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (!open || stage !== 'find' || searchIntent.topic.length < 2 || providers.length === 0) {
      setSearchResults([]);
      setProviderErrors([]);
      setSearching(false);
      if (open && stage === 'find') {
        setError(null);
        setErrorDownloadAvailable(false);
      }
      if (open && stage === 'find' && providers.length === 0) setSelectedResult(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setSearching(true);
    setSearchResults([]);
    setSelectedResult(null);
    setProviderErrors([]);
    setError(null);
    setErrorDownloadAvailable(false);
    const timeout = window.setTimeout(() => {
      void searchDatasetCatalog({
        query: normalizedQuery,
        providers,
        groupId: canViewDatasets ? defaultGroupId : null,
        language,
        accessToken: session?.access_token,
        filters: searchFilters,
        signal: controller.signal,
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
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [
    canViewDatasets,
    defaultGroupId,
    language,
    open,
    providers,
    searchQuery,
    searchFilters,
    searchIntent.topic,
    searchRevision,
    session?.access_token,
    stage,
  ]);
  const activateSnapshot = React.useCallback(
    (nextSnapshot: DatasetSnapshotImportResult, result: DatasetSearchResult) => {
      if (
        !sameDatasetSelection(
          {
            provider: result.provider,
            providerDatasetId: result.providerDatasetId,
            ...(result.provider === 'GOVDATA'
              ? { providerResourceId: result.providerResourceId }
              : {}),
            snapshotId: result.snapshotId,
          },
          {
            ...nextSnapshot,
            providerDatasetId:
              nextSnapshot.provider === 'UPLOAD'
                ? result.providerDatasetId
                : nextSnapshot.providerDatasetId,
          }
        )
      )
        throw new Error(t('plateJs.dataView.selectionMismatch'));
      let profiles = nextSnapshot.columnProfiles ?? result.columnProfiles ?? [];
      const inferred = inferDataViewConfiguration(profiles);
      if (['EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA'].includes(nextSnapshot.provider))
        inferred.query.aggregation = 'none';
      const options = datasetMeasureOptions(nextSnapshot);
      if (options.length === 1) {
        inferred.query.filters = { ...inferred.query.filters, ...options[0].filters };
        const label = `${options[0].label} · ${options[0].unit}`;
        profiles = profiles.map(profile =>
          profile.name === 'value' ? { ...profile, label } : profile
        );
        inferred.presentation.yAxisLabel = options[0].unit;
      }
      inferred.query = applyDatasetSearchIntent(
        inferred.query,
        { ...nextSnapshot, columnProfiles: profiles },
        chosenIntent.current
      );
      if (pendingTableSelection.current) {
        inferred.query = applyDatasetTableSelection(
          inferred.query,
          pendingTableSelection.current,
          profiles,
          options
        );
        const measure = selectedDatasetMeasure(options, inferred.query);
        if (measure) {
          profiles = profiles.map(profile =>
            profile.name === inferred.query.measureColumn
              ? { ...profile, label: `${measure.label} · ${measure.unit}` }
              : profile
          );
          inferred.presentation.yAxisLabel = measure.unit;
        }
        pendingTableSelection.current = null;
      }
      setSnapshot(nextSnapshot);
      setSelectedResult({
        ...result,
        id: nextSnapshot.datasetId,
        title: nextSnapshot.title,
        providerDatasetId: nextSnapshot.providerDatasetId ?? result.providerDatasetId,
        snapshotId: nextSnapshot.snapshotId,
        snapshotKey: nextSnapshot.snapshotKey,
        snapshotTakenAt: nextSnapshot.snapshotTakenAt,
        providerResourceId: nextSnapshot.providerResourceId ?? result.providerResourceId,
        rowCount: nextSnapshot.rowCount,
        columnCount: nextSnapshot.columnCount,
        byteSize: nextSnapshot.byteSize,
        columnProfiles: profiles,
        publisher: nextSnapshot.publisher ?? result.publisher,
        sourceUrl: nextSnapshot.sourceUrl ?? result.sourceUrl,
        metadata: nextSnapshot.provenance ?? result.metadata,
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
      setErrorDownloadAvailable(false);
    },
    [t]
  );
  const useSelectedDataset = React.useCallback(
    async (chooseScope = false, tableSelection?: DatasetTableSelection) => {
      if (!selectedResult || preparing) return;
      if (tableSelection) pendingTableSelection.current = tableSelection;
      const tableScope = pendingTableSelection.current?.filters;
      const version = ++requestVersion.current;
      datasetAbort.current?.abort();
      const controller = new AbortController();
      datasetAbort.current = controller;
      const intent = chosenIntent.current ?? searchIntent;
      chosenIntent.current = tableScope
        ? { ...intent, area: tableScope.area ?? null, period: tableScope.period ?? null }
        : stage === 'prepare' && restrictImport
          ? { ...intent, area: importFilters.area ?? null, period: importFilters.period ?? null }
          : intent;
      setPreparing(true);
      setError(null);
      setErrorDownloadAvailable(false);
      try {
        let result: DatasetSnapshotImportResult;
        if (
          !selectedResult.snapshotId &&
          ['EUROSTAT', 'GENESIS_DESTATIS'].includes(selectedResult.provider) &&
          selectedResult.providerDatasetId
        ) {
          let prepared = preparation;
          if (
            !prepared ||
            prepared.code !== selectedResult.providerDatasetId ||
            prepared.provider !== selectedResult.provider
          ) {
            prepared = await prepareProviderDataset(
              {
                provider: selectedResult.provider as 'EUROSTAT' | 'GENESIS_DESTATIS',
                code: selectedResult.providerDatasetId,
                language,
                filters: tableScope ?? { area: intent.area, period: intent.period },
              },
              session?.access_token,
              controller.signal
            );
            if (version !== requestVersion.current) return;
            if (
              prepared.provider !== selectedResult.provider ||
              prepared.code.toUpperCase() !== selectedResult.providerDatasetId.toUpperCase()
            )
              throw new Error(t('plateJs.dataView.selectionMismatch'));
            setPreparation(prepared);
            setImportFilters(tableScope ?? { area: intent.area, period: intent.period });
            setRestrictImport(true);
            if (
              chooseScope ||
              (!tableScope &&
                (prepared.estimatedBytes === null || prepared.estimatedBytes >= 25 * 1024 * 1024))
            ) {
              setStage('prepare');
              return;
            }
          } else if (chooseScope) {
            setStage('prepare');
            return;
          }
        }
        if (selectedResult.snapshotId) {
          const details = await loadDatasetDetails(
            selectedResult.id,
            session?.access_token,
            selectedResult.snapshotId,
            controller.signal
          );
          if (
            (details.id && details.id !== selectedResult.id) ||
            (details.snapshotId && details.snapshotId !== selectedResult.snapshotId)
          )
            throw new Error(t('plateJs.dataView.selectionMismatch'));
          const profiles = details.columnProfiles ?? selectedResult.columnProfiles ?? [];
          result = snapshotFromStoredResult(
            { ...selectedResult, ...details, snapshotId: selectedResult.snapshotId },
            profiles
          );
        } else if (selectedResult.provider === 'EUROSTAT' && selectedResult.providerDatasetId) {
          result = await createProviderSnapshot(
            {
              provider: 'EUROSTAT',
              code: selectedResult.providerDatasetId,
              language,
              ...(tableScope
                ? { filters: tableScope }
                : stage === 'prepare' && restrictImport
                  ? { filters: importFilters }
                  : {}),
            },
            session?.access_token,
            controller.signal
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
            session?.access_token,
            controller.signal
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
              ...(tableScope
                ? { filters: tableScope }
                : stage === 'prepare' && restrictImport
                  ? { filters: importFilters }
                  : {}),
            },
            session?.access_token,
            controller.signal
          );
        } else {
          setError(t('plateJs.dataView.datasetUnavailable'));
          return;
        }
        if (version === requestVersion.current) activateSnapshot(result, selectedResult);
      } catch (prepareError) {
        if (version === requestVersion.current) {
          setError(localizeAppError(prepareError));
          setErrorDownloadAvailable(canRecoverDatasetFile(prepareError));
          if (
            (prepareError as { payload?: { code?: string } })?.payload?.code ===
            'dataset_scope_too_large'
          )
            setStage('prepare');
        }
      } finally {
        if (version === requestVersion.current) setPreparing(false);
      }
    },
    [
      activateSnapshot,
      language,
      preparing,
      selectedResult,
      session?.access_token,
      t,
      searchIntent,
      preparation,
      stage,
      restrictImport,
      importFilters,
    ]
  );
  const measureOptions = datasetMeasureOptions(snapshot);
  const selectedMeasure = selectedDatasetMeasure(measureOptions, query);
  const needsMeasure = measureOptions.length > 1 && !selectedMeasure;
  const chooseMeasure = (id: string) => {
    const option = measureOptions.find(item => item.id === id);
    if (!option) return;
    setQuery(current => ({
      ...current,
      filters: {
        ...Object.fromEntries(
          Object.entries(current.filters).filter(([column]) => column !== 'value_variable_label')
        ),
        ...option.filters,
      },
      rowConditions: current.rowConditions?.filter(
        condition =>
          !(condition.column in option.filters) && condition.column !== 'value_variable_label'
      ),
    }));
    setColumnProfiles(current =>
      current.map(profile =>
        profile.name === query.measureColumn
          ? { ...profile, label: `${option.label} · ${option.unit}` }
          : profile
      )
    );
    setPresentation(current => ({
      ...current,
      title: `${option.label} · ${option.unit}`,
      yAxisLabel: option.unit,
    }));
  };
  const requiredSelections =
    snapshot && view !== 'table' ? requiredProviderDimensions(snapshot, query) : [];
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
    if (
      !open ||
      datasetExplorerOpen ||
      stage !== 'build' ||
      !snapshot ||
      preparing ||
      needsMeasure ||
      requiredSelections.length > 0
    ) {
      setProjection(null);
      setProjectionLoading(false);
      return;
    }
    const valid =
      view === 'table' ||
      (view === 'chart' &&
        Boolean(query.dimensionColumn) &&
        (query.aggregation === 'count' || Boolean(query.measureColumn))) ||
      (view === 'stat' && (query.aggregation === 'count' || Boolean(query.measureColumn)));
    if (!valid) {
      setProjection(null);
      setProjectionLoading(false);
      return;
    }
    setProjection(null);
    setProjectionLoading(true);
    setProjectionError(null);
    setProjectionDownloadAvailable(false);
    let cancelled = false;
    const controller = new AbortController();
    const version = requestVersion.current;
    const timeout = window.setTimeout(() => {
      void createDataViewProjection(
        { snapshotId: snapshot.snapshotId, view, ...query },
        session?.access_token,
        controller.signal
      )
        .then(result => {
          if (!cancelled && version === requestVersion.current) {
            if (result.snapshotId !== snapshot.snapshotId)
              throw new Error(t('plateJs.dataView.selectionMismatch'));
            setProjection(result);
          }
        })
        .catch(projectionFailure => {
          if (cancelled || version !== requestVersion.current) return;
          setProjection(null);
          setProjectionError(localizeAppError(projectionFailure));
          setProjectionDownloadAvailable(canRecoverDatasetFile(projectionFailure));
        })
        .finally(() => {
          if (!cancelled && version === requestVersion.current) setProjectionLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [
    needsMeasure,
    datasetExplorerOpen,
    open,
    preparing,
    query,
    session?.access_token,
    snapshot,
    stage,
    view,
    requiredSelections.length,
  ]);
  const previewRequest = React.useMemo<DatasetPreviewRequest | null>(() => {
    if (!open || !selectedResult) return null;
    if (stage === 'build' && snapshot)
      return {
        provider: snapshot.provider,
        providerDatasetId: snapshot.providerDatasetId ?? selectedResult.providerDatasetId,
        providerResourceId: snapshot.providerResourceId ?? selectedResult.providerResourceId,
        datasetId: snapshot.datasetId,
        snapshotId: snapshot.snapshotId,
        language,
        rowFilters: query.filters,
        rowConditions: query.rowConditions,
        sort: query.sort,
        timeRange: query.timeRange,
      };
    if (stage !== 'find') return null;
    return {
      provider: selectedResult.provider,
      providerDatasetId: selectedResult.providerDatasetId,
      providerResourceId: selectedResult.providerResourceId,
      ...(selectedResult.snapshotId
        ? { snapshotId: selectedResult.snapshotId, datasetId: selectedResult.id }
        : {}),
      language,
      filters: {
        area: chosenIntent.current?.area ?? searchIntent.area,
        period: chosenIntent.current?.period ?? searchIntent.period,
      },
    };
  }, [
    open,
    selectedResult,
    stage,
    snapshot,
    language,
    query.filters,
    query.rowConditions,
    query.sort,
    query.timeRange,
    searchIntent.area,
    searchIntent.period,
  ]);
  React.useEffect(() => {
    setDataPreview(null);
    setDataPreviewError(null);
    setSampleDownloadAvailable(false);
    if (!previewRequest || preparing || datasetExplorerOpen) {
      setDataPreviewLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setDataPreviewLoading(true);
    void loadDatasetPreview(previewRequest, session?.access_token, controller.signal)
      .then(response => {
        if (!active) return;
        if (!sameDatasetSelection(previewRequest, response.identity))
          throw new Error(t('plateJs.dataView.selectionMismatch'));
        setDataPreview(response);
      })
      .catch(error => {
        if (active) {
          setDataPreviewError(localizeAppError(error));
          setSampleDownloadAvailable(canRecoverDatasetFile(error));
        }
      })
      .finally(() => {
        if (active) setDataPreviewLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [previewRequest, preparing, datasetExplorerOpen, previewRevision, session?.access_token]);
  const loadFilterValues = React.useCallback(async () => {
    if (!snapshot || filterValuesLoading) return;
    const profiles = getFilterableProfiles(columnProfiles).filter(
      profile => filterValues[profile.name] == null
    );
    if (profiles.length === 0) return;
    const version = requestVersion.current;
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
      if (version === requestVersion.current) {
        setFilterValues(current => ({ ...current, ...Object.fromEntries(entries) }));
      }
    } catch (loadError) {
      if (version === requestVersion.current) {
        setProjectionError(localizeAppError(loadError));
        setProjectionDownloadAvailable(canRecoverDatasetFile(loadError));
      }
    } finally {
      if (version === requestVersion.current) setFilterValuesLoading(false);
    }
  }, [columnProfiles, filterValues, filterValuesLoading, session?.access_token, snapshot]);
  const submitUpload = React.useCallback(async () => {
    setUploadDownloadAvailable(false);
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
    const version = requestVersion.current;
    setUploadError(null);
    setUploadDownloadAvailable(false);
    setRejectedUploadFile(null);
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
      if (version !== requestVersion.current) return;
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
      if (version === requestVersion.current) {
        setUploadError(localizeAppError(uploadError));
        setUploadDownloadAvailable(canRecoverDatasetFile(uploadError));
      }
    } finally {
      if (version === requestVersion.current) setUploading(false);
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
  const validationError = projection ? (options.validate?.(projection, chartType) ?? null) : null;
  const canInsert = Boolean(
    snapshot &&
    projection &&
    projection.snapshotId === snapshot.snapshotId &&
    projection.view === view &&
    !preparing &&
    !projectionLoading &&
    !projectionError &&
    !validationError &&
    requiredSelections.length === 0 &&
    !needsMeasure &&
    options.canInsert !== false
  );
  const save = React.useCallback(() => {
    if (!canInsert || !snapshot || !selectedResult || !projection) return;
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
        sourceUpdatedAt:
          typeof snapshot.provenance?.sourceUpdatedAt === 'string'
            ? snapshot.provenance.sourceUpdatedAt
            : null,
        dataPeriod: query.timeRange
          ? {
              start: query.timeRange.startYear === 1800 ? '…' : String(query.timeRange.startYear),
              end: query.timeRange.endYear === 2199 ? '…' : String(query.timeRange.endYear),
            }
          : selectedResult.timeCoverage,
        groupId: selectedResult.groupId,
      },
      query,
      chartType: view === 'chart' ? chartType : undefined,
      presentation,
      children: [{ text: '' }],
    };
    try {
      options.onInsert(node, projection, editingElement ?? null);
      setOpen(false);
    } catch (saveError) {
      const message =
        saveError instanceof DataViewInsertionError
          ? saveError.message
          : localizeAppError(saveError);
      setError(message);
      toast.error(message);
    }
  }, [
    chartType,
    editingElement,
    options.onInsert,
    canInsert,
    presentation,
    projection,
    query,
    selectedResult,
    snapshot,
    setOpen,
    t,
    view,
  ]);
  const numericProfiles = columnProfiles.filter(
    profile =>
      profile.role === 'measure' && (!query.columns || query.columns.includes(profile.name))
  );
  const dimensionProfiles = columnProfiles.filter(
    profile =>
      !profile.technical &&
      profile.role !== 'label' &&
      profile.role !== 'measure' &&
      (!query.columns || query.columns.includes(profile.name))
  );
  const filterableProfiles = getFilterableProfiles(columnProfiles);
  const activeFilterCount =
    Object.values(query.filters).filter(Boolean).length +
    Number(Boolean(query.timeRange)) +
    (query.rowConditions?.length ?? 0);
  return {
    open,
    resetDialog,
    setOpen,
    stage,
    datasetExplorerOpen,
    openDatasetExplorer: () => setDatasetExplorerOpen(true),
    closeDatasetExplorer: () => setDatasetExplorerOpen(false),
    explorerRequest: previewRequest,
    explorerColumns: stage === 'build' ? query.columns : undefined,
    applyDatasetExplorer: async (selection: DatasetTableSelection) => {
      setDatasetExplorerOpen(false);
      if (stage === 'build' && snapshot) {
        const next = applyDatasetTableSelection(query, selection, columnProfiles, measureOptions);
        setQuery(next);
        const measure = selectedDatasetMeasure(measureOptions, next);
        if (measure) {
          setColumnProfiles(current =>
            current.map(profile =>
              profile.name === next.measureColumn
                ? { ...profile, label: `${measure.label} · ${measure.unit}` }
                : profile
            )
          );
          setPresentation(current => ({
            ...current,
            title: `${measure.label} · ${measure.unit}`,
            yAxisLabel: measure.unit,
          }));
        }
      } else await useSelectedDataset(false, selection);
    },
    editingElement,
    searchQuery,
    setSearchQuery,
    searchFilters,
    setSearchFilters,
    searchIntent,
    retrySearch: () => setSearchRevision(current => current + 1),
    providers,
    setProviders,
    searchResults,
    providerErrors,
    searching,
    selectedResult,
    setSelectedResult: (value: React.SetStateAction<DatasetSearchResult | null>) => {
      invalidateDatasetLoads();
      setDatasetExplorerOpen(false);
      pendingTableSelection.current = null;
      setPreparation(null);
      chosenIntent.current = searchIntent;
      setSelectedResult(value);
    },
    preparation,
    importFilters,
    setImportFilters,
    restrictImport,
    setRestrictImport,
    requiredSelections,
    measureOptions,
    selectedMeasure,
    needsMeasure,
    chooseMeasure,
    dataPreview,
    dataPreviewLoading,
    dataPreviewError,
    retryDataPreview: () => setPreviewRevision(current => current + 1),
    cancelPreparation: () => {
      invalidateDatasetLoads();
      setStage('find');
      setError(null);
      setErrorDownloadAvailable(false);
    },
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
    error: error ?? validationError,
    errorDownloadAvailable: Boolean(error) && errorDownloadAvailable,
    sampleDownloadAvailable,
    projectionDownloadAvailable,
    uploadDownloadAvailable,
    rejectedUploadFile,
    rejectUploadFile: (file: File | null, message: string) => {
      setRejectedUploadFile(file);
      setUploadDownloadAvailable(Boolean(file));
      setUploadError(message);
    },
    downloadAccessToken: session?.access_token,
    downloadLanguage: language,
    setError,
    filterValues,
    filterValuesLoading,
    activeFilterCount,
    loadFilterValues,
    useSelectedDataset,
    changeDataset: () => {
      invalidateDatasetLoads();
      setDatasetExplorerOpen(false);
      pendingTableSelection.current = null;
      setStage('find');
      setSelectedResult(null);
      setSnapshot(null);
      setProjection(null);
      setError(null);
      setErrorDownloadAvailable(false);
    },
    uploadOpen,
    setUploadOpen: (nextOpen: boolean) => {
      if (uploading && !nextOpen) return;
      if (nextOpen) setUploadGroupId('');
      setUploadOpen(nextOpen);
      setUploadError(null);
      setUploadDownloadAvailable(false);
      setRejectedUploadFile(null);
    },
    uploadMode,
    setUploadMode: (nextMode: 'file' | 'manual') => {
      setUploadMode(nextMode);
      setUploadError(null);
      setUploadDownloadAvailable(false);
      setRejectedUploadFile(null);
    },
    uploadFile,
    uploadGroupId,
    setUploadGroupId: (groupId: string) => {
      setUploadGroupId(groupId);
      setUploadError(null);
      setUploadDownloadAvailable(false);
      setRejectedUploadFile(null);
    },
    uploadGroups,
    uploadGroupsLoading,
    setUploadFile: (file: File | null) => {
      const previousAutomaticTitle = uploadFile?.name.replace(/\.[^.]+$/, '') ?? '';
      setUploadFile(file);
      setUploadError(null);
      setUploadDownloadAvailable(false);
      setRejectedUploadFile(null);
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
export type DataViewBuilderModel = Omit<ReturnType<typeof useDataViewBuilderModel>, 'resetDialog'>;
