import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import * as React from 'react';
import {
  AreaChartIcon,
  BarChart3Icon,
  CheckIcon,
  LineChartIcon,
  Loader2Icon,
  PieChartIcon,
  UploadIcon,
} from 'lucide-react';
import { useQuery } from '@rocicorp/zero/react';
import { useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
  parseChartCsv,
  type ParsedChartTable,
} from '../logic/chartData';
import {
  canApplyEurostatChartPreset,
  countMissingEurostatFilters,
  createDefaultEurostatFilters,
  createEurostatChartPresetRoles,
  createEurostatProjectionPreviewKey,
  getDefaultEurostatXDimension,
  getEurostatValueFields,
  normalizeEurostatProjectionFilters,
  type EurostatChartPreset,
} from '../logic/eurostatChartPreview';
import {
  CHART_NODE_TYPE,
  EUROSTAT_DEFAULT_VALUE_FIELD,
  type ChartPoint,
  type ChartMapping,
  type ChartPresentation,
  type ChartType,
  type EurostatCatalogueEntry,
  type EurostatDatasetDetails,
  type EurostatImportProgress,
  type TChartElement,
} from '../types';
import { ChartRenderer } from './ChartRenderer';
import { EurostatObservationPreviewTable } from './EurostatObservationPreviewTable';
import { ManualChartTableEditor } from './ManualChartTableEditor';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/features/shared/ui/ui/button';
import { FormFieldShell, InlineCheckbox, SelectField, TextField } from '@/features/shared/ui/form';
import { StateBadge, TokenBadge } from '@/features/shared/ui/status';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import { queries } from '@/zero/queries';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export const OPEN_CHART_DIALOG_EVENT = 'plate:open-chart-dialog';

export function openChartDialog(element?: TChartElement) {
  window.dispatchEvent(
    new CustomEvent<{ element?: TChartElement }>(OPEN_CHART_DIALOG_EVENT, {
      detail: { element },
    })
  );
}

const NO_SERIES = '__none__';

