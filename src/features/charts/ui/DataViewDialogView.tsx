import * as React from 'react';
import {
  AreaChartIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  ChartNoAxesCombinedIcon,
  ChevronDownIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  FileUpIcon,
  LineChartIcon,
  Loader2Icon,
  PieChartIcon,
  SearchIcon,
  SigmaIcon,
  SlidersHorizontalIcon,
  Table2Icon,
  XIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import {
  FormControlLabel,
  InlineCheckbox,
  SelectField,
  TextField,
} from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Input } from '@/features/shared/ui/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/features/shared/ui/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import { cn } from '@/features/shared/utils/utils';
import { FileDropzone, type FileDropzoneRejection } from '@/features/file-upload/ui/FileDropzone';
import type { DataViewDialogModel } from '../hooks/useDataViewDialogModel';
import { getDataViewTitle, getValueColumnLayout } from '../logic/dataView';
import {
  MAX_DATASET_SNAPSHOT_BYTES,
  type ChartType,
  type DataAggregation,
  type DatasetProviderId,
  type DatasetSearchResult,
} from '../types';
import { ChartRenderer } from './ChartRenderer';
import { DataViewAttribution } from './DataViewAttribution';
import { ManualChartTableEditor } from './ManualChartTableEditor';

interface DataViewDialogViewProps {
  model: DataViewDialogModel;
}

const PROVIDERS: DatasetProviderId[] = ['EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA', 'UPLOAD'];
const NO_SERIES = '__none__';

