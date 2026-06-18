import * as React from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/features/shared/ui/ui/sonner';

import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';

import { importGovDataCsvResource, searchGovDataDatasets } from '../api/govdataClient';
import {
  continueEurostatImport,
  createEurostatChartProjection,
  loadEurostatDatasetDetails,
  searchEurostatDatasets,
  startEurostatImport,
} from '../api/eurostatClient';
import {
  buildChartPoints,
  createEmptyChartTable,
  getChartMappingValueColumns,
  inferChartMapping,
  type ParsedChartTable,
} from '../logic/chartData';
import {
  countMissingEurostatFilters,
  createDefaultEurostatFilters,
  createEurostatChartPresetRoles,
  createEurostatEditableTable,
  createEurostatProjectionPreviewKey,
  getDefaultEurostatXDimension,
  normalizeEurostatProjectionFilters,
  type EurostatChartPreset,
} from '../logic/eurostatChartPreview';
import {
  CHART_NODE_TYPE,
  EUROSTAT_DEFAULT_VALUE_FIELD,
  type ChartMapping,
  type ChartPoint,
  type ChartPresentation,
  type ChartType,
  type EurostatCatalogueEntry,
  type EurostatDatasetDetails,
  type EurostatImportProgress,
  type GovDataCatalogueEntry,
  type GovDataProvenance,
  type GovDataResourceSummary,
  type OfficialDataProviderId,
  type OfficialDataSearchResult,
  type TChartElement,
} from '../types';
import { OPEN_CHART_DIALOG_EVENT } from '../ui/chartDialogEvents';

function createPresentation(element?: TChartElement): ChartPresentation {
  return {
    title: element?.presentation.title ?? '',
    description: element?.presentation.description ?? '',
    xAxisLabel: element?.presentation.xAxisLabel ?? '',
    yAxisLabel: element?.presentation.yAxisLabel ?? '',
    showLegend: element?.presentation.showLegend ?? true,
    showGrid: element?.presentation.showGrid ?? true,
    showTooltip: element?.presentation.showTooltip ?? true,
    donut: element?.presentation.donut ?? true,
  };
}

interface EurostatProjectionPreviewState {
  configKey: string;
  projectionId: string;
  points: ChartPoint[];
}

type ChartSourceKind = 'manual' | 'govdata' | 'eurostat';
const DEFAULT_OFFICIAL_PROVIDERS: OfficialDataProviderId[] = ['govdata', 'eurostat'];

function getGovDataSourceLabel(entry: GovDataCatalogueEntry) {
  return entry.publisher || entry.organizationTitle || entry.name;
}

function normalizeOfficialResults({
  eurostatResults,
  govDataResults,
  selectedProviders,
  govDataSourceFilters,
}: {
  eurostatResults: readonly EurostatCatalogueEntry[];
  govDataResults: readonly GovDataCatalogueEntry[];
  selectedProviders: readonly OfficialDataProviderId[];
  govDataSourceFilters: readonly string[];
}): OfficialDataSearchResult[] {
  const selectedProviderSet = new Set(selectedProviders);
  const govDataSourceFilterSet = new Set(govDataSourceFilters);
  const includeAllGovDataSources = govDataSourceFilters.length === 0;

  return [
    ...(selectedProviderSet.has('govdata')
      ? govDataResults
          .filter(entry => {
            const source = getGovDataSourceLabel(entry);
            return includeAllGovDataSources || govDataSourceFilterSet.has(source);
          })
          .map<OfficialDataSearchResult>(entry => ({
            id: `govdata:${entry.id}`,
            provider: 'govdata',
            title: entry.title,
            code: entry.name,
            description: entry.notes,
            source: getGovDataSourceLabel(entry),
            modified: entry.modified,
            formatSummary: `${entry.resources.length} CSV`,
            entry,
          }))
      : []),
    ...(selectedProviderSet.has('eurostat')
      ? eurostatResults.map<OfficialDataSearchResult>(entry => ({
          id: `eurostat:${entry.code}`,
          provider: 'eurostat',
          title: entry.title,
          code: entry.code,
          description: entry.title,
          source: 'Eurostat',
          modified: entry.lastUpdate ?? entry.structureLastChange,
          formatSummary: entry.type,
          valueSummary: entry.valueCount.toLocaleString(),
          entry,
        }))
      : []),
  ];
}

