import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import type { Dispatch, SetStateAction } from 'react';
import {
  AreaChartIcon,
  BarChart3Icon,
  LineChartIcon,
  Loader2Icon,
  PieChartIcon,
  UploadIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/features/shared/ui/ui/button';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
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

import {
  getChartMappingValueColumns,
  inferChartMapping,
  parseChartCsv,
  type ParsedChartTable,
} from '../logic/chartData';
import {
  canApplyEurostatChartPreset,
  createDefaultEurostatFilters,
  getEurostatValueFields,
} from '../logic/eurostatChartPreview';
import {
  EUROSTAT_DEFAULT_VALUE_FIELD,
  type ChartMapping,
  type ChartTableMode,
  type ChartType,
  type OfficialDataProviderId,
  type OfficialDataSearchResult,
} from '../types';
import type { ChartDialogModel } from '../hooks/useChartDialogModel';
import { ChartRenderer } from './ChartRenderer';
import { ManualChartTableEditor } from './ManualChartTableEditor';

interface ChartDialogViewProps {
  model: ChartDialogModel;
}

const NO_SERIES = '__none__';

function formatBytes(value: number) {
  if (value < 1_000_000) return `${Math.ceil(value / 1_000).toLocaleString()} kB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
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

function TableAxisSetup({
  table,
  mapping,
  setMapping,
}: {
  table: ParsedChartTable;
  mapping: ChartMapping;
  setMapping: Dispatch<SetStateAction<ChartMapping>>;
}) {
  const { t } = useTranslation();
  const mode = mapping.tableMode ?? 'columnMapping';
  const selectedValueColumns = getChartMappingValueColumns(table, mapping);
  const valueColumnSet = new Set(selectedValueColumns);
  const availableValueColumns = table.columns.filter(column => column !== mapping.xColumn);

  const updateMode = (nextMode: ChartTableMode) => {
    setMapping(current => {
      const nextValueColumns =
        nextMode === 'columnMapping'
          ? (current.valueColumns ?? [])
          : getChartMappingValueColumns(table, {
              ...current,
              tableMode: nextMode,
            });
      return {
        ...current,
        tableMode: nextMode,
        valueColumn:
          nextMode === 'columnMapping' ? current.valueColumn : (nextValueColumns[0] ?? ''),
        valueColumns: nextMode === 'columnMapping' ? current.valueColumns : nextValueColumns,
        seriesColumn: nextMode === 'columnMapping' ? current.seriesColumn : null,
      };
    });
  };

  const updateWideValueColumn = (column: string, checked: boolean) => {
    setMapping(current => {
      const currentColumns = getChartMappingValueColumns(table, current);
      const nextValueColumns = checked
        ? [...currentColumns, column]
        : currentColumns.filter(item => item !== column);

      return {
        ...current,
        valueColumn: nextValueColumns[0] ?? '',
        valueColumns: nextValueColumns,
      };
    });
  };

  return (
    <div className="space-y-4">
      <SelectField
        label={t('plateJs.chart.tableOrientation')}
        value={mode}
        onValueChange={value => updateMode(value as ChartTableMode)}
        options={[
          { value: 'columnMapping', label: t('plateJs.chart.orientationColumnMapping') },
          { value: 'rowsAsSeries', label: t('plateJs.chart.orientationColumnsAsXAxis') },
          { value: 'columnsAsSeries', label: t('plateJs.chart.orientationRowsAsXAxis') },
        ]}
      />

      {mode === 'columnMapping' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <MappingSelect
            label={t('plateJs.chart.category')}
            value={mapping.xColumn}
            columns={table.columns}
            onChange={value => setMapping(current => ({ ...current, xColumn: value ?? '' }))}
          />
          <MappingSelect
            label={t('plateJs.chart.numericValue')}
            value={mapping.valueColumn}
            columns={table.columns}
            onChange={value => setMapping(current => ({ ...current, valueColumn: value ?? '' }))}
          />
          <MappingSelect
            label={t('plateJs.chart.series')}
            value={mapping.seriesColumn}
            columns={table.columns}
            optional
            onChange={value => setMapping(current => ({ ...current, seriesColumn: value }))}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <MappingSelect
            label={t('plateJs.chart.rowLabelColumn')}
            value={mapping.xColumn}
            columns={table.columns}
            onChange={value =>
              setMapping(current => {
                const nextXColumn = value ?? '';
                const nextValueColumns = getChartMappingValueColumns(table, current).filter(
                  column => column !== nextXColumn
                );
                return {
                  ...current,
                  xColumn: nextXColumn,
                  valueColumn: nextValueColumns[0] ?? '',
                  valueColumns: nextValueColumns,
                };
              })
            }
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t('plateJs.chart.valueColumns')}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {mode === 'rowsAsSeries'
                    ? t('plateJs.chart.columnsAsXAxisHint')
                    : t('plateJs.chart.rowsAsXAxisHint')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMapping(current => ({
                      ...current,
                      valueColumn: availableValueColumns[0] ?? '',
                      valueColumns: availableValueColumns,
                    }))
                  }
                >
                  {t('plateJs.chart.selectAll')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMapping(current => ({
                      ...current,
                      valueColumn: '',
                      valueColumns: [],
                    }))
                  }
                >
                  {t('plateJs.chart.clear')}
                </Button>
              </div>
            </div>
            <div className="grid max-h-44 gap-2 overflow-y-auto border p-3 sm:grid-cols-2">
              {availableValueColumns.map((column, index) => (
                <label key={column} className="flex min-w-0 items-center gap-2 text-sm">
                  <InlineCheckbox
                    id={`chart-value-column-${index}`}
                    checked={valueColumnSet.has(column)}
                    onCheckedChange={checked => updateWideValueColumn(column, checked === true)}
                  />
                  <span className="truncate">{column}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OfficialProviderPicker({ model }: ChartDialogViewProps) {
  const {
    officialProviderSearch,
    setOfficialProviderSearch,
    officialProviders,
    toggleOfficialProvider,
    selectAllOfficialProviders,
    clearOfficialProviders,
    availableGovDataSources,
    govDataSourceFilters,
    toggleGovDataSourceFilter,
    selectAllGovDataSources,
    clearGovDataSourceFilters,
  } = model;
  const { t } = useTranslation();
  const query = officialProviderSearch.trim().toLowerCase();
  const providerOptions: { id: OfficialDataProviderId; label: string }[] = [
    { id: 'govdata', label: t('plateJs.chart.govDataSource') },
    { id: 'eurostat', label: t('plateJs.chart.eurostatSource') },
  ];
  const providers = providerOptions.filter(provider =>
    provider.label.toLowerCase().includes(query)
  );
  const visibleSources = availableGovDataSources.filter(source =>
    source.toLowerCase().includes(query)
  );
  const govDataSourceFilterSet = new Set(govDataSourceFilters);

  return (
    <div className="space-y-2">
      <TextField
        id="official-provider-search"
        label={t('plateJs.chart.providerFilter')}
        value={officialProviderSearch}
        onValueChange={setOfficialProviderSearch}
        placeholder={t('plateJs.chart.providerFilterPlaceholder')}
        autoComplete="off"
      />
      <div className="space-y-3 border p-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAllOfficialProviders}>
            {t('plateJs.chart.selectAll')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearOfficialProviders}>
            {t('plateJs.chart.clear')}
          </Button>
        </div>
        <div className="grid gap-2">
          {providers.map(provider => (
            <label key={provider.id} className="flex items-center gap-2 text-sm">
              <InlineCheckbox
                id={`official-provider-${provider.id}`}
                checked={officialProviders.includes(provider.id)}
                onCheckedChange={checked => toggleOfficialProvider(provider.id, checked === true)}
              />
              <span>{provider.label}</span>
            </label>
          ))}
        </div>
        {officialProviders.includes('govdata') && visibleSources.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{t('plateJs.chart.govDataSources')}</p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={selectAllGovDataSources}>
                  {t('plateJs.chart.selectAll')}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearGovDataSourceFilters}>
                  {t('plateJs.chart.clear')}
                </Button>
              </div>
            </div>
            <div className="grid max-h-36 gap-2 overflow-y-auto">
              {visibleSources.map((source, index) => (
                <label key={source} className="flex min-w-0 items-center gap-2 text-sm">
                  <InlineCheckbox
                    id={`govdata-source-filter-${index}`}
                    checked={
                      govDataSourceFilters.length === 0 || govDataSourceFilterSet.has(source)
                    }
                    onCheckedChange={checked => toggleGovDataSourceFilter(source, checked === true)}
                  />
                  <span className="truncate">{source}</span>
                </label>
              ))}
            </div>
            {govDataSourceFilters.length === 0 ? (
              <p className="text-muted-foreground text-xs">{t('plateJs.chart.allSourcesActive')}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OfficialResultCard({
  result,
  onSelect,
}: {
  result: OfficialDataSearchResult;
  onSelect: (result: OfficialDataSearchResult) => void;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      className="hover:bg-accent h-auto w-full items-start rounded-none border-b px-3 py-3 text-left text-sm last:border-0"
      onClick={() => onSelect(result)}
    >
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <TokenBadge>
            {result.provider === 'govdata'
              ? t('plateJs.chart.govDataSource')
              : t('plateJs.chart.eurostatSource')}
          </TokenBadge>
          {result.code ? (
            <span className="text-muted-foreground text-xs">{result.code}</span>
          ) : null}
        </span>
        <span className="block font-medium">{result.title}</span>
        {result.description ? (
          <span className="text-muted-foreground line-clamp-2 text-xs">{result.description}</span>
        ) : null}
        <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {result.source ? <span>{result.source}</span> : null}
          {result.formatSummary ? <span>{result.formatSummary}</span> : null}
          {result.valueSummary ? <span>{result.valueSummary}</span> : null}
          {result.modified ? <span>{result.modified.slice(0, 10)}</span> : null}
        </span>
      </span>
    </Button>
  );
}

function OfficialSearchSuggestions({ onSearch }: { onSearch: (query: string) => void }) {
  const { t } = useTranslation();
  const suggestions = ['GDP', 'unemployment', 'population', 'inflation', 'employment'];

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map(suggestion => (
        <Button
          key={suggestion}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSearch(suggestion)}
        >
          {t(`plateJs.chart.suggestion.${suggestion}`, suggestion)}
        </Button>
      ))}
    </div>
  );
}

function GovDataDatasetDetails({ model }: ChartDialogViewProps) {
  const {
    table,
    setTable,
    mapping,
    setMapping,
    govDataSelectedEntry,
    govDataSelectedResource,
    setGovDataSelectedResource,
    govDataImporting,
    govDataImported,
    govDataProvenance,
    runGovDataImport,
  } = model;
  const { t } = useTranslation();

  if (!govDataSelectedEntry) return null;

  const selectedResourceId = govDataSelectedResource?.id;
  const resourceOptions = govDataSelectedEntry.resources.map(resource => ({
    value: resource.id,
    label: `${resource.name} · ${resource.format}${
      resource.size ? ` · ${formatBytes(resource.size)}` : ''
    }`,
  }));

  return (
    <div className="space-y-5">
      <div className="space-y-2 border-y py-4">
        <div className="flex flex-wrap items-center gap-2">
          <TokenBadge>{t('plateJs.chart.govDataSource')}</TokenBadge>
          <StateBadge status="active" tone="neutral">
            {t('plateJs.chart.csvResources', {
              count: govDataSelectedEntry.resources.length,
            })}
          </StateBadge>
        </div>
        <p className="text-sm font-medium">{govDataSelectedEntry.title}</p>
        <p className="text-muted-foreground text-xs">
          {govDataSelectedEntry.publisher ||
            govDataSelectedEntry.organizationTitle ||
            govDataSelectedEntry.name}
        </p>
        {govDataSelectedEntry.notes ? (
          <p className="text-muted-foreground line-clamp-4 text-xs">{govDataSelectedEntry.notes}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <SelectField
          label={t('plateJs.chart.govDataResource')}
          value={selectedResourceId}
          onValueChange={value => {
            const nextResource =
              govDataSelectedEntry.resources.find(resource => resource.id === value) ?? null;
            setGovDataSelectedResource(nextResource);
          }}
          options={resourceOptions}
        />
        <div className="flex items-end">
          <Button
            type="button"
            disabled={!govDataSelectedResource || govDataImporting}
            onClick={() => void runGovDataImport()}
          >
            {govDataImporting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t('plateJs.chart.importResource')}
          </Button>
        </div>
      </div>

      {govDataSelectedResource ? (
        <p className="text-muted-foreground text-xs">
          {[
            govDataSelectedResource.format,
            govDataSelectedResource.mimetype,
            govDataSelectedResource.size ? formatBytes(govDataSelectedResource.size) : null,
            govDataSelectedResource.modified?.slice(0, 10),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}

      {govDataImported ? (
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t('plateJs.chart.dataTable')}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t('plateJs.chart.govDataImportedSummary', {
                  rows: table.rows.length,
                  columns: table.columns.length,
                })}
              </p>
            </div>
            {govDataProvenance ? (
              <StateBadge status="complete" tone="success">
                {t('plateJs.chart.snapshotReady')}
              </StateBadge>
            ) : null}
          </div>
          <ManualChartTableEditor table={table} onChange={setTable} />
          <TableAxisSetup table={table} mapping={mapping} setMapping={setMapping} />
        </div>
      ) : (
        <div className="text-muted-foreground flex min-h-32 items-center justify-center border border-dashed px-6 text-center text-sm">
          {t('plateJs.chart.govDataImportHint')}
        </div>
      )}
    </div>
  );
}

function EurostatDatasetDetails({ model }: ChartDialogViewProps) {
  const {
    table,
    setTable,
    mapping,
    setMapping,
    details,
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
    eurostatTableReady,
    effectiveSnapshotStatus,
    snapshotObservationCount,
    isEurostatDatasetReady,
    missingFilterCount,
    canCreateEurostatPreview,
    invalidateEurostatEditableTable,
    applyEurostatPreset,
    runImport,
    progressValue,
    ensureEurostatProjectionPreview,
  } = model;
  const { t } = useTranslation();

  if (!details) return null;

  return (
    <div className="space-y-5">
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
            {datasetId ? t('plateJs.chart.importLatest') : t('plateJs.chart.importDataset')}
          </Button>
        </div>
        {importProgress ? (
          <div className="space-y-2">
            <Progress value={progressValue} />
            <p className="text-muted-foreground text-xs">
              {importProgress.completedPartitions}/{importProgress.partitionCount || '?'}
              {t('generated.inline.0294_partitions_c5246599')}{' '}
              {importProgress.observationCount.toLocaleString()}
              {t('generated.inline.0295_observations_ffc09dde')} {importProgress.status}
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
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t('plateJs.chart.assignColumns')}</p>
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
              disabled={!canApplyEurostatChartPreset(details.dimensions, 'compareCountriesInYear')}
              onClick={() => applyEurostatPreset('compareCountriesInYear')}
            >
              {t('plateJs.chart.compareCountriesInYear')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !canApplyEurostatChartPreset(details.dimensions, 'showTimeSeriesForCountry')
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
                const nextSeriesDimension = seriesDimension === next ? null : seriesDimension;
                invalidateEurostatEditableTable();
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
              onChange={value => {
                invalidateEurostatEditableTable();
                setValueField(value || EUROSTAT_DEFAULT_VALUE_FIELD);
              }}
            />
            <MappingSelect
              label={t('plateJs.chart.seriesDimension')}
              value={seriesDimension}
              columns={details.dimensions
                .map(dimension => dimension.id)
                .filter(id => id !== xDimension)}
              optional
              onChange={value => {
                invalidateEurostatEditableTable();
                setSeriesDimension(value);
                setFilters(current =>
                  createDefaultEurostatFilters(details.dimensions, xDimension, value, current)
                );
              }}
            />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">{t('plateJs.chart.filters')}</p>
              <p className="text-muted-foreground mt-1 text-xs">{t('plateJs.chart.filtersHint')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {details.dimensions
                .filter(
                  dimension => dimension.id !== xDimension && dimension.id !== seriesDimension
                )
                .map(dimension => (
                  <SelectField
                    key={dimension.id}
                    label={dimension.label ? `${dimension.id} · ${dimension.label}` : dimension.id}
                    value={filters[dimension.id] || undefined}
                    onValueChange={value => {
                      invalidateEurostatEditableTable();
                      setFilters(current => ({
                        ...current,
                        [dimension.id]: value,
                      }));
                    }}
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
              {eurostatTableReady
                ? t('plateJs.chart.editableTableReady')
                : t('plateJs.chart.editableTableNeeded')}
            </p>
            <Button
              type="button"
              variant={eurostatTableReady ? 'outline' : 'default'}
              disabled={!canCreateEurostatPreview}
              onClick={() => void ensureEurostatProjectionPreview()}
            >
              {projecting ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {eurostatTableReady
                ? t('plateJs.chart.rebuildEditableTable')
                : t('plateJs.chart.buildEditableTable')}
            </Button>
          </div>
        </div>
      ) : null}

      {datasetId && isEurostatDatasetReady && eurostatTableReady ? (
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t('plateJs.chart.dataTable')}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t('plateJs.chart.editableTableSummary', {
                  rows: table.rows.length,
                  columns: table.columns.length,
                })}
              </p>
            </div>
            <StateBadge status="complete" tone="success">
              {t('plateJs.chart.editableTableReady')}
            </StateBadge>
          </div>
          <ManualChartTableEditor table={table} onChange={setTable} />
          <TableAxisSetup table={table} mapping={mapping} setMapping={setMapping} />
        </div>
      ) : null}
    </div>
  );
}

function OfficialDataSourcePanel({ model }: ChartDialogViewProps) {
  const {
    officialSearch,
    setOfficialSearch,
    handleOfficialSearchChange,
    officialSearchResults,
    searching,
    govDataSearching,
    loadingDetails,
    details,
    govDataSelectedEntry,
    chooseOfficialDataResult,
  } = model;
  const { t } = useTranslation();
  const isSearching = searching || govDataSearching;
  const hasSelection = Boolean(details || govDataSelectedEntry || loadingDetails);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.48fr)]">
        <div className="relative">
          <TextField
            id="official-data-search"
            label={t('plateJs.chart.officialSearch')}
            value={officialSearch}
            onValueChange={handleOfficialSearchChange}
            placeholder={t('plateJs.chart.officialSearchPlaceholder')}
            autoComplete="off"
            className="pr-9"
          />
          {isSearching ? (
            <Loader2Icon className="text-muted-foreground absolute right-3 bottom-3 size-4 animate-spin" />
          ) : null}
        </div>
        <OfficialProviderPicker model={model} />
      </div>

      {officialSearch.trim().length < 2 && !hasSelection ? (
        <div className="space-y-3 border border-dashed p-4">
          <p className="text-muted-foreground text-sm">{t('plateJs.chart.officialSearchHint')}</p>
          <OfficialSearchSuggestions onSearch={setOfficialSearch} />
        </div>
      ) : null}

      {officialSearchResults.length > 0 && !hasSelection ? (
        <div className="max-h-80 overflow-y-auto border">
          {officialSearchResults.map(result => (
            <OfficialResultCard
              key={result.id}
              result={result}
              onSelect={chooseOfficialDataResult}
            />
          ))}
        </div>
      ) : null}

      {officialSearch.trim().length >= 2 &&
      officialSearchResults.length === 0 &&
      !isSearching &&
      !hasSelection ? (
        <div className="text-muted-foreground flex min-h-40 items-center justify-center border border-dashed px-6 text-center text-sm">
          {t('plateJs.chart.noOfficialResults')}
        </div>
      ) : null}

      {loadingDetails ? (
        <SectionSkeleton rows={2} density="compact" label={t('plateJs.chart.loadingMetadata')} />
      ) : null}

      {govDataSelectedEntry ? <GovDataDatasetDetails model={model} /> : null}
      {details ? <EurostatDatasetDetails model={model} /> : null}
    </div>
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
    govDataImported,
    datasetId,
    isEurostatDatasetReady,
    eurostatTableReady,
    projecting,
    fileInputRef,
    previewPoints,
    primaryButtonLabel,
    primaryButtonDisabled,
    runPrimaryAction,
  } = model;
  const { t } = useTranslation();
  const activeSourceTab = sourceKind === 'manual' ? 'manual' : 'official';
  const showChartSettings =
    sourceKind === 'manual' ||
    (sourceKind === 'govdata' && govDataImported) ||
    (sourceKind === 'eurostat' &&
      Boolean(datasetId && isEurostatDatasetReady && eurostatTableReady));

  const handleSourceTabChange = (value: string) => {
    if (value === 'manual') {
      setSourceKind('manual');
      return;
    }

    setSourceKind(sourceKind === 'manual' ? 'eurostat' : sourceKind);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ScrollableDialogContent className="bg-background flex h-dvh !max-h-none max-h-none w-screen max-w-none flex-col overflow-hidden rounded-none border-0 p-0 shadow-none sm:max-w-none">
        <DialogHeader separator className="px-5 py-4 pr-12">
          <DialogTitle>
            {editingElement ? t('plateJs.chart.editTitle') : t('plateJs.chart.insertTitle')}
          </DialogTitle>
          <DialogDescription>{t('plateJs.chart.description')}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="min-w-0 space-y-5">
              <Tabs value={activeSourceTab} onValueChange={handleSourceTabChange}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" onClick={() => handleSourceTabChange('manual')}>
                    {t('plateJs.chart.csvSource')}
                  </TabsTrigger>
                  <TabsTrigger value="official" onClick={() => handleSourceTabChange('official')}>
                    {t('plateJs.chart.officialDataSource')}
                  </TabsTrigger>
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
                                parseError instanceof Error
                                  ? parseError.message
                                  : String(parseError)
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
                  <TableAxisSetup table={table} mapping={mapping} setMapping={setMapping} />
                </>
              ) : (
                <OfficialDataSourcePanel model={model} />
              )}
            </div>

            <div className="min-w-0 space-y-5 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
              {showChartSettings ? (
                <>
                  <FormFieldShell label={t('plateJs.chart.chartType')}>
                    {() => <ChartTypePicker value={chartType} onChange={setChartType} />}
                  </FormFieldShell>
                  <TextField
                    id="chart-title"
                    label={t('plateJs.chart.title')}
                    value={presentation.title ?? ''}
                    onValueChange={value =>
                      setPresentation(current => ({ ...current, title: value }))
                    }
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
                          setPresentation(current => ({
                            ...current,
                            showLegend: checked === true,
                          }))
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
                          setPresentation(current => ({
                            ...current,
                            showTooltip: checked === true,
                          }))
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
                            setPresentation(current => ({
                              ...current,
                              showGrid: checked === true,
                            }))
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
                        {t('plateJs.chart.editableTableReady')}
                      </p>
                    ) : sourceKind === 'govdata' && govDataImported ? (
                      <p className="text-muted-foreground mt-2 text-xs">
                        {t('plateJs.chart.govDataPreviewReady')}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground flex min-h-64 items-center justify-center border border-dashed px-6 text-center text-sm">
                  {t('plateJs.chart.officialSettingsHint')}
                </div>
              )}
            </div>
          </div>

          {error ? (
            <p className="border-destructive/30 bg-destructive/5 text-destructive mx-5 mb-5 border px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter separator surface="background" className="px-5 py-4">
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
