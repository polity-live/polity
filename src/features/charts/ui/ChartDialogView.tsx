import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import {
  AreaChartIcon,
  BarChart3Icon,
  CheckIcon,
  LineChartIcon,
  Loader2Icon,
  PieChartIcon,
  UploadIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/features/shared/ui/ui/button';
import {
  FileUploadTrigger,
  FormControlLabel,
  FormFieldShell,
  InlineCheckbox,
  SelectField,
  TextField,
} from '@/features/shared/ui/form';
import { StateBadge, TokenBadge } from '@/features/shared/ui/status/StatusBadges';
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

import { inferChartMapping, parseChartCsv } from '../logic/chartData';
import {
  canApplyEurostatChartPreset,
  createDefaultEurostatFilters,
  getEurostatValueFields,
} from '../logic/eurostatChartPreview';
import { EUROSTAT_DEFAULT_VALUE_FIELD, type ChartType } from '../types';
import type { ChartDialogModel } from '../hooks/useChartDialogModel';
import { ChartRenderer } from './ChartRenderer';
import { EurostatObservationPreviewTable } from './EurostatObservationPreviewTable';
import { ManualChartTableEditor } from './ManualChartTableEditor';

interface ChartDialogViewProps {
  model: ChartDialogModel;
}

const NO_SERIES = '__none__';

function formatBytes(value: number) {
  if (value < 1_000_000) return `${Math.ceil(value / 1_000).toLocaleString()} kB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
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
      {steps.map((step: any, index: number) => (
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
      {options.map((option: any) => (
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
        ...columns.map((column: any) => ({ value: column, label: column })),
      ]}
    />
  );
}

export function ChartDialogView({ model }: ChartDialogViewProps) {
  const {
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
    searchResults,
    searching,
    details,
    loadingDetails,
    importProgress,
    importing,
    datasetId,
    filters,
    setFilters,
    xDimension,
    setXDimension,
    valueField,
    setValueField,
    seriesDimension,
    setSeriesDimension,
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
    progressValue,
    previewPoints,
    observationRowsLoading,
    primaryButtonLabel,
    primaryButtonDisabled,
    runPrimaryAction,
    ensureEurostatProjectionPreview,
  } = model;
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ScrollableDialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto p-0 sm:max-w-5xl">
        <DialogHeader separator className="px-5 py-4 pr-12">
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
                  <FileUploadTrigger
                    inputRef={fileInputRef}
                    inputProps={{
                      accept: '.csv,text/csv',
                      onChange: event => {
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
                      },
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <UploadIcon className="size-4" />
                    {t('plateJs.chart.uploadCsv')}
                  </FileUploadTrigger>
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
                    onValueChange={handleEurostatSearchChange}
                    placeholder={t('plateJs.chart.datasetPlaceholder')}
                    autoComplete="off"
                    className="pr-9"
                  />
                  {searching ? (
                    <Loader2Icon className="text-muted-foreground absolute right-3 bottom-3 size-4 animate-spin" />
                  ) : null}
                  {searchResults.length > 0 ? (
                    <div className="bg-popover absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto border shadow-md">
                      {searchResults.map((entry: any) => (
                        <Button
                          key={entry.code}
                          type="button"
                          variant="ghost"
                          className="hover:bg-accent h-auto w-full items-start justify-between rounded-none border-b px-3 py-2 text-left text-sm last:border-0"
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
                        </Button>
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
                            {t('generated.inline.0294_partitions_c5246599')}{' '}
                            {importProgress.observationCount.toLocaleString()}
                            {t('generated.inline.0295_observations_ffc09dde')}{' '}
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
                            columns={details.dimensions.map((dimension: any) => dimension.id)}
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
                              .map((dimension: any) => dimension.id)
                              .filter((id: any) => id !== xDimension)}
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
                                (dimension: any) =>
                                  dimension.id !== xDimension && dimension.id !== seriesDimension
                              )
                              .map((dimension: any) => (
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
                                  options={dimension.values.map((value: any) => ({
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
              <div className="flex items-center gap-2">
                <InlineCheckbox
                  id="chart-show-legend"
                  checked={presentation.showLegend !== false}
                  onCheckedChange={checked =>
                    setPresentation(current => ({ ...current, showLegend: checked === true }))
                  }
                />
                <FormControlLabel htmlFor="chart-show-legend">
                  {t('plateJs.chart.legend')}
                </FormControlLabel>
              </div>
              <div className="flex items-center gap-2">
                <InlineCheckbox
                  id="chart-show-tooltip"
                  checked={presentation.showTooltip !== false}
                  onCheckedChange={checked =>
                    setPresentation(current => ({ ...current, showTooltip: checked === true }))
                  }
                />
                <FormControlLabel htmlFor="chart-show-tooltip">
                  {t('plateJs.chart.hoverValues')}
                </FormControlLabel>
              </div>
              {chartType !== 'pie' ? (
                <div className="flex items-center gap-2">
                  <InlineCheckbox
                    id="chart-show-grid"
                    checked={presentation.showGrid !== false}
                    onCheckedChange={checked =>
                      setPresentation(current => ({ ...current, showGrid: checked === true }))
                    }
                  />
                  <FormControlLabel htmlFor="chart-show-grid">
                    {t('plateJs.chart.grid')}
                  </FormControlLabel>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <InlineCheckbox
                    id="chart-donut"
                    checked={presentation.donut !== false}
                    onCheckedChange={checked =>
                      setPresentation(current => ({ ...current, donut: checked === true }))
                    }
                  />
                  <FormControlLabel htmlFor="chart-donut">
                    {t('plateJs.chart.donut')}
                  </FormControlLabel>
                </div>
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

        <DialogFooter separator surface="background" sticky className="px-5 py-4">
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
