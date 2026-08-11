'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  LineChart,
  Search,
  Sigma,
  Table2,
  Upload,
} from 'lucide-react';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { BadgeControl } from '@/features/shared/ui/status';
import { cn } from '@/features/shared/utils/utils';

type DemoProvider = 'eurostat' | 'destatis' | 'govdata' | 'upload';
type DemoView = 'chart' | 'table' | 'stat';
type DemoAggregation = 'sum' | 'mean' | 'max';
type DemoChartType = 'bar' | 'line';

interface DemoDataset {
  id: string;
  provider: DemoProvider;
  title: string;
  publisher: string;
  coverage: string;
  structure: string;
  license: string;
  snapshot: string;
  description: string;
}

const providerOrder: DemoProvider[] = ['eurostat', 'destatis', 'govdata', 'upload'];
const chartValues = [48, 57, 63, 74, 82];

function aggregate(values: number[], aggregation: DemoAggregation) {
  if (aggregation === 'max') return Math.max(...values);
  const sum = values.reduce((total, value) => total + value, 0);
  return aggregation === 'mean' ? sum / values.length : sum;
}

export function LandingOfficialDataPreview() {
  const { t, tArray } = useTranslation();
  const resultTitles = tArray('pages.home.publicLanding.officialDataPreview.resultTitles');
  const resultPublishers = tArray('pages.home.publicLanding.officialDataPreview.resultPublishers');
  const resultCoverage = tArray('pages.home.publicLanding.officialDataPreview.resultCoverage');
  const resultStructure = tArray('pages.home.publicLanding.officialDataPreview.resultStructure');
  const resultLicenses = tArray('pages.home.publicLanding.officialDataPreview.resultLicenses');
  const resultSnapshots = tArray('pages.home.publicLanding.officialDataPreview.resultSnapshots');
  const resultDescriptions = tArray(
    'pages.home.publicLanding.officialDataPreview.resultDescriptions'
  );
  const chartLabels = tArray('pages.home.publicLanding.officialDataPreview.chartLabels');
  const areaLabels = tArray('pages.home.publicLanding.officialDataPreview.areaLabels');

  const datasets = useMemo<DemoDataset[]>(
    () =>
      providerOrder.map((provider, index) => ({
        id: `landing-dataset-${provider}`,
        provider,
        title: resultTitles[index] ?? provider,
        publisher: resultPublishers[index] ?? '',
        coverage: resultCoverage[index] ?? '',
        structure: resultStructure[index] ?? '',
        license: resultLicenses[index] ?? '',
        snapshot: resultSnapshots[index] ?? '',
        description: resultDescriptions[index] ?? '',
      })),
    [
      resultCoverage,
      resultDescriptions,
      resultLicenses,
      resultPublishers,
      resultSnapshots,
      resultStructure,
      resultTitles,
    ]
  );

  const [stage, setStage] = useState<'find' | 'build'>('find');
  const [query, setQuery] = useState('');
  const [enabledProviders, setEnabledProviders] = useState<DemoProvider[]>(providerOrder);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<DemoView>('chart');
  const [aggregation, setAggregation] = useState<DemoAggregation>('mean');
  const [chartType, setChartType] = useState<DemoChartType>('bar');
  const [measure, setMeasure] = useState('value');
  const [dimension, setDimension] = useState('year');

  const selected = datasets.find(dataset => dataset.id === selectedId) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredDatasets = datasets.filter(
    dataset =>
      enabledProviders.includes(dataset.provider) &&
      (!normalizedQuery ||
        `${dataset.title} ${dataset.publisher} ${dataset.description}`
          .toLocaleLowerCase()
          .includes(normalizedQuery))
  );
  const previewValues = measure === 'share' ? [32, 38, 44, 51, 60] : chartValues;
  const previewLabels = dimension === 'area' ? areaLabels : chartLabels;
  const previewRows: [string, string, string][] = previewLabels.map((label, index) => [
    label,
    selected?.publisher ?? '',
    String(previewValues[index] ?? ''),
  ]);
  const previewColumns: [string, string, string] = [
    t(`pages.home.publicLanding.officialDataPreview.options.${dimension}`),
    t('pages.home.publicLanding.officialDataPreview.sourceColumn'),
    t(`pages.home.publicLanding.officialDataPreview.options.${measure}`),
  ];

  const toggleProvider = (provider: DemoProvider) => {
    setEnabledProviders(current =>
      current.includes(provider)
        ? current.filter(item => item !== provider)
        : [...current, provider]
    );
    setSelectedId(null);
  };

  const useOwnData = () => {
    setEnabledProviders(current => (current.includes('upload') ? current : [...current, 'upload']));
    setSelectedId('landing-dataset-upload');
  };

  return (
    <div className="landing-official-data-preview bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {t('pages.home.publicLanding.officialDataPreview.title')}
          </p>
          <p className="text-muted-foreground text-sm">
            {stage === 'find'
              ? t('pages.home.publicLanding.officialDataPreview.findSubtitle')
              : t('pages.home.publicLanding.officialDataPreview.buildSubtitle')}
          </p>
        </div>
        <BadgeControl variant="secondary">
          {stage === 'find' ? (
            <Search className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t(`pages.home.publicLanding.officialDataPreview.stages.${stage}`)}
        </BadgeControl>
      </div>

      {stage === 'find' ? (
        <div className="min-h-[34rem]">
          <div className="space-y-3 border-b p-4">
            <label className="relative block">
              <span className="sr-only">
                {t('pages.home.publicLanding.officialDataPreview.searchLabel')}
              </span>
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                data-action-id="public-landing.official-data.search.change"
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setSelectedId(null);
                }}
                placeholder={t('pages.home.publicLanding.officialDataPreview.searchPlaceholder')}
                className="border-input bg-background focus-visible:ring-ring h-11 w-full rounded-md border pr-3 pl-10 text-sm outline-none focus-visible:ring-2"
              />
            </label>
            <div
              className="flex flex-wrap gap-2"
              aria-label={t('pages.home.publicLanding.officialDataPreview.sources')}
            >
              {providerOrder.map(provider => (
                <Button
                  key={provider}
                  type="button"
                  data-action-id="public-landing.official-data.provider.toggle"
                  size="sm"
                  variant={enabledProviders.includes(provider) ? 'secondary' : 'outline'}
                  aria-pressed={enabledProviders.includes(provider)}
                  onClick={() => toggleProvider(provider)}
                >
                  {provider === 'upload' ? (
                    <Upload className="h-4 w-4" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {t(`pages.home.publicLanding.officialDataPreview.providers.${provider}`)}
                </Button>
              ))}
              <Button
                type="button"
                data-action-id="public-landing.official-data.sample-csv.select"
                size="sm"
                variant="outline"
                onClick={useOwnData}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t('pages.home.publicLanding.officialDataPreview.useSampleCsv')}
              </Button>
            </div>
          </div>

          <div className="grid min-h-[26rem] lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
            <div className="border-b lg:border-r lg:border-b-0">
              {filteredDatasets.length ? (
                filteredDatasets.map(dataset => (
                  <button
                    key={dataset.id}
                    type="button"
                    data-action-id="public-landing.official-data.dataset.select"
                    data-testid="landing-dataset-result"
                    aria-pressed={selectedId === dataset.id}
                    className={cn(
                      'hover:bg-muted/40 focus-visible:ring-ring w-full border-b px-4 py-3 text-left outline-none focus-visible:ring-2',
                      selectedId === dataset.id && 'bg-muted/60'
                    )}
                    onClick={() => setSelectedId(dataset.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgeControl variant="outline" size="tiny">
                        {t(
                          `pages.home.publicLanding.officialDataPreview.providers.${dataset.provider}`
                        )}
                      </BadgeControl>
                      {dataset.provider === 'upload' ? (
                        <BadgeControl variant="secondary" size="tiny">
                          {t('pages.home.publicLanding.officialDataPreview.localBadge')}
                        </BadgeControl>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold">{dataset.title}</p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                      {dataset.description}
                    </p>
                    <p className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span>{dataset.publisher}</span>
                      <span>{dataset.coverage}</span>
                      <span>{dataset.structure}</span>
                    </p>
                  </button>
                ))
              ) : (
                <div className="text-muted-foreground flex min-h-64 items-center justify-center p-8 text-center text-sm">
                  {t('pages.home.publicLanding.officialDataPreview.noResults')}
                </div>
              )}
            </div>

            <div className="bg-muted/15 flex min-h-64 flex-col">
              {selected ? (
                <>
                  <div className="flex-1 space-y-4 p-5" data-testid="landing-dataset-details">
                    <BadgeControl variant="outline" size="tiny">
                      {t(
                        `pages.home.publicLanding.officialDataPreview.providers.${selected.provider}`
                      )}
                    </BadgeControl>
                    <div>
                      <p className="font-semibold">{selected.title}</p>
                      <p className="text-muted-foreground mt-1 text-sm">{selected.publisher}</p>
                    </div>
                    <p className="text-muted-foreground text-sm leading-6">
                      {selected.description}
                    </p>
                    <dl className="grid gap-3 border-y py-4 text-sm sm:grid-cols-2 lg:grid-cols-1">
                      <div>
                        <dt className="text-muted-foreground text-xs">
                          {t('pages.home.publicLanding.officialDataPreview.coverage')}
                        </dt>
                        <dd className="mt-1">{selected.coverage}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs">
                          {t('pages.home.publicLanding.officialDataPreview.structure')}
                        </dt>
                        <dd className="mt-1">{selected.structure}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs">
                          {t('pages.home.publicLanding.officialDataPreview.license')}
                        </dt>
                        <dd className="mt-1">{selected.license}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="border-t p-4">
                    <Button
                      type="button"
                      data-action-id="public-landing.official-data.dataset.use"
                      className="w-full"
                      onClick={() => setStage('build')}
                    >
                      {t('pages.home.publicLanding.officialDataPreview.useDataset')}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm">
                  <Database className="h-8 w-8 opacity-50" />
                  {t('pages.home.publicLanding.officialDataPreview.chooseResult')}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-[34rem]" data-testid="landing-data-builder">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{selected?.title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {selected?.publisher} · {selected?.snapshot}
              </p>
            </div>
            <Button
              type="button"
              data-action-id="public-landing.official-data.dataset.change"
              size="sm"
              variant="outline"
              onClick={() => setStage('find')}
            >
              {t('pages.home.publicLanding.officialDataPreview.changeDataset')}
            </Button>
          </div>

          <div className="grid lg:grid-cols-[minmax(250px,0.68fr)_minmax(0,1.32fr)]">
            <div className="space-y-5 border-b p-4 lg:border-r lg:border-b-0">
              <div className="grid grid-cols-3 rounded-md border p-1">
                {(['chart', 'table', 'stat'] as DemoView[]).map(item => {
                  const Icon = item === 'chart' ? BarChart3 : item === 'table' ? Table2 : Sigma;
                  return (
                    <Button
                      key={item}
                      type="button"
                      data-action-id="public-landing.official-data.view.select"
                      size="sm"
                      variant={view === item ? 'secondary' : 'ghost'}
                      aria-pressed={view === item}
                      onClick={() => setView(item)}
                    >
                      <Icon className="h-4 w-4" />
                      {t(`pages.home.publicLanding.officialDataPreview.views.${item}`)}
                    </Button>
                  );
                })}
              </div>

              <DemoSelect
                data-action-id="public-landing.official-data.measure.select"
                label={t('pages.home.publicLanding.officialDataPreview.measure')}
                value={measure}
                onChange={setMeasure}
                options={[
                  ['value', t('pages.home.publicLanding.officialDataPreview.options.traffic')],
                  ['share', t('pages.home.publicLanding.officialDataPreview.options.share')],
                ]}
              />
              {view !== 'stat' ? (
                <DemoSelect
                  data-action-id="public-landing.official-data.dimension.select"
                  label={t('pages.home.publicLanding.officialDataPreview.dimension')}
                  value={dimension}
                  onChange={setDimension}
                  options={[
                    ['year', t('pages.home.publicLanding.officialDataPreview.options.year')],
                    ['area', t('pages.home.publicLanding.officialDataPreview.options.area')],
                  ]}
                />
              ) : null}
              <DemoSelect
                data-action-id="public-landing.official-data.aggregation.select"
                label={t('pages.home.publicLanding.officialDataPreview.aggregation')}
                value={aggregation}
                onChange={value => setAggregation(value as DemoAggregation)}
                options={(['mean', 'sum', 'max'] as DemoAggregation[]).map(item => [
                  item,
                  t(`pages.home.publicLanding.officialDataPreview.aggregations.${item}`),
                ])}
              />
              {view === 'chart' ? (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    {t('pages.home.publicLanding.officialDataPreview.chartType')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['bar', 'line'] as DemoChartType[]).map(item => (
                      <Button
                        key={item}
                        type="button"
                        data-action-id="public-landing.official-data.chart-type.select"
                        variant={chartType === item ? 'secondary' : 'outline'}
                        aria-pressed={chartType === item}
                        onClick={() => setChartType(item)}
                      >
                        {item === 'bar' ? (
                          <BarChart3 className="h-4 w-4" />
                        ) : (
                          <LineChart className="h-4 w-4" />
                        )}
                        {t(`pages.home.publicLanding.officialDataPreview.chartTypes.${item}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-w-0 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">
                  {t('pages.home.publicLanding.officialDataPreview.preview')}
                </p>
                <BadgeControl variant="secondary" size="tiny">
                  {t('pages.home.publicLanding.officialDataPreview.livePreview')}
                </BadgeControl>
              </div>
              <div
                className="bg-background min-h-72 rounded-md border p-4"
                data-testid={`landing-data-${view}-preview`}
              >
                {view === 'chart' ? (
                  <DemoChart type={chartType} labels={previewLabels} values={previewValues} />
                ) : null}
                {view === 'table' ? (
                  <DemoTable columns={previewColumns} rows={previewRows} />
                ) : null}
                {view === 'stat' ? (
                  <div className="flex min-h-56 items-center justify-center text-center">
                    <div className="w-full max-w-sm border-y py-7">
                      <p className="text-muted-foreground text-sm">
                        {t(`pages.home.publicLanding.officialDataPreview.options.${measure}`)}
                      </p>
                      <p className="mt-3 text-4xl font-semibold tabular-nums">
                        {aggregate(previewValues, aggregation).toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {t(
                          `pages.home.publicLanding.officialDataPreview.aggregations.${aggregation}`
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
              <div
                className="text-muted-foreground mt-3 flex items-start gap-2 text-xs"
                data-testid="landing-data-attribution"
              >
                <CheckCircle2 className="text-success mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>
                  {t('pages.home.publicLanding.officialDataPreview.sourceAttribution', {
                    provider: selected
                      ? t(
                          `pages.home.publicLanding.officialDataPreview.providers.${selected.provider}`
                        )
                      : '',
                    publisher: selected?.publisher ?? '',
                    date: selected?.snapshot ?? '',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoSelect({
  'data-action-id': actionId,
  label,
  value,
  onChange,
  options,
}: {
  'data-action-id': string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <select
        data-action-id={actionId}
        className="border-input bg-background h-10 rounded-md border px-3 text-sm"
        value={value}
        onChange={event => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function DemoTable({
  columns,
  rows,
}: {
  columns: [string, string, string];
  rows: [string, string, string][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            {columns.map(column => (
              <th key={column} className="bg-muted/30 px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-0">
              {columns.map((column, columnIndex) => (
                <td key={`${column}-${columnIndex}`} className="px-3 py-2">
                  {row[columnIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DemoChart({
  type,
  labels,
  values,
}: {
  type: DemoChartType;
  labels: string[];
  values: number[];
}) {
  if (type === 'line') {
    const points = values.map((value, index) => `${8 + index * 23},${92 - value}`).join(' ');
    return (
      <div className="min-h-64">
        <svg
          viewBox="0 0 110 100"
          className="h-56 w-full"
          role="img"
          aria-label={translateText('common.accessibility.lineChart')}
        >
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-brand"
          />
          {values.map((value, index) => (
            <circle
              key={index}
              cx={8 + index * 23}
              cy={92 - value}
              r="2.5"
              className="fill-brand"
            />
          ))}
        </svg>
        <div className="grid grid-cols-5 gap-1">
          {labels.map(label => (
            <span key={label} className="text-muted-foreground truncate text-center text-[10px]">
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-64 items-end gap-3 border-b px-2 pt-5">
      {values.map((value, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="text-muted-foreground text-[10px]">{value}</span>
          <div
            className="bg-brand/70 w-full max-w-12 rounded-t-sm"
            style={{ height: `${value * 2}px` }}
          />
          <span className="text-muted-foreground max-w-full truncate text-[10px]">
            {labels[index] ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}
