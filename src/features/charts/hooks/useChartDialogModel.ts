import * as React from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/features/shared/ui/ui/sonner';

import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';

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
  inferChartMapping,
  type ParsedChartTable,
} from '../logic/chartData';
import {
  countMissingEurostatFilters,
  createDefaultEurostatFilters,
  createEurostatChartPresetRoles,
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

export function useChartDialogModel() {
  const editor = useEditorRef();
  const { session } = useAuth();
  const { i18n, t } = useTranslation();
  const language = ['de', 'fr'].includes(i18n.resolvedLanguage?.split('-')[0] ?? '')
    ? (i18n.resolvedLanguage?.split('-')[0] as 'de' | 'fr')
    : 'en';
  const [open, setOpen] = React.useState(false);
  const [editingElement, setEditingElement] = React.useState<TChartElement>();
  const [sourceKind, setSourceKind] = React.useState<'manual' | 'eurostat'>('manual');
  const [table, setTable] = React.useState<ParsedChartTable>(createEmptyChartTable);
  const [mapping, setMapping] = React.useState<ChartMapping>(() =>
    inferChartMapping(createEmptyChartTable())
  );
  const [chartType, setChartType] = React.useState<ChartType>('bar');
  const [presentation, setPresentation] = React.useState<ChartPresentation>(createPresentation());
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<EurostatCatalogueEntry[]>([]);
  const [searching, setSearching] = React.useState(false);
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
  const [projecting, setProjecting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [snapshot] = useQuery(
    datasetId ? queries.eurostat.datasetById({ id: datasetId }) : undefined
  );
  const [observationPreviewRows, observationPreviewResult] = useQuery(
    datasetId ? queries.eurostat.observationPreview({ datasetId, limit: 5 }) : undefined
  );

  const resetFromElement = React.useCallback(
    (element?: TChartElement) => {
      setEditingElement(element);
      setChartType(element?.chartType ?? 'bar');
      setPresentation(createPresentation(element));
      setError(null);
      setImportProgress(null);
      setSearchResults([]);
      setProjecting(false);

      if (element?.source.kind === 'eurostat') {
        const nextChartType = element.chartType ?? 'bar';
        setSourceKind('eurostat');
        setSearch(`${element.source.datasetCode}`);
        setDatasetId(element.source.datasetId);
        setFilters(element.source.filters);
        setXDimension(element.mapping.xColumn);
        setValueField(element.mapping.valueColumn || EUROSTAT_DEFAULT_VALUE_FIELD);
        setSeriesDimension(element.mapping.seriesColumn ?? null);
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

      const nextTable =
        element?.source.kind === 'manual'
          ? { columns: element.source.columns, rows: element.source.rows }
          : createEmptyChartTable();
      setSourceKind('manual');
      setTable(nextTable);
      setMapping(
        element?.source.kind === 'manual' ? element.mapping : inferChartMapping(nextTable)
      );
      setSearch('');
      setDetails(null);
      setDatasetId(null);
      setFilters({});
      setXDimension('');
      setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
      setSeriesDimension(null);
      setEurostatPreview(null);
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
    if (!open || sourceKind !== 'eurostat' || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    if (details?.code === search.trim().toUpperCase()) return;

    const timeout = window.setTimeout(() => {
      setSearching(true);
      void searchEurostatDatasets(search, language)
        .then(setSearchResults)
        .catch(searchError =>
          setError(searchError instanceof Error ? searchError.message : String(searchError))
        )
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [details?.code, language, open, search, sourceKind]);

  const manualPreview = React.useMemo(() => {
    if (sourceKind !== 'manual') return [];
    try {
      return buildChartPoints(table.rows, mapping);
    } catch {
      return [];
    }
  }, [mapping, sourceKind, table.rows]);

  const observationRows = React.useMemo(
    () =>
      (observationPreviewRows ?? []).map(row => ({
        id: row.id,
        value: Number(row.value),
        dimensions: row.dimensions,
        attributes: row.attributes,
      })),
    [observationPreviewRows]
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
  const isEurostatPreviewFresh =
    Boolean(eurostatPreview?.points.length) &&
    eurostatPreview?.configKey === currentEurostatPreviewKey;
  const eurostatPreviewPoints =
    eurostatPreview?.points ??
    (editingElement?.source.kind === 'eurostat' ? editingElement.points : []);
  const eurostatPreviewIsStale =
    Boolean(eurostatPreview?.points.length) &&
    eurostatPreview?.configKey !== currentEurostatPreviewKey;
  const canCreateEurostatPreview =
    sourceKind === 'eurostat' &&
    Boolean(details && datasetId && xDimension && valueField) &&
    isEurostatDatasetReady &&
    missingFilterCount === 0 &&
    !projecting;

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
      setEurostatPreview(nextPreview);
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
    setSearch(`${entry.code} · ${entry.title}`);
    setSearchResults([]);
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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleEurostatSearchChange = React.useCallback((value: string) => {
    setSearch(value);
    setDetails(null);
    setDatasetId(null);
    setImportProgress(null);
    setFilters({});
    setXDimension('');
    setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
    setSeriesDimension(null);
    setEurostatPreview(null);
  }, []);

  const applyEurostatPreset = (preset: EurostatChartPreset) => {
    if (!details) return;
    const roles = createEurostatChartPresetRoles(details.dimensions, preset, filters);
    setXDimension(roles.xDimension);
    setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
    setSeriesDimension(roles.seriesDimension);
    setFilters(roles.filters);
  };

  const runImport = async () => {
    if (!details) return;
    setImporting(true);
    setError(null);
    setEurostatPreview(null);
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
      } else {
        if (!details || !datasetId || !xDimension) {
          throw new Error('Import the dataset and choose an X dimension first');
        }
        if (!valueField) {
          throw new Error('Choose a value field first');
        }
        const preview = isEurostatPreviewFresh
          ? eurostatPreview
          : await ensureEurostatProjectionPreview();
        if (!preview) {
          throw new Error('Create the chart preview first');
        }
        const normalizedFilters = normalizeEurostatProjectionFilters(filters);
        node = {
          type: CHART_NODE_TYPE,
          chartType,
          mapping: {
            xColumn: xDimension,
            valueColumn: valueField,
            seriesColumn: seriesDimension,
          },
          presentation,
          source: {
            kind: 'eurostat',
            datasetId,
            datasetCode: details.code,
            snapshotKey: details.snapshotKey,
            projectionId: preview.projectionId,
            filters: normalizedFilters,
          },
          points: preview.points,
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
  const previewPoints = sourceKind === 'manual' ? manualPreview : eurostatPreviewPoints;
  const observationRowsLoading =
    Boolean(datasetId && isEurostatDatasetReady) && observationPreviewResult.type === 'unknown';
  const eurostatPrimaryLabel =
    !datasetId || !isEurostatDatasetReady
      ? t('plateJs.chart.importFirst')
      : missingFilterCount > 0
        ? t('plateJs.chart.chooseAllFilters')
        : !isEurostatPreviewFresh
          ? t('plateJs.chart.createPreviewFirst')
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
      ? !details ||
        importing ||
        projecting ||
        (!isEurostatPreviewFresh && !canCreateEurostatPreview)
      : false;

  const runPrimaryAction = () => {
    if (sourceKind === 'eurostat' && !isEurostatPreviewFresh) {
      void ensureEurostatProjectionPreview();
      return;
    }
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
    search,
    setSearch,
    searchResults,
    searching,
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
    eurostatPreview,
    projecting,
    fileInputRef,
    observationRows,
    effectiveSnapshotStatus,
    snapshotObservationCount,
    isEurostatDatasetReady,
    missingFilterCount,
    isEurostatPreviewFresh,
    eurostatPreviewIsStale,
    canCreateEurostatPreview,
    handleEurostatSearchChange,
    chooseDataset,
    applyEurostatPreset,
    runImport,
    saveNode,
    progressValue,
    previewPoints,
    observationRowsLoading,
    primaryButtonLabel,
    primaryButtonDisabled,
    runPrimaryAction,
    ensureEurostatProjectionPreview,
  };
}

export type ChartDialogModel = ReturnType<typeof useChartDialogModel>;