function formatBytes(value?: number | null) {
  if (!value) return null;
  if (value < 1_000_000) return `${Math.ceil(value / 1_000).toLocaleString()} kB`;
  return `${(value / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;
}

function providerLabel(provider: DatasetProviderId) {
  if (provider === 'GENESIS_DESTATIS') return 'GENESIS/Destatis';
  if (provider === 'UPLOAD') return 'Eigene Daten';
  if (provider === 'GOVDATA') return 'GovData';
  return 'Eurostat';
}

function coverageSummary(result: DatasetSearchResult) {
  const time = result.timeCoverage;
  const timeLabel =
    time?.start && time?.end ? `${time.start}–${time.end}` : time?.start || time?.end || null;
  const spatial = result.spatialCoverage;
  const spatialLabel = Array.isArray(spatial)
    ? spatial.slice(0, 2).join(', ')
    : spatial && typeof spatial === 'object' && 'label' in spatial
      ? String(spatial.label ?? '')
      : null;
  return [timeLabel, spatialLabel].filter(Boolean).join(' · ');
}

function ResultRow({
  result,
  selected,
  onSelect,
}: {
  result: DatasetSearchResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const snapshotDate = result.snapshotTakenAt ?? result.modified;
  const coverage = coverageSummary(result);

  return (
    <button
      type="button"
      data-testid="dataset-result"
      aria-pressed={selected}
      className={cn(
        'hover:bg-muted/50 focus-visible:ring-ring w-full border-b px-4 py-3 text-left outline-none last:border-b-0 focus-visible:ring-2',
        selected && 'bg-muted'
      )}
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-sm font-normal">
              {providerLabel(result.provider)}
            </Badge>
            {result.groupId ? (
              <Badge variant="secondary" className="rounded-sm font-normal">
                {t('plateJs.dataView.groupData')}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-medium">{result.title}</p>
          {result.description ? (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs whitespace-pre-line">
              {result.description}
            </p>
          ) : null}
          <p className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {result.publisher ? <span>{result.publisher}</span> : null}
            {result.structureSummary ? <span>{result.structureSummary}</span> : null}
            {result.valueSummary ? <span>{result.valueSummary}</span> : null}
            {coverage ? <span>{coverage}</span> : null}
            {snapshotDate ? <span>{snapshotDate.slice(0, 10)}</span> : null}
          </p>
        </div>
        {formatBytes(result.byteSize) ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {formatBytes(result.byteSize)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ProviderFilter({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <SlidersHorizontalIcon className="size-4" />
          {t('plateJs.dataView.sources')}
          {model.providers.length < PROVIDERS.length ? (
            <Badge variant="secondary" className="rounded-sm px-1.5">
              {model.providers.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="mb-3 text-sm font-medium">{t('plateJs.dataView.searchSources')}</p>
        <div className="grid gap-2.5">
          {PROVIDERS.map(provider => (
            <label key={provider} className="flex items-center gap-2 text-sm">
              <InlineCheckbox
                id={`data-view-provider-${provider}`}
                checked={model.providers.includes(provider)}
                onCheckedChange={checked =>
                  model.setProviders(current =>
                    checked === true
                      ? current.includes(provider)
                        ? current
                        : [...current, provider]
                      : current.filter(item => item !== provider)
                  )
                }
              />
              <span>{providerLabel(provider)}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => model.setProviders(PROVIDERS)}
          >
            {t('plateJs.dataView.allSources')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => model.setProviders([])}>
            {t('plateJs.dataView.clear')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DatasetDetails({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  const result = model.selectedResult;
  if (!result) {
    return (
      <div className="text-muted-foreground flex h-full min-h-64 items-center justify-center px-8 text-center text-sm">
        {t('plateJs.dataView.chooseResult')}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 lg:hidden"
          onClick={() => model.setSelectedResult(null)}
        >
          <ArrowLeftIcon className="size-4" />
          {t('plateJs.dataView.backToResults')}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-sm">
            {providerLabel(result.provider)}
          </Badge>
          {result.snapshotTakenAt ? (
            <Badge variant="secondary" className="rounded-sm font-normal">
              {t('plateJs.dataView.dataAsOf', { date: result.snapshotTakenAt.slice(0, 10) })}
            </Badge>
          ) : null}
        </div>
        <div>
          <h3 className="text-base font-semibold">{result.title}</h3>
          {result.publisher ? (
            <p className="text-muted-foreground mt-1 text-sm">{result.publisher}</p>
          ) : null}
        </div>
        {result.description ? (
          <p className="text-muted-foreground text-sm leading-6 whitespace-pre-line">
            {result.description}
          </p>
        ) : null}
        <dl className="grid gap-4 border-y py-4 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {result.structureSummary ? (
            <div>
              <dt className="text-muted-foreground text-xs">{t('plateJs.dataView.structure')}</dt>
              <dd className="mt-1">{result.structureSummary}</dd>
            </div>
          ) : null}
          {result.valueSummary ? (
            <div>
              <dt className="text-muted-foreground text-xs">{t('plateJs.dataView.size')}</dt>
              <dd className="mt-1">{result.valueSummary}</dd>
            </div>
          ) : null}
          {result.license ? (
            <div>
              <dt className="text-muted-foreground text-xs">{t('plateJs.dataView.license')}</dt>
              <dd className="mt-1">{result.license}</dd>
            </div>
          ) : null}
          {result.modified ? (
            <div>
              <dt className="text-muted-foreground text-xs">{t('plateJs.dataView.updated')}</dt>
              <dd className="mt-1">{result.modified.slice(0, 10)}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="border-t p-4">
        <Button
          type="button"
          className="w-full"
          disabled={model.preparing || (result.byteSize ?? 0) > 50 * 1024 * 1024}
          onClick={() => void model.useSelectedDataset()}
        >
          {model.preparing ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {t('plateJs.dataView.useDataset')}
        </Button>
        {(result.byteSize ?? 0) > 50 * 1024 * 1024 ? (
          <p className="text-destructive mt-2 text-xs">{t('plateJs.dataView.tooLarge')}</p>
        ) : null}
      </div>
    </div>
  );
}

function Finder({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  const suggestions = [
    t('plateJs.dataView.suggestion.gdp'),
    t('plateJs.dataView.suggestion.population'),
    t('plateJs.dataView.suggestion.unemployment'),
    t('plateJs.dataView.suggestion.inflation'),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              aria-label={t('plateJs.dataView.searchLabel')}
              className="h-11 pl-10"
              value={model.searchQuery}
              placeholder={t('plateJs.dataView.searchPlaceholder')}
              onChange={event => {
                model.setSearchQuery(event.target.value);
                model.setSelectedResult(null);
              }}
            />
            {model.searching ? (
              <Loader2Icon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <ProviderFilter model={model} />
          </div>
        </div>
        {model.searchQuery.trim().length < 2 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map(suggestion => (
              <Button
                key={suggestion}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => model.setSearchQuery(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        ) : null}
        {model.providerErrors.length > 0 ? (
          <p className="text-muted-foreground mt-3 text-xs" role="status">
            {t('plateJs.dataView.partialResults', {
              sources: model.providerErrors.map(error => providerLabel(error.provider)).join(', '),
            })}
          </p>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <div
          className={cn(
            'min-h-0 overflow-y-auto border-b lg:block lg:border-r lg:border-b-0',
            model.selectedResult ? 'hidden' : 'block'
          )}
        >
          {model.searchResults.length > 0 ? (
            <div>
              {model.searchResults.map(result => (
                <ResultRow
                  key={result.id}
                  result={result}
                  selected={model.selectedResult?.id === result.id}
                  onSelect={() => model.setSelectedResult(result)}
                />
              ))}
            </div>
          ) : model.searchQuery.trim().length >= 2 && !model.searching ? (
            <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-4 px-8 text-center text-sm">
              <span>{t('plateJs.dataView.noResults')}</span>
              {model.canUploadDatasets ? (
                <Button type="button" variant="outline" onClick={() => model.setUploadOpen(true)}>
                  <FileUpIcon className="size-4" />
                  {t('plateJs.dataView.addDataset')}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-4 px-8 text-center text-sm">
              <DatabaseIcon className="size-8 opacity-50" />
              <span>{t('plateJs.dataView.searchHint')}</span>
              {model.canUploadDatasets ? (
                <div className="flex flex-col items-center gap-2">
                  <span>{t('plateJs.dataView.or')}</span>
                  <Button type="button" variant="outline" onClick={() => model.setUploadOpen(true)}>
                    <FileUpIcon className="size-4" />
                    {t('plateJs.dataView.addDataset')}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        <div
          className={cn(
            'min-h-0 overflow-hidden bg-[color-mix(in_oklab,var(--muted)_28%,transparent)] lg:block',
            model.selectedResult ? 'block' : 'hidden'
          )}
        >
          <DatasetDetails model={model} />
        </div>
      </div>
    </div>
  );
}

function DataSentence({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  const selectedValueColumnCount =
    model.query.valueColumns?.length ?? (model.query.measureColumn ? 1 : 0);
  const usesValueColumns = model.view === 'chart' && model.numericProfiles.length > 1;
  const updateTitle = (measure?: string | null, dimension?: string | null) => {
    const measureLabel = model.columnProfiles.find(profile => profile.name === measure)?.label;
    const dimensionLabel = model.columnProfiles.find(profile => profile.name === dimension)?.label;
    const selectedResult = model.selectedResult;
    if (!selectedResult) return;
    model.setPresentation(current => ({
      ...current,
      title: getDataViewTitle({
        datasetTitle: selectedResult.title,
        measureLabel,
        dimensionLabel,
        view: model.view,
      }),
    }));
  };

  return (
    <div className="bg-muted/35 flex flex-wrap items-end gap-2 border px-3 py-3">
      <span className="self-center text-sm">{t('plateJs.dataView.show')}</span>
      {usesValueColumns ? (
        <Badge variant="secondary" className="mb-0.5 rounded-sm px-2 py-1.5 font-normal">
          {t('plateJs.dataView.multipleMeasures', {
            count: selectedValueColumnCount,
          })}
        </Badge>
      ) : model.view !== 'table' ? (
        <SelectField
          label={t('plateJs.dataView.measure')}
          value={model.query.measureColumn ?? undefined}
          onValueChange={value => {
            model.setQuery(current => ({ ...current, measureColumn: value }));
            updateTitle(value, model.query.dimensionColumn);
          }}
          options={model.numericProfiles.map(profile => ({
            value: profile.name,
            label: profile.label,
          }))}
        />
      ) : null}
      {model.view === 'chart' && model.query.layout !== 'wide' ? (
        <>
          <span className="self-center text-sm">{t('plateJs.dataView.by')}</span>
          <SelectField
            label={t('plateJs.dataView.dimension')}
            value={model.query.dimensionColumn ?? undefined}
            onValueChange={value => {
              model.setQuery(current => ({ ...current, dimensionColumn: value }));
              updateTitle(model.query.measureColumn, value);
              const profile = model.columnProfiles.find(item => item.name === value);
              if (profile?.type === 'date') model.setChartType('line');
            }}
            options={model.dimensionProfiles.map(profile => ({
              value: profile.name,
              label: profile.label,
            }))}
          />
        </>
      ) : null}
      <FilterPopover model={model} />
    </div>
  );
}

function FilterPopover({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  return (
    <Popover onOpenChange={opened => opened && void model.loadFilterValues()}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="self-end">
          <SlidersHorizontalIcon className="size-4" />
          {t('plateJs.dataView.filters')}
          {model.activeFilterCount > 0 ? (
            <Badge variant="secondary" className="rounded-sm px-1.5">
              {model.activeFilterCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[60vh] w-[min(420px,calc(100vw-2rem))] overflow-y-auto p-4"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t('plateJs.dataView.filters')}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('plateJs.dataView.filtersHint')}
            </p>
          </div>
          {model.filterValuesLoading ? <Loader2Icon className="size-4 animate-spin" /> : null}
        </div>
        <div className="grid gap-3">
          {model.filterableProfiles.map(profile => (
            <div key={profile.name}>
              <label htmlFor={`filter-${profile.name}`} className="text-xs font-medium">
                {profile.label}
              </label>
              <Input
                id={`filter-${profile.name}`}
                className="mt-1"
                list={`filter-options-${profile.name}`}
                value={model.query.filters[profile.name] ?? ''}
                placeholder={t('plateJs.dataView.allValues')}
                onChange={event =>
                  model.setQuery(current => ({
                    ...current,
                    filters: { ...current.filters, [profile.name]: event.target.value },
                  }))
                }
              />
              <datalist id={`filter-options-${profile.name}`}>
                {(model.filterValues[profile.name] ?? []).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          ))}
        </div>
        {model.activeFilterCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => model.setQuery(current => ({ ...current, filters: {} }))}
          >
            {t('plateJs.dataView.clearFilters')}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function AggregationSelect({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  const aggregations: DataAggregation[] = ['sum', 'mean', 'median', 'min', 'max', 'count'];
  return (
    <SelectField
      label={t('plateJs.dataView.aggregation')}
      value={model.query.aggregation}
      onValueChange={value =>
        model.setQuery(current => ({ ...current, aggregation: value as DataAggregation }))
      }
      options={aggregations.map(aggregation => ({
        value: aggregation,
        label: t(`plateJs.dataView.aggregationValues.${aggregation}`),
      }))}
    />
  );
}

function ChartOptions({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  const availableValueColumns = model.numericProfiles.map(profile => profile.name);
  const configuredValueColumns = (model.query.valueColumns ?? []).filter(column =>
    availableValueColumns.includes(column)
  );
  const selectedValueColumns = new Set(
    configuredValueColumns.length > 0
      ? configuredValueColumns
      : model.query.measureColumn && availableValueColumns.includes(model.query.measureColumn)
        ? [model.query.measureColumn]
        : availableValueColumns.slice(0, 1)
  );
  const usesValueColumns = model.numericProfiles.length > 1;
  const hasMultipleValues = usesValueColumns && selectedValueColumns.size > 1;
  const chartTypes: { value: ChartType; icon: React.ReactNode; label: string }[] = [
    { value: 'bar', icon: <BarChart3Icon />, label: t('plateJs.chart.bar') },
    { value: 'line', icon: <LineChartIcon />, label: t('plateJs.chart.line') },
    { value: 'area', icon: <AreaChartIcon />, label: t('plateJs.chart.area') },
    { value: 'pie', icon: <PieChartIcon />, label: t('plateJs.chart.pie') },
  ];
  const seriesOptions = [
    { value: NO_SERIES, label: t('plateJs.dataView.noSeries') },
    ...model.dimensionProfiles
      .filter(profile => profile.name !== model.query.dimensionColumn)
      .map(profile => ({ value: profile.name, label: profile.label })),
  ];

  const setValueColumnVisibility = (column: string, visible: boolean) => {
    const nextSelected = new Set(selectedValueColumns);
    if (visible) nextSelected.add(column);
    else nextSelected.delete(column);
    if (nextSelected.size === 0) return;

    const valueColumns = availableValueColumns.filter(available => nextSelected.has(available));
    const layout = getValueColumnLayout(model.numericProfiles, valueColumns);
    model.setQuery(current => ({
      ...current,
      layout,
      valueColumns,
      measureColumn: valueColumns[0] ?? current.measureColumn,
      seriesColumn: null,
    }));
    if (valueColumns.length > 1 && model.chartType === 'pie') model.setChartType('bar');
  };

  return (
    <div className="grid gap-4">
      {usesValueColumns ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t('plateJs.dataView.valueColumns')}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const layout = getValueColumnLayout(model.numericProfiles, availableValueColumns);
                model.setQuery(current => ({
                  ...current,
                  layout,
                  valueColumns: availableValueColumns,
                  measureColumn: availableValueColumns[0] ?? current.measureColumn,
                  seriesColumn: null,
                }));
                if (availableValueColumns.length > 1 && model.chartType === 'pie') {
                  model.setChartType('bar');
                }
              }}
            >
              {t('plateJs.dataView.reset')}
            </Button>
          </div>
          <div className="grid max-h-44 gap-2 overflow-y-auto border p-3">
            {model.numericProfiles.map((profile, index) => {
              const checkboxId = `data-view-value-column-${index}`;
              const isOnlySelected =
                selectedValueColumns.size === 1 && selectedValueColumns.has(profile.name);
              return (
                <div key={profile.name} className="flex items-center gap-2 text-sm">
                  <InlineCheckbox
                    id={checkboxId}
                    checked={selectedValueColumns.has(profile.name)}
                    disabled={isOnlySelected}
                    onCheckedChange={checked =>
                      setValueColumnVisibility(profile.name, checked === true)
                    }
                  />
                  <FormControlLabel htmlFor={checkboxId} className="min-w-0 flex-1 truncate">
                    {profile.label}
                  </FormControlLabel>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <AggregationSelect model={model} />
      {model.query.layout === 'long' ? (
        <SelectField
          label={t('plateJs.dataView.series')}
          value={model.query.seriesColumn || NO_SERIES}
          onValueChange={value =>
            model.setQuery(current => ({
              ...current,
              seriesColumn: value === NO_SERIES ? null : value,
            }))
          }
          options={seriesOptions}
        />
      ) : null}
      <div>
        <p className="mb-2 text-sm font-medium">{t('plateJs.dataView.chartType')}</p>
        <ToggleGroup
          type="single"
          value={model.chartType}
          onValueChange={value => value && model.setChartType(value as ChartType)}
          className="grid grid-cols-4"
        >
          {chartTypes.map(option => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              aria-label={option.label}
              title={option.label}
              disabled={option.value === 'pie' && hasMultipleValues}
              className="h-9"
            >
              {option.icon}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}

function TableOptions({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  const defaultColumns = React.useMemo(
    () => model.columnProfiles.slice(0, 6).map(profile => profile.name),
    [model.columnProfiles]
  );
  const selected = new Set(model.query.columns ?? defaultColumns);

  const setColumnVisibility = (column: string, visible: boolean) => {
    model.setQuery(current => {
      const nextSelected = new Set(current.columns ?? defaultColumns);
      if (visible) nextSelected.add(column);
      else nextSelected.delete(column);

      if (nextSelected.size === 0) return current;
      const columns = model.columnProfiles
        .map(profile => profile.name)
        .filter(profileColumn => nextSelected.has(profileColumn));
      return {
        ...current,
        columns,
        sort: current.sort && !nextSelected.has(current.sort.column) ? null : current.sort,
      };
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{t('plateJs.dataView.visibleColumns')}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              model.setQuery(current => ({
                ...current,
                columns: defaultColumns,
              }))
            }
          >
            {t('plateJs.dataView.reset')}
          </Button>
        </div>
        <div className="grid max-h-44 gap-2 overflow-y-auto border p-3">
          {model.columnProfiles.map((profile, index) => {
            const checkboxId = `data-view-column-${index}`;
            const isOnlyVisibleColumn = selected.size === 1 && selected.has(profile.name);
            return (
              <div key={profile.name} className="flex items-center gap-2 text-sm">
                <InlineCheckbox
                  id={checkboxId}
                  checked={selected.has(profile.name)}
                  disabled={isOnlyVisibleColumn}
                  onCheckedChange={checked => setColumnVisibility(profile.name, checked === true)}
                />
                <FormControlLabel htmlFor={checkboxId} className="min-w-0 flex-1 truncate">
                  {profile.label}
                </FormControlLabel>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <SelectField
          label={t('plateJs.dataView.rows')}
          value={String(model.query.limit ?? 10)}
          onValueChange={value =>
            model.setQuery(current => ({ ...current, limit: Number(value) as 5 | 10 | 25 | 50 }))
          }
          options={[5, 10, 25, 50].map(value => ({ value: String(value), label: String(value) }))}
        />
        <SelectField
          label={t('plateJs.dataView.sortBy')}
          value={model.query.sort?.column ?? NO_SERIES}
          onValueChange={value =>
            model.setQuery(current => ({
              ...current,
              sort: value === NO_SERIES ? null : { column: value, direction: 'asc' },
            }))
          }
          options={[
            { value: NO_SERIES, label: t('plateJs.dataView.noSorting') },
            ...model.columnProfiles.map(profile => ({ value: profile.name, label: profile.label })),
          ]}
        />
      </div>
      {model.query.sort ? (
        <Tabs
          value={model.query.sort.direction}
          onValueChange={direction =>
            model.setQuery(current => ({
              ...current,
              sort: current.sort
                ? { ...current.sort, direction: direction as 'asc' | 'desc' }
                : null,
            }))
          }
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="asc">{t('plateJs.dataView.ascending')}</TabsTrigger>
            <TabsTrigger value="desc">{t('plateJs.dataView.descending')}</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}
    </div>
  );
}

function AdvancedOptions({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="w-full justify-between px-0">
          {t('plateJs.dataView.moreOptions')}
          <ChevronDownIcon className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3">
        {model.view === 'chart' && model.query.layout === 'wide' ? (
          <div className="border-b pb-4">
            <SelectField
              label={t('plateJs.dataView.rowLabel')}
              value={model.query.dimensionColumn ?? undefined}
              onValueChange={value =>
                model.setQuery(current => ({ ...current, dimensionColumn: value }))
              }
              options={model.dimensionProfiles.map(profile => ({
                value: profile.name,
                label: profile.label,
              }))}
            />
          </div>
        ) : null}
        <TextField
          id="data-view-title"
          label={t('plateJs.dataView.title')}
          value={model.presentation.title ?? ''}
          onValueChange={value => model.setPresentation(current => ({ ...current, title: value }))}
        />
        <TextField
          id="data-view-description"
          label={t('plateJs.dataView.description')}
          value={model.presentation.description ?? ''}
          onValueChange={value =>
            model.setPresentation(current => ({ ...current, description: value }))
          }
          multiline
          rows={2}
        />
        {model.view === 'chart' && model.chartType !== 'pie' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <TextField
              id="data-view-x-label"
              label={t('plateJs.dataView.xAxis')}
              value={model.presentation.xAxisLabel ?? ''}
              onValueChange={value =>
                model.setPresentation(current => ({ ...current, xAxisLabel: value }))
              }
            />
            <TextField
              id="data-view-y-label"
              label={t('plateJs.dataView.yAxis')}
              value={model.presentation.yAxisLabel ?? ''}
              onValueChange={value =>
                model.setPresentation(current => ({ ...current, yAxisLabel: value }))
              }
            />
          </div>
        ) : null}
        {model.view === 'chart' ? (
          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm">
              <InlineCheckbox
                id="data-view-legend"
                checked={model.presentation.showLegend !== false}
                onCheckedChange={checked =>
                  model.setPresentation(current => ({ ...current, showLegend: checked === true }))
                }
              />
              <FormControlLabel htmlFor="data-view-legend">
                {t('plateJs.chart.legend')}
              </FormControlLabel>
            </label>
            {model.chartType !== 'pie' ? (
              <label className="flex items-center gap-2 text-sm">
                <InlineCheckbox
                  id="data-view-grid"
                  checked={model.presentation.showGrid !== false}
                  onCheckedChange={checked =>
                    model.setPresentation(current => ({ ...current, showGrid: checked === true }))
                  }
                />
                <FormControlLabel htmlFor="data-view-grid">
                  {t('plateJs.chart.grid')}
                </FormControlLabel>
              </label>
            ) : null}
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProjectionPreview({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  const projection = model.projection;
  if (model.projectionLoading) {
    return (
      <div className="text-muted-foreground flex min-h-80 items-center justify-center gap-2 text-sm">
        <Loader2Icon className="size-4 animate-spin" />
        {t('plateJs.dataView.updatingPreview')}
      </div>
    );
  }
  if (model.projectionError) {
    return (
      <div className="text-destructive flex min-h-80 items-center justify-center px-8 text-center text-sm">
        {model.projectionError}
      </div>
    );
  }
  if (!projection) {
    return (
      <div className="text-muted-foreground flex min-h-80 items-center justify-center px-8 text-center text-sm">
        {t('plateJs.dataView.previewHint')}
      </div>
    );
  }
  const attribution =
    model.snapshot && model.selectedResult ? (
      <DataViewAttribution
        className="mt-3"
        source={{
          provider: model.snapshot.provider,
          publisher: model.selectedResult.publisher,
          sourceUrl: model.selectedResult.sourceUrl,
          snapshotTakenAt: model.snapshot.snapshotTakenAt,
        }}
      />
    ) : null;
  if (projection.view === 'chart') {
    return (
      <div>
        <ChartRenderer
          chartType={model.chartType}
          points={projection.points}
          presentation={model.presentation}
          className="min-h-80"
        />
        {attribution}
      </div>
    );
  }
  if (projection.view === 'stat') {
    return (
      <div>
        <div className="flex min-h-80 items-center justify-center p-6">
          <div className="w-full max-w-md border-y py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {model.presentation.title || projection.label}
            </p>
            <p className="mt-3 text-4xl font-semibold tabular-nums">
              {projection.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              {t(`plateJs.dataView.aggregationValues.${projection.aggregation}`)} ·{' '}
              {t('plateJs.dataView.rowsMatched', { count: projection.rowCount })}
            </p>
          </div>
        </div>
        {attribution}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      {model.presentation.title ? (
        <div className="mb-4">
          <p className="text-sm font-semibold">{model.presentation.title}</p>
          {model.presentation.description ? (
            <p className="text-muted-foreground mt-1 text-xs">{model.presentation.description}</p>
          ) : null}
        </div>
      ) : null}
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            {projection.columns.map(column => (
              <th key={column} className="bg-muted/40 px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projection.rows.map((row, index) => (
            <tr key={index} className="border-b last:border-b-0">
              {projection.columns.map(column => (
                <td key={column} className="px-3 py-2 align-top">
                  {row[column]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground mt-3 text-xs">
        {t('plateJs.dataView.rowsMatched', { count: projection.rowCount })}
      </p>
      {attribution}
    </div>
  );
}

function Builder({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{model.selectedResult?.title}</p>
            <p className="text-muted-foreground truncate text-xs">
              {model.snapshot ? providerLabel(model.snapshot.provider) : null}
              {model.snapshot?.snapshotTakenAt
                ? ` · ${t('plateJs.dataView.dataAsOf', { date: model.snapshot.snapshotTakenAt.slice(0, 10) })}`
                : ''}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={model.changeDataset}>
          {t('plateJs.dataView.changeDataset')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid min-h-full lg:grid-cols-[minmax(300px,0.68fr)_minmax(0,1.32fr)]">
          <div className="space-y-5 border-b p-5 lg:border-r lg:border-b-0">
            <Tabs
              value={model.view}
              onValueChange={value => model.setView(value as 'chart' | 'table' | 'stat')}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chart" onClick={() => model.setView('chart')}>
                  <ChartNoAxesCombinedIcon className="size-4" />
                  {t('plateJs.dataView.chart')}
                </TabsTrigger>
                <TabsTrigger value="table" onClick={() => model.setView('table')}>
                  <Table2Icon className="size-4" />
                  {t('plateJs.dataView.table')}
                </TabsTrigger>
                <TabsTrigger value="stat" onClick={() => model.setView('stat')}>
                  <SigmaIcon className="size-4" />
                  {t('plateJs.dataView.stat')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <DataSentence model={model} />
            {model.view === 'chart' ? <ChartOptions model={model} /> : null}
            {model.view === 'table' ? <TableOptions model={model} /> : null}
            {model.view === 'stat' ? <AggregationSelect model={model} /> : null}
            <AdvancedOptions model={model} />
          </div>
          <div className="min-w-0 p-5 lg:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{t('plateJs.dataView.preview')}</p>
              {model.projection ? (
                <Badge variant="secondary" className="rounded-sm font-normal">
                  {t('plateJs.dataView.livePreview')}
                </Badge>
              ) : null}
            </div>
            <ProjectionPreview model={model} />
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadSheet({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  const handleRejectedFiles = (rejections: FileDropzoneRejection[]) => {
    const code = rejections[0]?.code;
    model.setUploadError(
      code === 'file-size'
        ? t('plateJs.dataView.fileTooLarge')
        : code === 'too-many-files'
          ? t('plateJs.dataView.tooManyFiles')
          : t('plateJs.dataView.invalidFileType')
    );
  };

  return (
    <Sheet open={model.uploadOpen} onOpenChange={model.setUploadOpen}>
      <SheetContent
        className="flex w-full flex-col sm:max-w-xl"
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{t('plateJs.dataView.addOwnData')}</SheetTitle>
          <SheetDescription>
            {model.selectedUploadGroupName
              ? t('plateJs.dataView.uploadForGroup', { group: model.selectedUploadGroupName })
              : t('plateJs.dataView.selectUploadGroupDescription')}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-5">
          <Tabs
            value={model.uploadMode}
            onValueChange={value => model.setUploadMode(value as 'file' | 'manual')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="file"
                disabled={model.uploading}
                onClick={() => model.setUploadMode('file')}
              >
                <FileSpreadsheetIcon className="size-4" />
                {t('plateJs.dataView.uploadFile')}
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                disabled={model.uploading}
                onClick={() => model.setUploadMode('manual')}
              >
                <DatabaseIcon className="size-4" />
                {t('plateJs.dataView.enterData')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <SelectField
            label={t('plateJs.dataView.uploadGroup')}
            placeholder={t('plateJs.dataView.selectUploadGroup')}
            value={model.uploadGroupId || undefined}
            onValueChange={model.setUploadGroupId}
            options={model.uploadGroups.map(group => ({ value: group.id, label: group.name }))}
            required
            disabled={
              model.uploading || model.uploadGroupsLoading || model.uploadGroups.length === 0
            }
          />
          {!model.uploadGroupsLoading && model.uploadGroups.length === 0 ? (
            <p className="border-border bg-muted/30 text-muted-foreground border px-3 py-2 text-sm">
              {t('plateJs.dataView.noUploadGroups')}
            </p>
          ) : null}
          <TextField
            id="data-upload-title"
            label={t('plateJs.dataView.datasetTitle')}
            value={model.uploadTitle}
            onValueChange={model.setUploadTitle}
            required={model.uploadMode === 'manual'}
            disabled={model.uploading}
          />
          <TextField
            id="data-upload-description"
            label={t('plateJs.dataView.datasetDescription')}
            value={model.uploadDescription}
            onValueChange={model.setUploadDescription}
            multiline
            rows={2}
            disabled={model.uploading}
          />
          {model.uploadMode === 'file' ? (
            <div className="space-y-3">
              <FileDropzone
                accept=".csv,.tsv,text/csv,text/tab-separated-values,application/csv,application/vnd.ms-excel"
                maxFiles={1}
                maxSize={MAX_DATASET_SNAPSHOT_BYTES}
                disabled={model.uploading}
                busy={model.uploading}
                idleLabel={t('plateJs.dataView.dropFile')}
                activeLabel={t('plateJs.dataView.dropFileHere')}
                browseLabel={
                  model.uploadFile
                    ? t('plateJs.dataView.replaceFile')
                    : t('plateJs.dataView.chooseFile')
                }
                busyLabel={t('plateJs.dataView.uploading')}
                hint={t('plateJs.dataView.fileLimit')}
                testId="dataset-upload-dropzone"
                inputProps={{ 'aria-label': t('plateJs.dataView.chooseFile') }}
                onFilesSelected={files => model.setUploadFile(files[0] ?? null)}
                onFilesRejected={handleRejectedFiles}
              />
              {model.uploadFile ? (
                <div
                  className="flex items-center gap-3 border px-3 py-2"
                  data-testid="dataset-upload-file"
                >
                  <FileSpreadsheetIcon className="text-muted-foreground size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{model.uploadFile.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatBytes(model.uploadFile.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={model.uploading}
                    title={t('plateJs.dataView.removeFile')}
                    onClick={() => model.setUploadFile(null)}
                  >
                    <XIcon className="size-4" />
                    <span className="sr-only">{t('plateJs.dataView.removeFile')}</span>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <ManualChartTableEditor
              table={model.manualTable}
              onChange={model.setManualTable}
              readOnly={model.uploading}
            />
          )}
          {model.uploadError ? (
            <p
              className="border-destructive/30 bg-destructive/5 text-destructive border px-3 py-2 text-sm"
              role="alert"
            >
              {model.uploadError}
            </p>
          ) : null}
        </div>
        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            disabled={model.uploading}
            onClick={() => model.setUploadOpen(false)}
          >
            {t('plateJs.dataView.cancel')}
          </Button>
          <Button
            type="button"
            disabled={
              model.uploading || model.uploadGroupsLoading || model.uploadGroups.length === 0
            }
            onClick={() => void model.submitUpload()}
          >
            {model.uploading ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t('plateJs.dataView.useOwnData')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function DataViewDialogView({ model }: DataViewDialogViewProps) {
  const { t } = useTranslation();
  const insertLabel = model.editingElement
    ? t('plateJs.dataView.update')
    : model.view === 'table'
      ? t('plateJs.dataView.insertTable')
      : model.view === 'stat'
        ? t('plateJs.dataView.insertStat')
        : t('plateJs.dataView.insertChart');

  return (
    <Dialog open={model.open} onOpenChange={model.setOpen}>
      <ScrollableDialogContent
        className="bg-background flex h-dvh !max-h-none w-screen max-w-none flex-col overflow-hidden rounded-none p-0 sm:h-[min(820px,calc(100dvh-3rem))] sm:w-[min(1200px,calc(100vw-3rem))] sm:max-w-none sm:rounded-md"
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogHeader separator className="px-5 py-4 pr-12">
          <DialogTitle>
            {model.editingElement
              ? t('plateJs.dataView.editTitle')
              : t('plateJs.dataView.insertTitle')}
          </DialogTitle>
          <DialogDescription>
            {model.stage === 'find'
              ? t('plateJs.dataView.findDescription')
              : t('plateJs.dataView.buildDescription')}
          </DialogDescription>
        </DialogHeader>

        {model.stage === 'find' ? <Finder model={model} /> : <Builder model={model} />}

        {model.error ? (
          <p className="border-destructive/30 bg-destructive/5 text-destructive mx-5 mb-3 border px-3 py-2 text-sm">
            {model.error}
          </p>
        ) : null}

        {model.stage === 'build' ? (
          <DialogFooter separator surface="background" className="px-5 py-3">
            <Button type="button" disabled={!model.canInsert} onClick={model.save}>
              {model.projectionLoading ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {insertLabel}
            </Button>
          </DialogFooter>
        ) : null}
        <UploadSheet model={model} />
      </ScrollableDialogContent>
    </Dialog>
  );
}