function formatBytes(value: number) {
  if (value < 1_000_000) return `${Math.ceil(value / 1_000).toLocaleString()} kB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

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

function EurostatStepGuide({
  datasetSelected,
  downloaded,
  previewRowsVisible,
  chartPreviewReady,
}: {
  datasetSelected: boolean;
  downloaded: boolean;
  previewRowsVisible: boolean;
  chartPreviewReady: boolean;
}) {
  const { t } = useTranslation();
  const steps = [
    {
      label: t('plateJs.chart.stepDataset'),
      complete: datasetSelected,
    },
    {
      label: t('plateJs.chart.stepDownload'),
      complete: downloaded,
    },
    {
      label: t('plateJs.chart.stepDataPreview'),
      complete: previewRowsVisible,
    },
    {
      label: t('plateJs.chart.stepChart'),
      complete: chartPreviewReady,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className="border-border bg-background flex min-h-11 items-center gap-2 border px-3 py-2 text-sm"
        >
          <span
            className={
              step.complete
                ? 'bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
                : 'bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
            }
          >
            {step.complete ? <CheckIcon className="size-3.5" /> : index + 1}
          </span>
          <span className="truncate font-medium">{step.label}</span>
        </div>
      ))}
    </div>
  );
}

function ChartTypePicker({
  value,
  onChange,
}: {
  value: ChartType;
  onChange: (value: ChartType) => void;
}) {
  const { t } = useTranslation();
  const options = [
    { value: 'line', icon: LineChartIcon, label: t('plateJs.chart.line') },
    { value: 'bar', icon: BarChart3Icon, label: t('plateJs.chart.bar') },
    { value: 'area', icon: AreaChartIcon, label: t('plateJs.chart.area') },
    { value: 'pie', icon: PieChartIcon, label: t('plateJs.chart.pie') },
  ] as const;

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={next => {
        if (next) onChange(next as ChartType);
      }}
      variant="outline"
      className="grid grid-cols-2 sm:grid-cols-4"
    >
      {options.map(option => (
        <ToggleGroupItem key={option.value} value={option.value} className="min-w-0 gap-2 px-2">
          <option.icon className="size-4 shrink-0" />
          <span className="truncate">{option.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function MappingSelect({
  label,
  value,
  columns,
  onChange,
  optional = false,
}: {
  label: string;
  value: string | null | undefined;
  columns: readonly string[];
  onChange: (value: string | null) => void;
  optional?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <SelectField
      label={label}
      value={value || (optional ? NO_SERIES : undefined)}
      onValueChange={next => onChange(next === NO_SERIES ? null : next)}
      options={[
        ...(optional ? [{ value: NO_SERIES, label: t('plateJs.chart.none') }] : []),
        ...columns.map(column => ({ value: column, label: column })),
      ]}
    />
  );
}

export function ChartDialog() {
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
    sourceKind === translateText('generated.inline.0029_eurostat_1f498c07')
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ScrollableDialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>
            {editingElement ? t('plateJs.chart.editTitle') : t('plateJs.chart.insertTitle')}
          </DialogTitle>
          <DialogDescription>{t('plateJs.chart.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 px-5 pb-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="min-w-0 space-y-5">
            <Tabs
              value={sourceKind}
              onValueChange={value => setSourceKind(value as 'manual' | 'eurostat')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">{t('plateJs.chart.manualSource')}</TabsTrigger>
                <TabsTrigger value="eurostat">{t('plateJs.chart.eurostatSource')}</TabsTrigger>
              </TabsList>
            </Tabs>

            {sourceKind === 'manual' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{t('plateJs.chart.dataTable')}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t('plateJs.chart.dataLimits')}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void file
                        .text()
                        .then(text => {
                          const parsed = parseChartCsv(text);
                          setTable(parsed);
                          setMapping(inferChartMapping(parsed));
                          setError(null);
                        })
                        .catch(parseError =>
                          setError(
                            parseError instanceof Error ? parseError.message : String(parseError)
                          )
                        );
                      event.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon className="size-4" />
                    {t('plateJs.chart.uploadCsv')}
                  </Button>
                </div>
                <ManualChartTableEditor table={table} onChange={setTable} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <MappingSelect
                    label={t('plateJs.chart.category')}
                    value={mapping.xColumn}
                    columns={table.columns}
                    onChange={value =>
                      setMapping(current => ({ ...current, xColumn: value ?? '' }))
                    }
                  />
                  <MappingSelect
                    label={t('plateJs.chart.numericValue')}
                    value={mapping.valueColumn}
                    columns={table.columns}
                    onChange={value =>
                      setMapping(current => ({ ...current, valueColumn: value ?? '' }))
                    }
                  />
                  <MappingSelect
                    label={t('plateJs.chart.series')}
                    value={mapping.seriesColumn}
                    columns={table.columns}
                    optional
                    onChange={value => setMapping(current => ({ ...current, seriesColumn: value }))}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-5">
                <EurostatStepGuide
                  datasetSelected={Boolean(details)}
                  downloaded={isEurostatDatasetReady}
                  previewRowsVisible={observationRows.length > 0}
                  chartPreviewReady={isEurostatPreviewFresh}
                />

                <div className="relative">
                  <TextField
                    id="eurostat-search"
                    label={t('plateJs.chart.dataset')}
                    value={search}
                    onValueChange={value => {
                      setSearch(value);
                      setDetails(null);
                      setDatasetId(null);
                      setImportProgress(null);
                      setFilters({});
                      setXDimension('');
                      setValueField(EUROSTAT_DEFAULT_VALUE_FIELD);
                      setSeriesDimension(null);
                      setEurostatPreview(null);
                    }}
                    placeholder={t('plateJs.chart.datasetPlaceholder')}
                    autoComplete="off"
                    className="pr-9"
                  />
                  {searching ? (
                    <Loader2Icon className="text-muted-foreground absolute right-3 bottom-3 size-4 animate-spin" />
                  ) : null}
                  {searchResults.length > 0 ? (
                    <div className="bg-popover absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto border shadow-md">
                      {searchResults.map(entry => (
                        <button
                          key={entry.code}
                          type="button"
                          className="hover:bg-accent flex w-full items-start justify-between gap-4 border-b px-3 py-2 text-left text-sm last:border-0"
                          onClick={() => void chooseDataset(entry)}
                        >
                          <span className="min-w-0">
                            <span className="block font-medium">{entry.code}</span>
                            <span className="text-muted-foreground line-clamp-2">
                              {entry.title}
                            </span>
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {entry.valueCount.toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {loadingDetails ? (
                  <div className="text-muted-foreground flex min-h-32 items-center justify-center gap-2 text-sm">
                    <Loader2Icon className="size-4 animate-spin" />
                    {t('plateJs.chart.loadingMetadata')}
                  </div>
                ) : details ? (
                  <>
                    <div className="space-y-2 border-y py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <TokenBadge>{details.code}</TokenBadge>
                        <StateBadge
                          status={details.importAllowed ? 'active' : 'failed'}
                          tone={details.importAllowed ? 'neutral' : 'destructive'}
                        >
                          {t('plateJs.chart.estimated', {
                            defaultValue: '{{size}} estimated',
                            size: formatBytes(details.estimatedBytes),
                          })}
                        </StateBadge>
                      </div>
                      <p className="text-sm font-medium">{details.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {t('plateJs.chart.catalogueSummary', {
                          defaultValue: '{{values}} catalogue values · {{dimensions}} dimensions',
                          values: details.valueCount.toLocaleString(),
                          dimensions: details.dimensions.length,
                        })}
                      </p>
                      {!details.importAllowed ? (
                        <p className="text-destructive text-sm">{t('plateJs.chart.blocked')}</p>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{t('plateJs.chart.publicSnapshot')}</p>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!details.importAllowed || importing}
                          onClick={() => void runImport()}
                        >
                          {importing ? <Loader2Icon className="size-4 animate-spin" /> : null}
                          {datasetId
                            ? t('plateJs.chart.importLatest')
                            : t('plateJs.chart.importDataset')}
                        </Button>
                      </div>
                      {importProgress ? (
                        <div className="space-y-2">
                          <Progress value={progressValue} />
                          <p className="text-muted-foreground text-xs">
                            {importProgress.completedPartitions}/
                            {importProgress.partitionCount || '?'}
                            {translateText('generated.inline.0294_partitions_c5246599')}{' '}
                            {importProgress.observationCount.toLocaleString()}
                            {translateText('generated.inline.0295_observations_ffc09dde')}{' '}
                            {importProgress.status}
                          </p>
                        </div>
                      ) : null}
                      {datasetId && effectiveSnapshotStatus ? (
                        <p className="text-muted-foreground text-xs">
                          {t('plateJs.chart.snapshotStatus', {
                            status: effectiveSnapshotStatus,
                            count: Number(snapshotObservationCount),
                          })}
                        </p>
                      ) : null}
                    </div>

                    {datasetId && isEurostatDatasetReady ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium">{t('plateJs.chart.firstRows')}</p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {t('plateJs.chart.firstRowsHint')}
                          </p>
                        </div>
                        <EurostatObservationPreviewTable
                          dimensions={details.dimensions}
                          rows={observationRows}
                          loading={observationRowsLoading}
                        />
                      </div>
                    ) : null}

                    {datasetId && isEurostatDatasetReady ? (
                      <div className="space-y-4 border-t pt-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              {t('plateJs.chart.assignColumns')}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {t('plateJs.chart.assignColumnsHint')}
                            </p>
                          </div>
                          <StateBadge
                            status={missingFilterCount === 0 ? 'complete' : 'error'}
                            tone={missingFilterCount === 0 ? 'success' : 'destructive'}
                          >
                            {missingFilterCount === 0
                              ? t('plateJs.chart.filtersComplete')
                              : t('plateJs.chart.missingFilters', {
                                  count: missingFilterCount,
                                })}
                          </StateBadge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              !canApplyEurostatChartPreset(
                                details.dimensions,
                                'compareCountriesInYear'
                              )
                            }
                            onClick={() => applyEurostatPreset('compareCountriesInYear')}
                          >
                            {t('plateJs.chart.compareCountriesInYear')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              !canApplyEurostatChartPreset(
                                details.dimensions,
                                'showTimeSeriesForCountry'
                              )
                            }
                            onClick={() => applyEurostatPreset('showTimeSeriesForCountry')}
                          >
                            {t('plateJs.chart.showTimeSeriesForCountry')}
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <MappingSelect
                            label={t('plateJs.chart.xDimension')}
                            value={xDimension}
                            columns={details.dimensions.map(dimension => dimension.id)}
                            onChange={value => {
                              const next = value ?? '';
                              const nextSeriesDimension =
                                seriesDimension === next ? null : seriesDimension;
                              setXDimension(next);
                              setSeriesDimension(nextSeriesDimension);
                              setFilters(current =>
                                createDefaultEurostatFilters(
                                  details.dimensions,
                                  next,
                                  nextSeriesDimension,
                                  current
                                )
                              );
                            }}
                          />
                          <MappingSelect
                            label={t('plateJs.chart.yValue')}
                            value={valueField}
                            columns={getEurostatValueFields()}
                            onChange={value => setValueField(value || EUROSTAT_DEFAULT_VALUE_FIELD)}
                          />
                          <MappingSelect
                            label={t('plateJs.chart.seriesDimension')}
                            value={seriesDimension}
                            columns={details.dimensions
                              .map(dimension => dimension.id)
                              .filter(id => id !== xDimension)}
                            optional
                            onChange={value => {
                              setSeriesDimension(value);
                              setFilters(current =>
                                createDefaultEurostatFilters(
                                  details.dimensions,
                                  xDimension,
                                  value,
                                  current
                                )
                              );
                            }}
                          />
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-medium">{t('plateJs.chart.filters')}</p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {t('plateJs.chart.filtersHint')}
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {details.dimensions
                              .filter(
                                dimension =>
                                  dimension.id !== xDimension && dimension.id !== seriesDimension
                              )
                              .map(dimension => (
                                <SelectField
                                  key={dimension.id}
                                  label={
                                    dimension.label
                                      ? `${dimension.id} · ${dimension.label}`
                                      : dimension.id
                                  }
                                  value={filters[dimension.id] || undefined}
                                  onValueChange={value =>
                                    setFilters(current => ({
                                      ...current,
                                      [dimension.id]: value,
                                    }))
                                  }
                                  placeholder={t('plateJs.chart.chooseValue')}
                                  options={dimension.values.map(value => ({
                                    value: value.id,
                                    label: value.label ? `${value.id} · ${value.label}` : value.id,
                                  }))}
                                />
                              ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                          <p className="text-muted-foreground text-sm">
                            {isEurostatPreviewFresh
                              ? t('plateJs.chart.previewReady')
                              : eurostatPreviewIsStale
                                ? t('plateJs.chart.previewStale')
                                : t('plateJs.chart.previewNeeded')}
                          </p>
                          <Button
                            type="button"
                            variant={isEurostatPreviewFresh ? 'outline' : 'default'}
                            disabled={!canCreateEurostatPreview || isEurostatPreviewFresh}
                            onClick={() => void ensureEurostatProjectionPreview()}
                          >
                            {projecting ? <Loader2Icon className="size-4 animate-spin" /> : null}
                            {eurostatPreviewIsStale
                              ? t('plateJs.chart.refreshPreview')
                              : t('plateJs.chart.createChartPreview')}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-muted-foreground flex min-h-40 items-center justify-center border border-dashed px-6 text-center text-sm">
                    {t('plateJs.chart.searchHint')}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-5 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
            <FormFieldShell label={t('plateJs.chart.chartType')}>
              {() => <ChartTypePicker value={chartType} onChange={setChartType} />}
            </FormFieldShell>
            <TextField
              id="chart-title"
              label={t('plateJs.chart.title')}
              value={presentation.title ?? ''}
              onValueChange={value => setPresentation(current => ({ ...current, title: value }))}
            />
            <TextField
              id="chart-description"
              label={t('plateJs.chart.descriptionLabel')}
              rows={2}
              value={presentation.description ?? ''}
              onValueChange={value =>
                setPresentation(current => ({
                  ...current,
                  description: value,
                }))
              }
              multiline
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                id="chart-x-axis-label"
                label={t('plateJs.chart.xAxisLabel')}
                value={presentation.xAxisLabel ?? ''}
                onValueChange={value =>
                  setPresentation(current => ({
                    ...current,
                    xAxisLabel: value,
                  }))
                }
              />
              <TextField
                id="chart-y-axis-label"
                label={t('plateJs.chart.yAxisLabel')}
                value={presentation.yAxisLabel ?? ''}
                onValueChange={value =>
                  setPresentation(current => ({
                    ...current,
                    yAxisLabel: value,
                  }))
                }
              />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              <label className="flex items-center gap-2 text-sm font-normal">
                <InlineCheckbox
                  checked={presentation.showLegend !== false}
                  onCheckedChange={checked =>
                    setPresentation(current => ({ ...current, showLegend: checked === true }))
                  }
                />
                {t('plateJs.chart.legend')}
              </label>
              <label className="flex items-center gap-2 text-sm font-normal">
                <InlineCheckbox
                  checked={presentation.showTooltip !== false}
                  onCheckedChange={checked =>
                    setPresentation(current => ({ ...current, showTooltip: checked === true }))
                  }
                />
                {t('plateJs.chart.hoverValues')}
              </label>
              {chartType !== 'pie' ? (
                <label className="flex items-center gap-2 text-sm font-normal">
                  <InlineCheckbox
                    checked={presentation.showGrid !== false}
                    onCheckedChange={checked =>
                      setPresentation(current => ({ ...current, showGrid: checked === true }))
                    }
                  />
                  {t('plateJs.chart.grid')}
                </label>
              ) : (
                <label className="flex items-center gap-2 text-sm font-normal">
                  <InlineCheckbox
                    checked={presentation.donut !== false}
                    onCheckedChange={checked =>
                      setPresentation(current => ({ ...current, donut: checked === true }))
                    }
                  />
                  {t('plateJs.chart.donut')}
                </label>
              )}
            </div>
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">{t('plateJs.chart.preview')}</p>
              <ChartRenderer
                chartType={chartType}
                points={previewPoints}
                presentation={presentation}
                className="min-h-64"
              />
              {sourceKind === 'eurostat' ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  {isEurostatPreviewFresh
                    ? t('plateJs.chart.previewReady')
                    : eurostatPreviewIsStale
                      ? t('plateJs.chart.previewStale')
                      : t('plateJs.chart.previewNeeded')}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <p className="border-destructive/30 bg-destructive/5 text-destructive mx-5 border px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter className="bg-background sticky bottom-0 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t('plateJs.chart.cancel')}
          </Button>
          <Button type="button" onClick={runPrimaryAction} disabled={primaryButtonDisabled}>
            {projecting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {primaryButtonLabel}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