export function useChartDialogModel() {
  const editor = useEditorRef();
  const { session } = useAuth();
  const { i18n, t } = useTranslation();
  const language = ['de', 'fr'].includes(i18n.resolvedLanguage?.split('-')[0] ?? '')
    ? (i18n.resolvedLanguage?.split('-')[0] as 'de' | 'fr')
    : 'en';
  const [open, setOpen] = React.useState(false);
  const [editingElement, setEditingElement] = React.useState<TChartElement>();
  const [sourceKind, setSourceKind] = React.useState<ChartSourceKind>('manual');
  const [table, setTable] = React.useState<ParsedChartTable>(createEmptyChartTable);
  const [mapping, setMapping] = React.useState<ChartMapping>(() =>
    inferChartMapping(createEmptyChartTable())
  );
  const [chartType, setChartType] = React.useState<ChartType>('bar');
  const [presentation, setPresentation] = React.useState<ChartPresentation>(createPresentation());
  const [error, setError] = React.useState<string | null>(null);
  const [officialSearch, setOfficialSearch] = React.useState('');
  const [officialProviderSearch, setOfficialProviderSearch] = React.useState('');
  const [officialProviders, setOfficialProviders] = React.useState<OfficialDataProviderId[]>(
    DEFAULT_OFFICIAL_PROVIDERS
  );
  const [govDataSourceFilters, setGovDataSourceFilters] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<EurostatCatalogueEntry[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [govDataSearchResults, setGovDataSearchResults] = React.useState<GovDataCatalogueEntry[]>(
    []
  );
  const [govDataSearching, setGovDataSearching] = React.useState(false);
  const [govDataSelectedEntry, setGovDataSelectedEntry] =
    React.useState<GovDataCatalogueEntry | null>(null);
  const [govDataSelectedResource, setGovDataSelectedResource] =
    React.useState<GovDataResourceSummary | null>(null);
  const [govDataImporting, setGovDataImporting] = React.useState(false);
  const [govDataImported, setGovDataImported] = React.useState(false);
  const [govDataSnapshotKey, setGovDataSnapshotKey] = React.useState<string | null>(null);
  const [govDataProvenance, setGovDataProvenance] = React.useState<GovDataProvenance | null>(null);
  const [details, setDetails] = React.useState<EurostatDatasetDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState<EurostatImportProgress | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [datasetId, setDatasetId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [xDimension, setXDimension] = React.useState('');
  const [valueField, setValueField] = React.useState(EUROSTAT_DEFAULT_VALUE_FIELD);
  const [seriesDimension, setSeriesDimension] = React.useState<string | null>(null);
  const [eurostatPreview, setEurostatPreview] =
    React.useState<EurostatProjectionPreviewState | null>(null);
  const [eurostatTableReady, setEurostatTableReady] = React.useState(false);
  const [projecting, setProjecting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [snapshot] = useQuery(
    datasetId ? queries.eurostat.datasetById({ id: datasetId }) : undefined
  );

  const resetFromElement = React.useCallback(
    (element?: TChartElement) => {
      setEditingElement(element);
      setChartType(element?.chartType ?? 'bar');
      setPresentation(createPresentation(element));
      setError(null);
      setImportProgress(null);
      setSearchResults([]);
      setGovDataSearchResults([]);
      setProjecting(false);
      setOfficialProviders(DEFAULT_OFFICIAL_PROVIDERS);
      setOfficialProviderSearch('');
      setGovDataSourceFilters([]);

      if (element?.source.kind === 'eurostat') {
        const nextMapping = {
          ...element.mapping,
          tableMode: element.mapping.tableMode ?? 'columnMapping',
        };
        const nextTable =
          element.source.columns && element.source.rows
            ? { columns: element.source.columns, rows: element.source.rows }
            : createEurostatEditableTable({
                points: element.points,
                xDimension: element.mapping.xColumn,
                valueField: element.mapping.valueColumn || EUROSTAT_DEFAULT_VALUE_FIELD,
                seriesDimension: element.mapping.seriesColumn ?? null,
              });
        const nextChartType = element.chartType ?? 'bar';
        setSourceKind('eurostat');
        setOfficialSearch(`${element.source.datasetCode}`);
        setTable(nextTable);
        setMapping(nextMapping);
        setDatasetId(element.source.datasetId);
        setFilters(element.source.filters);
        setXDimension(element.mapping.xColumn);
        setValueField(element.mapping.valueColumn || EUROSTAT_DEFAULT_VALUE_FIELD);
        setSeriesDimension(element.mapping.seriesColumn ?? null);
        setEurostatTableReady(true);
        setEurostatPreview({
          configKey: createEurostatProjectionPreviewKey({
            datasetId: element.source.datasetId,
            filters: element.source.filters,
            xDimension: element.mapping.xColumn,
            seriesDimension: element.mapping.seriesColumn ?? null,
            valueField: element.mapping.valueColumn || EUROSTAT_DEFAULT_VALUE_FIELD,
            chartType: nextChartType,
          }),
          projectionId: element.source.projectionId,
          points: element.points,
        });
        setGovDataSelectedEntry(null);
        setGovDataSelectedResource(null);
        setGovDataSnapshotKey(null);
        setGovDataProvenance(null);
        setGovDataImported(false);
        setGovDataImporting(false);
        setDetails(null);
        setLoadingDetails(true);
        void loadEurostatDatasetDetails(element.source.datasetCode, language)
          .then(setDetails)
          .catch(loadError =>
            setError(loadError instanceof Error ? loadError.message : String(loadError))
          )
          .finally(() => setLoadingDetails(false));
        return;
      }

      if (element?.source.kind === 'govdata') {
        const source = element.source;
        setSourceKind('govdata');
        setTable({ columns: source.columns, rows: source.rows });
        setMapping(element.mapping);
        setOfficialSearch(`${source.packageTitle} · ${source.resourceName}`);
        setDetails(null);
        setDatasetId(null);
        setFilters({});
        setXDimension('');
        setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
        setSeriesDimension(null);
        setEurostatPreview(null);
        setEurostatTableReady(false);
        const entry: GovDataCatalogueEntry = {
          id: source.packageId,
          name: source.packageName,
          title: source.packageTitle,
          publisher: source.publisher,
          organizationTitle: source.organizationTitle,
          modified: source.modified,
          resources: [
            {
              id: source.resourceId,
              name: source.resourceName,
              format: 'CSV',
              modified: source.resourceModified,
              url: source.resourceUrl,
            },
          ],
        };
        setGovDataSelectedEntry(entry);
        setGovDataSelectedResource(entry.resources[0]);
        setGovDataSnapshotKey(source.snapshotKey);
        setGovDataProvenance({
          packageId: source.packageId,
          packageName: source.packageName,
          packageTitle: source.packageTitle,
          resourceId: source.resourceId,
          resourceName: source.resourceName,
          resourceUrl: source.resourceUrl,
          publisher: source.publisher,
          organizationTitle: source.organizationTitle,
          modified: source.modified,
          resourceModified: source.resourceModified,
          licenseTitle: source.licenseTitle,
          importedAt: source.importedAt,
        });
        setGovDataImported(true);
        setGovDataImporting(false);
        return;
      }

      const nextTable =
        element?.source.kind === 'manual'
          ? { columns: element.source.columns, rows: element.source.rows }
          : createEmptyChartTable();
      setSourceKind('manual');
      setTable(nextTable);
      setMapping(
        element?.source.kind === 'manual' ? element.mapping : inferChartMapping(nextTable)
      );
      setOfficialSearch('');
      setOfficialProviderSearch('');
      setOfficialProviders(DEFAULT_OFFICIAL_PROVIDERS);
      setGovDataSourceFilters([]);
      setGovDataSelectedEntry(null);
      setGovDataSelectedResource(null);
      setGovDataSnapshotKey(null);
      setGovDataProvenance(null);
      setGovDataImported(false);
      setGovDataImporting(false);
      setDetails(null);
      setDatasetId(null);
      setFilters({});
      setXDimension('');
      setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
      setSeriesDimension(null);
      setEurostatPreview(null);
      setEurostatTableReady(false);
    },
    [language]
  );

  React.useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ element?: TChartElement }>;
      resetFromElement(customEvent.detail?.element);
      setOpen(true);
    };
    window.addEventListener(OPEN_CHART_DIALOG_EVENT, listener);
    return () => window.removeEventListener(OPEN_CHART_DIALOG_EVENT, listener);
  }, [resetFromElement]);

  React.useEffect(() => {
    const query = officialSearch.trim();
    if (
      !open ||
      sourceKind === 'manual' ||
      query.length < 2 ||
      officialProviders.length === 0 ||
      loadingDetails ||
      Boolean(details || datasetId || govDataSelectedEntry)
    ) {
      setSearchResults([]);
      setGovDataSearchResults([]);
      setSearching(false);
      setGovDataSearching(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const searches: Promise<void>[] = [];

      if (officialProviders.includes('govdata')) {
        setGovDataSearching(true);
        searches.push(
          searchGovDataDatasets(query)
            .then(results => {
              if (!cancelled) setGovDataSearchResults(results);
            })
            .finally(() => {
              if (!cancelled) setGovDataSearching(false);
            })
        );
      } else {
        setGovDataSearchResults([]);
      }

      if (officialProviders.includes('eurostat')) {
        setSearching(true);
        searches.push(
          searchEurostatDatasets(query, language)
            .then(results => {
              if (!cancelled) setSearchResults(results);
            })
            .finally(() => {
              if (!cancelled) setSearching(false);
            })
        );
      } else {
        setSearchResults([]);
      }

      void Promise.all(searches).catch(searchError => {
        if (cancelled) return;
        setError(searchError instanceof Error ? searchError.message : String(searchError));
        setSearching(false);
        setGovDataSearching(false);
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    datasetId,
    details,
    govDataSelectedEntry,
    language,
    loadingDetails,
    officialProviders,
    officialSearch,
    open,
    sourceKind,
  ]);

  const manualPreview = React.useMemo(() => {
    if (sourceKind !== 'manual' && sourceKind !== 'govdata') return [];
    if (sourceKind === 'govdata' && !govDataImported) return [];
    try {
      return buildChartPoints(table.rows, mapping);
    } catch {
      return [];
    }
  }, [govDataImported, mapping, sourceKind, table.rows]);
  const editableTablePreview = React.useMemo(() => {
    if (sourceKind !== 'eurostat' || !eurostatTableReady) return [];
    try {
      return buildChartPoints(table.rows, mapping);
    } catch {
      return [];
    }
  }, [eurostatTableReady, mapping, sourceKind, table.rows]);

  const availableGovDataSources = React.useMemo(
    () =>
      Array.from(
        new Set(
          [...govDataSearchResults, ...(govDataSelectedEntry ? [govDataSelectedEntry] : [])]
            .map(getGovDataSourceLabel)
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right)),
    [govDataSearchResults, govDataSelectedEntry]
  );
  const officialSearchResults = React.useMemo(
    () =>
      normalizeOfficialResults({
        eurostatResults: searchResults,
        govDataResults: govDataSearchResults,
        selectedProviders: officialProviders,
        govDataSourceFilters,
      }),
    [govDataSearchResults, govDataSourceFilters, officialProviders, searchResults]
  );
  const effectiveSnapshotStatus = importProgress?.status ?? snapshot?.status ?? null;
  const snapshotObservationCount =
    snapshot?.observation_count ?? importProgress?.observationCount ?? 0;
  const isEurostatDatasetReady = effectiveSnapshotStatus === 'ready';
  const missingFilterCount = details
    ? countMissingEurostatFilters(details.dimensions, xDimension, seriesDimension, filters)
    : 0;
  const currentEurostatPreviewKey = React.useMemo(
    () =>
      createEurostatProjectionPreviewKey({
        datasetId,
        filters,
        xDimension,
        seriesDimension,
        valueField,
        chartType,
      }),
    [chartType, datasetId, filters, seriesDimension, valueField, xDimension]
  );
  const canCreateEurostatPreview =
    sourceKind === 'eurostat' &&
    Boolean(details && datasetId && xDimension && valueField) &&
    isEurostatDatasetReady &&
    missingFilterCount === 0 &&
    !projecting;
  const invalidateEurostatEditableTable = React.useCallback(() => {
    setEurostatPreview(null);
    setEurostatTableReady(false);
  }, []);

  const ensureEurostatProjectionPreview = React.useCallback(async () => {
    if (!details || !datasetId || !xDimension) {
      throw new Error('Import the dataset and choose an X dimension first');
    }
    if (!isEurostatDatasetReady) {
      throw new Error('Eurostat snapshot is not ready');
    }
    if (missingFilterCount > 0) {
      throw new Error('All remaining dimensions must be filtered to one value');
    }

    const configKey = currentEurostatPreviewKey;
    setProjecting(true);
    setError(null);
    try {
      const result = await createEurostatChartProjection(
        {
          datasetId,
          filters: normalizeEurostatProjectionFilters(filters),
          xDimension,
          seriesDimension,
          valueField,
        },
        session?.access_token
      );
      const nextPreview = {
        configKey,
        projectionId: result.projectionId,
        points: result.points,
      };
      const nextTable = createEurostatEditableTable({
        points: result.points,
        xDimension,
        valueField,
        seriesDimension,
      });
      setEurostatPreview(nextPreview);
      setTable(nextTable);
      setMapping({
        xColumn: xDimension,
        valueColumn: valueField || EUROSTAT_DEFAULT_VALUE_FIELD,
        seriesColumn: seriesDimension,
        tableMode: 'columnMapping',
      });
      setEurostatTableReady(true);
      return nextPreview;
    } catch (projectionError) {
      const message =
        projectionError instanceof Error ? projectionError.message : String(projectionError);
      setError(message);
      toast.error(message);
      throw projectionError;
    } finally {
      setProjecting(false);
    }
  }, [
    currentEurostatPreviewKey,
    datasetId,
    details,
    filters,
    isEurostatDatasetReady,
    missingFilterCount,
    seriesDimension,
    session?.access_token,
    valueField,
    xDimension,
  ]);

  const chooseDataset = async (entry: EurostatCatalogueEntry) => {
    setSourceKind('eurostat');
    setOfficialSearch(`${entry.code} · ${entry.title}`);
    setSearchResults([]);
    setGovDataSearchResults([]);
    setGovDataSelectedEntry(null);
    setGovDataSelectedResource(null);
    setGovDataSnapshotKey(null);
    setGovDataProvenance(null);
    setGovDataImported(false);
    setLoadingDetails(true);
    setError(null);
    setDatasetId(null);
    setImportProgress(null);
    try {
      const nextDetails = await loadEurostatDatasetDetails(entry.code, language);
      setDetails(nextDetails);
      const defaultX = getDefaultEurostatXDimension(nextDetails.dimensions);
      setXDimension(defaultX);
      setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
      setSeriesDimension(null);
      setFilters(createDefaultEurostatFilters(nextDetails.dimensions, defaultX, null));
      setEurostatPreview(null);
      setEurostatTableReady(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOfficialSearchChange = React.useCallback((value: string) => {
    setOfficialSearch(value);
    setDetails(null);
    setDatasetId(null);
    setImportProgress(null);
    setFilters({});
    setXDimension('');
    setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
    setSeriesDimension(null);
    setEurostatPreview(null);
    setEurostatTableReady(false);
    setGovDataSelectedEntry(null);
    setGovDataSelectedResource(null);
    setGovDataSnapshotKey(null);
    setGovDataProvenance(null);
    setGovDataImported(false);
  }, []);

  const chooseGovDataDataset = (entry: GovDataCatalogueEntry) => {
    setSourceKind('govdata');
    setOfficialSearch(`${entry.title}`);
    setGovDataSearchResults([]);
    setSearchResults([]);
    setGovDataSelectedEntry(entry);
    setGovDataSelectedResource(entry.resources[0] ?? null);
    setGovDataSnapshotKey(null);
    setGovDataProvenance(null);
    setGovDataImported(false);
    setDetails(null);
    setDatasetId(null);
    setImportProgress(null);
    setFilters({});
    setXDimension('');
    setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
    setSeriesDimension(null);
    setEurostatPreview(null);
    setEurostatTableReady(false);
    setError(null);
  };

  const chooseOfficialDataResult = (result: OfficialDataSearchResult) => {
    if (result.provider === 'govdata') {
      chooseGovDataDataset(result.entry as GovDataCatalogueEntry);
      return;
    }

    void chooseDataset(result.entry as EurostatCatalogueEntry);
  };

  const toggleOfficialProvider = (provider: OfficialDataProviderId, checked: boolean) => {
    setOfficialProviders(current => {
      if (checked) return current.includes(provider) ? current : [...current, provider];
      return current.filter(item => item !== provider);
    });
  };

  const selectAllOfficialProviders = () => {
    setOfficialProviders(DEFAULT_OFFICIAL_PROVIDERS);
  };

  const clearOfficialProviders = () => {
    setOfficialProviders([]);
  };

  const toggleGovDataSourceFilter = (source: string, checked: boolean) => {
    setGovDataSourceFilters(current => {
      if (checked) return current.includes(source) ? current : [...current, source];
      if (current.length === 0) return availableGovDataSources.filter(item => item !== source);
      return current.filter(item => item !== source);
    });
  };

  const selectAllGovDataSources = () => {
    setGovDataSourceFilters(availableGovDataSources);
  };

  const clearGovDataSourceFilters = () => {
    setGovDataSourceFilters([]);
  };

  const runGovDataImport = async () => {
    if (!govDataSelectedEntry || !govDataSelectedResource) return;
    setGovDataImporting(true);
    setError(null);
    try {
      const result = await importGovDataCsvResource(
        {
          packageId: govDataSelectedEntry.id,
          resourceId: govDataSelectedResource.id,
        },
        session?.access_token
      );
      const nextTable = { columns: result.columns, rows: result.rows };
      setTable(nextTable);
      setMapping(inferChartMapping(nextTable));
      setGovDataSnapshotKey(result.snapshotKey);
      setGovDataProvenance(result.provenance);
      setGovDataImported(true);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : String(importError);
      setError(message);
      toast.error(message);
    } finally {
      setGovDataImporting(false);
    }
  };

  const applyEurostatPreset = (preset: EurostatChartPreset) => {
    if (!details) return;
    const roles = createEurostatChartPresetRoles(details.dimensions, preset, filters);
    setXDimension(roles.xDimension);
    setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
    setSeriesDimension(roles.seriesDimension);
    setFilters(roles.filters);
    setEurostatPreview(null);
    setEurostatTableReady(false);
  };

  const runImport = async () => {
    if (!details) return;
    setImporting(true);
    setError(null);
    setEurostatPreview(null);
    setEurostatTableReady(false);
    try {
      let progress = await startEurostatImport(
        details.code,
        details.language,
        session?.access_token
      );
      setImportProgress(progress);
      setDatasetId(progress.datasetId);
      while (progress.status === 'pending' || progress.status === 'importing') {
        progress = await continueEurostatImport(progress.datasetId, session?.access_token);
        setImportProgress(progress);
        if (progress.status === 'pending' || progress.status === 'importing') {
          await new Promise(resolve => window.setTimeout(resolve, 250));
        }
      }
      if (progress.status === 'error' || progress.status === 'blocked') {
        throw new Error(progress.error || 'Eurostat import failed');
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setImporting(false);
    }
  };

  const saveNode = async () => {
    setError(null);
    try {
      let node: TChartElement;
      if (sourceKind === 'manual') {
        const points = buildChartPoints(table.rows, mapping);
        node = {
          type: CHART_NODE_TYPE,
          chartType,
          mapping,
          presentation,
          source: {
            kind: 'manual',
            columns: table.columns,
            rows: table.rows,
          },
          points,
          children: [{ text: '' }],
        };
      } else if (sourceKind === 'govdata') {
        if (!govDataImported || !govDataSnapshotKey || !govDataProvenance) {
          throw new Error('Import a GovData CSV resource first');
        }
        const points = buildChartPoints(table.rows, mapping);
        node = {
          type: CHART_NODE_TYPE,
          chartType,
          mapping,
          presentation,
          source: {
            kind: 'govdata',
            snapshotKey: govDataSnapshotKey,
            columns: table.columns,
            rows: table.rows,
            ...govDataProvenance,
          },
          points,
          children: [{ text: '' }],
        };
      } else {
        if (!details || !datasetId || !xDimension) {
          throw new Error('Import the dataset and choose an X dimension first');
        }
        if (!valueField) {
          throw new Error('Choose a value field first');
        }
        if (!eurostatTableReady || !eurostatPreview) {
          throw new Error('Build the editable Eurostat table first');
        }
        const points = buildChartPoints(table.rows, mapping);
        const normalizedFilters = normalizeEurostatProjectionFilters(filters);
        node = {
          type: CHART_NODE_TYPE,
          chartType,
          mapping,
          presentation,
          source: {
            kind: 'eurostat',
            datasetId,
            datasetCode: details.code,
            snapshotKey: details.snapshotKey,
            projectionId: eurostatPreview.projectionId,
            filters: normalizedFilters,
            columns: table.columns,
            rows: table.rows,
          },
          points,
          children: [{ text: '' }],
        };
      }

      if (editingElement) {
        const path = editor.api.findPath(editingElement);
        if (!path) throw new Error('Chart is no longer in the document');
        editor.tf.setNodes(node, { at: path });
      } else {
        editor.tf.insertNodes(node);
      }
      setOpen(false);
      window.setTimeout(() => editor.tf.focus(), 0);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(message);
      toast.error(message);
    }
  };

  const progressValue = importProgress?.partitionCount
    ? (importProgress.completedPartitions / importProgress.partitionCount) * 100
    : 0;
  const previewPoints =
    sourceKind === 'eurostat'
      ? editableTablePreview
      : sourceKind === 'manual' || sourceKind === 'govdata'
        ? manualPreview
        : [];
  const eurostatPrimaryLabel = !eurostatTableReady
    ? t('plateJs.chart.buildEditableTableFirst')
    : editingElement
      ? t('plateJs.chart.update')
      : t('plateJs.chart.insert');
  const primaryButtonLabel =
    sourceKind === 'eurostat'
      ? eurostatPrimaryLabel
      : editingElement
        ? t('plateJs.chart.update')
        : t('plateJs.chart.insert');
  const primaryButtonDisabled =
    sourceKind === 'eurostat'
      ? !details || importing || projecting || !eurostatTableReady
      : sourceKind === 'govdata'
        ? govDataImporting || !govDataImported
        : false;

  const runPrimaryAction = () => {
    void saveNode();
  };

  return {
    open,
    setOpen,
    editingElement,
    sourceKind,
    setSourceKind,
    table,
    setTable,
    mapping,
    setMapping,
    chartType,
    setChartType,
    presentation,
    setPresentation,
    error,
    setError,
    officialSearch,
    setOfficialSearch,
    officialProviderSearch,
    setOfficialProviderSearch,
    officialProviders,
    toggleOfficialProvider,
    selectAllOfficialProviders,
    clearOfficialProviders,
    govDataSourceFilters,
    toggleGovDataSourceFilter,
    selectAllGovDataSources,
    clearGovDataSourceFilters,
    availableGovDataSources,
    officialSearchResults,
    searchResults,
    searching,
    govDataSearchResults,
    govDataSearching,
    govDataSelectedEntry,
    govDataSelectedResource,
    setGovDataSelectedResource,
    govDataImporting,
    govDataImported,
    govDataProvenance,
    details,
    setDetails,
    loadingDetails,
    importProgress,
    importing,
    datasetId,
    setDatasetId,
    filters,
    setFilters,
    xDimension,
    setXDimension,
    valueField,
    setValueField,
    seriesDimension,
    setSeriesDimension,
    eurostatTableReady,
    projecting,
    fileInputRef,
    effectiveSnapshotStatus,
    snapshotObservationCount,
    isEurostatDatasetReady,
    missingFilterCount,
    canCreateEurostatPreview,
    invalidateEurostatEditableTable,
    handleOfficialSearchChange,
    chooseDataset,
    chooseOfficialDataResult,
    chooseGovDataDataset,
    runGovDataImport,
    applyEurostatPreset,
    runImport,
    saveNode,
    progressValue,
    previewPoints,
    primaryButtonLabel,
    primaryButtonDisabled,
    runPrimaryAction,
    ensureEurostatProjectionPreview,
    getChartMappingValueColumns,
  };
}

export type ChartDialogModel = ReturnType<typeof useChartDialogModel>;
