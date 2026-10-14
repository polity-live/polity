import { DatasetProcessingError } from './DatasetProcessingError';
import { datasetRawDownloadTarget, canRecoverDatasetFile } from '../logic/datasetRawDownload';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowDownUpIcon,
  FilterIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/auth-provider';
import { usePolityLocalVirtualizer } from '@/features/shared/virtualization';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { InlineCheckbox } from '@/features/shared/ui/form/InlineCheckbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { PolityLoadingScreen } from '@/features/shared/ui/feedback/PolityLoadingScreen';
import { localizeAppError } from '@/features/shared/errors/app-error';
import { loadDatasetPreview } from '../api/datasetClient';
import { sameDatasetSelection } from '../logic/datasetSelection';
import { orderDatasetPreviewColumns } from '../logic/datasetPreviewColumns';
import { parseDatasetNumber } from '../logic/datasetNumbers';
import type {
  DatasetColumnProfile,
  DatasetImportFilters,
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetRowCondition,
  DatasetTableSelection,
  EurostatDimension,
} from '../types';

const PAGE_SIZE = 200;
const ROW_HEIGHT = 32;

function ColumnFilter({
  column,
  condition,
  values,
  labelValue,
  incomplete,
  onChange,
  onSort,
  onHide,
}: {
  column: DatasetColumnProfile;
  condition?: DatasetRowCondition;
  values: string[];
  labelValue: (value: string) => string;
  incomplete: boolean;
  onChange: (condition?: DatasetRowCondition) => void;
  onSort: () => void;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState<DatasetRowCondition['operator']>('in');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [text, setText] = useState('');
  const rangeValid =
    Boolean(min || max) &&
    (column.type !== 'number' ||
      [min, max].every(value => !value || Number.isFinite(parseDatasetNumber(value)))) &&
    (!min ||
      !max ||
      (column.type === 'number' ? parseDatasetNumber(min) <= parseDatasetNumber(max) : min <= max));
  return (
    <div className="flex items-center gap-1">
      <span className="min-w-0 flex-1 truncate" title={column.label}>
        {column.label}
      </span>
      <Button
        data-action-id="charts.dataset-explorer.column.sort"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label={t('plateJs.dataView.explorerSort', { column: column.label })}
        onClick={onSort}
      >
        <ArrowDownUpIcon className="size-3.5" />
      </Button>
      <Popover
        open={open}
        onOpenChange={next => {
          if (next) {
            setOperator(condition?.operator ?? 'in');
            setSelected(condition?.operator === 'in' ? condition.values : []);
            setText(condition?.operator === 'contains' ? condition.value : '');
            setMin(condition?.operator === 'range' ? (condition.min ?? '') : '');
            setMax(
              condition?.operator === 'range' ? (condition.max ?? '').replace(/\uffff$/, '') : ''
            );
            setSearch('');
          }
          setOpen(next);
        }}
      >
        <PopoverTrigger data-action-scope="presentation" asChild>
          <Button
            data-action-id="charts.dataset-explorer.column.filter"
            variant={condition ? 'secondary' : 'ghost'}
            size="icon"
            className="size-7 shrink-0"
            aria-label={t('plateJs.dataView.explorerFilter', { column: column.label })}
            aria-pressed={Boolean(condition)}
          >
            <FilterIcon className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="flex max-h-[min(80dvh,var(--radix-popover-content-available-height))] w-[min(320px,calc(100vw-2rem))] flex-col gap-3 overflow-hidden"
          align="start"
        >
          <p className="shrink-0 text-sm font-medium">
            {t('plateJs.dataView.explorerFilter', { column: column.label })}
          </p>
          <select
            data-action-id="charts.dataset-explorer.filter.operator"
            className="bg-background w-full shrink-0 rounded border p-2 text-sm"
            aria-label={t('plateJs.dataView.explorerOperator')}
            value={operator}
            onChange={event => setOperator(event.target.value as DatasetRowCondition['operator'])}
          >
            <option value="in">{t('plateJs.dataView.explorerValues')}</option>
            <option value="contains">{t('plateJs.dataView.explorerContains')}</option>
            <option value="range">{t('plateJs.dataView.explorerRange')}</option>
            <option value="empty">{t('plateJs.dataView.explorerMissing')}</option>
          </select>
          {operator === 'in' ? (
            <>
              <Input
                data-action-id="charts.dataset-explorer.filter.find-value"
                placeholder={t('plateJs.dataView.explorerFindValue')}
                aria-label={t('plateJs.dataView.explorerFindValue')}
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
                {[...new Set([...selected, ...values])]
                  .filter(value =>
                    labelValue(value).toLocaleLowerCase().includes(search.toLocaleLowerCase())
                  )
                  .slice(0, 100)
                  .map(value => (
                    <label key={value} className="flex items-center gap-2 py-1 text-sm">
                      <InlineCheckbox
                        data-action-id="charts.dataset-explorer.filter.value"
                        checked={selected.includes(value)}
                        onCheckedChange={checked =>
                          setSelected(current =>
                            checked === true
                              ? [...current, value]
                              : current.filter(item => item !== value)
                          )
                        }
                      />
                      <span className="break-words">{labelValue(value)}</span>
                    </label>
                  ))}
              </div>
              {incomplete && (
                <p className="text-muted-foreground text-xs">
                  {t('plateJs.dataView.explorerPartialValues')}
                </p>
              )}
            </>
          ) : operator === 'contains' ? (
            <Input
              data-action-id="charts.dataset-explorer.filter.contains"
              aria-label={t('plateJs.dataView.explorerContains')}
              value={text}
              onChange={event => setText(event.target.value)}
            />
          ) : operator === 'range' ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label={t('plateJs.dataView.explorerFrom')}
                data-action-id="charts.dataset-explorer.filter.min"
                placeholder={t('plateJs.dataView.explorerFrom')}
                value={min}
                onChange={event => setMin(event.target.value)}
              />
              <Input
                aria-label={t('plateJs.dataView.explorerTo')}
                data-action-id="charts.dataset-explorer.filter.max"
                placeholder={t('plateJs.dataView.explorerTo')}
                value={max}
                onChange={event => setMax(event.target.value)}
              />
              {!rangeValid && (min || max) && (
                <p role="alert" className="text-destructive col-span-2 text-xs">
                  {t('plateJs.dataView.explorerInvalidRange')}
                </p>
              )}
            </div>
          ) : null}
          <div className="bg-popover flex shrink-0 justify-between gap-2 border-t pt-3">
            <Button
              data-action-id="charts.dataset-explorer.filter.clear"
              variant="outline"
              size="sm"
              onClick={() => {
                onChange();
                setOpen(false);
              }}
            >
              {t('plateJs.dataView.explorerRemoveFilter')}
            </Button>
            <Button
              data-action-id="charts.dataset-explorer.filter.apply"
              data-action-kind="interaction"
              size="sm"
              disabled={
                operator === 'in'
                  ? !selected.length
                  : operator === 'contains'
                    ? !text.trim()
                    : operator === 'range'
                      ? !rangeValid
                      : false
              }
              onClick={() => {
                onChange(
                  operator === 'in'
                    ? { column: column.name, operator, values: selected }
                    : operator === 'contains'
                      ? { column: column.name, operator, value: text }
                      : operator === 'range'
                        ? {
                            column: column.name,
                            operator,
                            min: min || undefined,
                            max:
                              max &&
                              column.role === 'time' &&
                              column.type !== 'number' &&
                              /^\d{4}$/.test(max)
                                ? `${max}\uffff`
                                : max || undefined,
                            numeric: column.type === 'number',
                          }
                        : { column: column.name, operator }
                );
                setOpen(false);
              }}
            >
              {t('plateJs.dataView.explorerApplyFilter')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        data-action-id="charts.dataset-explorer.column.hide"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label={t('plateJs.dataView.explorerHideColumn', { column: column.label })}
        title={t('plateJs.dataView.explorerHideColumn', { column: column.label })}
        onClick={onHide}
      >
        <Trash2Icon className="size-3.5" />
      </Button>
    </div>
  );
}

/** Read-only, paged table. The DOM contains only the visible rows and a small overscan. */
export function DatasetExplorer({
  request,
  title,
  sourceUrl,
  initialColumns,
  onBack,
  onApply,
}: {
  request: DatasetPreviewRequest;
  title: string;
  sourceUrl?: string | null;
  initialColumns?: string[];
  onBack: () => void;
  onApply: (selection: DatasetTableSelection) => void;
}) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [scope, setScope] = useState<DatasetImportFilters>(request.filters ?? {});
  const [rowFilters, setRowFilters] = useState(request.rowFilters ?? {});
  const [conditions, setConditions] = useState<DatasetRowCondition[]>(request.rowConditions ?? []);
  const [timeRange, setTimeRange] = useState(request.timeRange);
  const [sort, setSort] = useState(request.sort);
  const [columns, setColumns] = useState<string[]>(initialColumns ?? []);
  const [technical, setTechnical] = useState(false);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [quick, setQuick] = useState({
    area: Boolean(request.filters?.area),
    period: Boolean(request.filters?.period),
  });
  const [scopeApplying, setScopeApplying] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const quickController = useRef<AbortController | null>(null);
  const [pages, setPages] = useState<Map<number, Record<string, string>[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadAvailable, setDownloadAvailable] = useState(false);
  const [scopeDownloadAvailable, setScopeDownloadAvailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const [area, setArea] = useState(request.filters?.area ?? '');
  const [from, setFrom] = useState(
    String(request.filters?.period?.start ?? request.timeRange?.startYear ?? '')
  );
  const [to, setTo] = useState(
    String(request.filters?.period?.end ?? request.timeRange?.endYear ?? '')
  );
  const [scopeDirty, setScopeDirty] = useState(false);
  const columnsInitialized = useRef(initialColumns !== undefined);
  const metadataInitialized = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const controllers = useRef(new Map<number, AbortController>());
  const version = useRef(0);
  const dimensions = (preview?.metadata?.providerDimensions ?? []) as EurostatDimension[];
  const effectiveRequest = {
    ...request,
    filters: scope,
    rowFilters,
    rowConditions: conditions,
    timeRange,
    sort,
  };
  const key = JSON.stringify(effectiveRequest);
  const latestRequest = useRef(effectiveRequest);
  latestRequest.current = effectiveRequest;
  const latestLabel = useRef(t);
  latestLabel.current = t;
  const total = preview?.page?.total ?? preview?.rows.length ?? 0;
  const visibleProfiles = orderDatasetPreviewColumns(preview?.columns ?? []).filter(
    column => (technical || !column.technical) && columns.includes(column.name)
  );
  const virtualizer = usePolityLocalVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: loading ? 0 : total,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    paddingStart: 76,
  });
  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    const current = ++version.current;
    controllers.current.clear();
    setPages(new Map());
    setLoading(true);
    setError(null);
    setDownloadAvailable(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    const controller = new AbortController();
    controllers.current.set(0, controller);
    const timeout = window.setTimeout(() => {
      const selected = latestRequest.current;
      void loadDatasetPreview(
        { ...selected, page: { offset: 0, limit: PAGE_SIZE } },
        session?.access_token,
        controller.signal
      )
        .then(result => {
          if (current !== version.current || controller.signal.aborted) return;
          if (!sameDatasetSelection(selected, result.identity))
            throw new Error(latestLabel.current('plateJs.dataView.selectionMismatch'));
          setPreview(result);
          if (!columnsInitialized.current) {
            setColumns(
              orderDatasetPreviewColumns(result.columns)
                .filter(column => !column.technical)
                .map(column => column.name)
            );
            columnsInitialized.current = true;
          }
          if (!metadataInitialized.current) {
            if (
              initialColumns?.some(name =>
                result.columns.some(column => column.name === name && column.technical)
              )
            )
              setTechnical(true);
            metadataInitialized.current = true;
          }
          setPages(new Map([[0, result.rows]]));
        })
        .catch(failure => {
          if (current === version.current && !controller.signal.aborted) {
            setError(localizeAppError(failure));
            setDownloadAvailable(canRecoverDatasetFile(failure));
          }
        })
        .finally(() => {
          if (current === version.current && !controller.signal.aborted) {
            setLoading(false);
            controllers.current.delete(0);
          }
        });
    }, 200);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      quickController.current?.abort();
      for (const item of controllers.current.values()) item.abort();
      controllers.current.clear();
    };
  }, [key, revision, session?.access_token]);

  const neededOffsets = [
    ...new Set(items.map(item => Math.floor(item.index / PAGE_SIZE) * PAGE_SIZE)),
  ].filter(offset => !pages.has(offset));
  useEffect(() => {
    if (loading || error) return;
    for (const offset of neededOffsets) {
      if (controllers.current.has(offset)) continue;
      const controller = new AbortController();
      controllers.current.set(offset, controller);
      const current = version.current;
      const selected = latestRequest.current;
      void loadDatasetPreview(
        { ...selected, page: { offset, limit: PAGE_SIZE } },
        session?.access_token,
        controller.signal
      )
        .then(result => {
          if (current !== version.current || controller.signal.aborted) return;
          if (!sameDatasetSelection(selected, result.identity) || result.page?.offset !== offset)
            throw new Error(latestLabel.current('plateJs.dataView.selectionMismatch'));
          setPages(existing => {
            const next = new Map(existing);
            next.set(offset, result.rows);
            if (next.size > 20)
              for (const cachedOffset of next.keys())
                if (!neededOffsets.includes(cachedOffset) && cachedOffset !== 0) {
                  next.delete(cachedOffset);
                  break;
                }
            return next;
          });
        })
        .catch(failure => {
          if (current === version.current && !controller.signal.aborted) {
            setError(localizeAppError(failure));
            setDownloadAvailable(canRecoverDatasetFile(failure));
          }
        })
        .finally(() => {
          if (current === version.current) controllers.current.delete(offset);
        });
    }
  }, [neededOffsets.join(','), loading, error, session?.access_token]);

  const labelValue = (column: string, raw: string) =>
    raw === ''
      ? t('plateJs.dataView.missingValue')
      : (dimensions
          .find(dimension => dimension.id === column)
          ?.values.find(value => value.id === raw)?.label ?? raw);
  const changeCondition = (column: DatasetColumnProfile, condition?: DatasetRowCondition) => {
    quickController.current?.abort();
    setScopeApplying(false);
    setScopeError(null);
    setScopeDownloadAvailable(false);
    if (column.role === 'geo' || column.role === 'time') {
      const kind = column.role === 'geo' ? 'area' : 'period';
      setQuick(current => ({ ...current, [kind]: false }));
      setScope(current => ({
        ...current,
        [kind]: null,
        dimensions: Object.fromEntries(
          Object.entries(current.dimensions ?? {}).filter(([id]) => id !== column.name)
        ),
      }));
      if (kind === 'area') setArea('');
      else {
        setFrom('');
        setTo('');
        setTimeRange(null);
      }
    }
    setConditions(current => [
      ...current.filter(item => item.column !== column.name),
      ...(condition ? [condition] : []),
    ]);
    setRowFilters(current =>
      Object.fromEntries(Object.entries(current).filter(([name]) => name !== column.name))
    );
    // A single provider dimension is also sent upstream, so choosing a value outside the sample can load it.
    if (
      dimensions.some(dimension => dimension.id === column.name) &&
      !request.snapshotId &&
      column.role !== 'time' &&
      !(request.provider === 'GENESIS_DESTATIS' && column.name === 'value_unit')
    )
      setScope(current => {
        const next = {
          ...current,
          dimensions: Object.fromEntries(
            Object.entries(current.dimensions ?? {}).filter(([name]) => name !== column.name)
          ),
        };
        if (
          condition?.operator === 'in' &&
          condition.values.length === 1 &&
          condition.values[0] !== ''
        )
          next.dimensions[column.name] = condition.values[0];
        if (column.role === 'geo') next.area = null;
        return next;
      });
  };
  const periodValid =
    [from, to].every(
      value => !value || (/^\d{4}$/.test(value) && Number(value) >= 1800 && Number(value) <= 2199)
    ) &&
    (!from || !to || Number(from) <= Number(to));
  const clearQuick = (all = false) => {
    quickController.current?.abort();
    setScopeApplying(false);
    setScopeError(null);
    setScopeDownloadAvailable(false);
    const affected =
      preview?.columns
        .filter(
          column =>
            all || (column.role === 'geo' && quick.area) || (column.role === 'time' && quick.period)
        )
        .map(column => column.name) ?? [];
    setScope(current => ({
      ...current,
      area: null,
      period: null,
      dimensions: all
        ? {}
        : Object.fromEntries(
            Object.entries(current.dimensions ?? {}).filter(([id]) => !affected.includes(id))
          ),
    }));
    setRowFilters(current =>
      all
        ? {}
        : Object.fromEntries(Object.entries(current).filter(([id]) => !affected.includes(id)))
    );
    setConditions(current => (all ? [] : current.filter(item => !affected.includes(item.column))));
    if (all || quick.period) setTimeRange(null);
    setQuick({ area: false, period: false });
    setArea('');
    setFrom('');
    setTo('');
    setScopeDirty(false);
  };
  const applyQuick = async () => {
    if (!periodValid || !preview) return;
    quickController.current?.abort();
    const controller = new AbortController();
    quickController.current = controller;
    const spatial = preview.columns
      .filter(column => ['geo', 'time'].includes(column.role))
      .map(column => column.name);
    const nextScope = {
      ...scope,
      area: area.trim() || null,
      period: from || to ? { start: Number(from || 1800), end: Number(to || 2199) } : null,
      dimensions: Object.fromEntries(
        Object.entries(scope.dimensions ?? {}).filter(([id]) => !spatial.includes(id))
      ),
    };
    const nextRows = Object.fromEntries(
      Object.entries(rowFilters).filter(([id]) => !spatial.includes(id))
    );
    const nextConditions = conditions.filter(item => !spatial.includes(item.column));
    setScopeApplying(true);
    setScopeError(null);
    setScopeDownloadAvailable(false);
    try {
      const result = await loadDatasetPreview(
        {
          ...latestRequest.current,
          filters: nextScope,
          rowFilters: nextRows,
          rowConditions: nextConditions,
          timeRange: null,
          page: { offset: 0, limit: PAGE_SIZE },
        },
        session?.access_token,
        controller.signal
      );
      if (controller.signal.aborted) return;
      if (!sameDatasetSelection(request, result.identity))
        throw new Error(t('plateJs.dataView.selectionMismatch'));
      setScope(nextScope);
      setRowFilters(nextRows);
      setConditions(nextConditions);
      setTimeRange(null);
      setQuick({ area: Boolean(nextScope.area), period: Boolean(nextScope.period) });
      setScopeDirty(false);
    } catch (failure) {
      if (!controller.signal.aborted) {
        setScopeError(localizeAppError(failure));
        setScopeDownloadAvailable(canRecoverDatasetFile(failure));
      }
    } finally {
      if (quickController.current === controller) {
        quickController.current = null;
        setScopeApplying(false);
      }
    }
  };
  const restrictions = preview
    ? [
        preview.appliedFilters.area,
        preview.appliedFilters.period
          ? `${preview.appliedFilters.period.start === 1800 ? '…' : preview.appliedFilters.period.start}–${preview.appliedFilters.period.end === 2199 ? '…' : preview.appliedFilters.period.end}`
          : null,
        ...Object.entries(preview.appliedFilters.dimensions ?? {}).map(
          ([id, value]) =>
            `${dimensions.find(item => item.id === id)?.label ?? id}: ${labelValue(id, value)}`
        ),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="dataset-explorer">
      <div className="shrink-0 space-y-1.5 border-b px-3 py-2 sm:px-4">
        <p className="truncate text-xs font-medium" title={title}>
          {title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex min-w-40 flex-1 items-center gap-1.5 text-xs">
            {t('plateJs.dataView.searchArea')}
            <Input
              className="h-8 min-w-0 flex-1 text-xs"
              value={area}
              data-action-id="charts.dataset-explorer.scope.area"
              onChange={event => {
                setArea(event.target.value);
                setScopeDirty(true);
              }}
              placeholder={t('plateJs.dataView.allValues')}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            {t('plateJs.dataView.explorerFromYear')}
            <Input
              className="h-8 w-20 text-xs"
              inputMode="numeric"
              value={from}
              data-action-id="charts.dataset-explorer.scope.start"
              onChange={event => {
                setFrom(event.target.value);
                setScopeDirty(true);
              }}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            {t('plateJs.dataView.explorerToYear')}
            <Input
              className="h-8 w-20 text-xs"
              inputMode="numeric"
              value={to}
              data-action-id="charts.dataset-explorer.scope.end"
              onChange={event => {
                setTo(event.target.value);
                setScopeDirty(true);
              }}
            />
          </label>
          <Button
            data-action-id="charts.dataset-explorer.scope.apply"
            size="sm"
            className="text-xs"
            data-action-kind="interaction"
            variant="outline"
            disabled={!periodValid || scopeApplying || loading}
            onClick={() => void applyQuick()}
          >
            {t('plateJs.dataView.explorerApplyScope')}
          </Button>
          <Button
            data-action-id="charts.dataset-explorer.scope.clear"
            size="sm"
            className="text-xs"
            data-action-kind="interaction"
            variant="outline"
            disabled={!quick.area && !quick.period && !scopeDirty}
            onClick={() => clearQuick()}
          >
            {t('plateJs.dataView.explorerRemoveQuick')}
          </Button>
          <Popover>
            <PopoverTrigger data-action-scope="presentation" asChild>
              <Button
                data-action-id="charts.dataset-explorer.columns.open"
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <SlidersHorizontalIcon className="size-4" />
                {t('plateJs.dataView.visibleColumns')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="max-h-[60dvh] w-72 space-y-2 overflow-auto">
              <label className="flex items-center gap-2 border-b pb-2 text-sm">
                <InlineCheckbox
                  data-action-id="charts.dataset-explorer.columns.technical"
                  checked={technical}
                  onCheckedChange={value => {
                    const checked = value === true;
                    setTechnical(checked);
                    const names =
                      preview?.columns
                        .filter(column => column.technical)
                        .map(column => column.name) ?? [];
                    setColumns(current =>
                      checked
                        ? [...new Set([...current, ...names])]
                        : current.filter(name => !names.includes(name))
                    );
                  }}
                />
                {t('plateJs.dataView.technicalColumns')}
              </label>
              {(preview?.columns ?? [])
                .filter(column => technical || !column.technical)
                .map(column => (
                  <label className="flex items-center gap-2 text-sm" key={column.name}>
                    <InlineCheckbox
                      data-action-id="charts.dataset-explorer.columns.toggle"
                      checked={columns.includes(column.name)}
                      onCheckedChange={checked =>
                        setColumns(current =>
                          checked === true
                            ? [...current, column.name]
                            : current.filter(name => name !== column.name)
                        )
                      }
                    />
                    {column.label}
                  </label>
                ))}
            </PopoverContent>
          </Popover>
        </div>
        {!periodValid && (
          <p role="alert" className="text-destructive text-xs">
            {t('plateJs.dataView.explorerInvalidRange')}
          </p>
        )}
        {scopeDirty && periodValid && (
          <p role="status" className="text-muted-foreground text-xs">
            {t('plateJs.dataView.explorerApplyScopeHint')}
          </p>
        )}
        {scopeError && (
          <DatasetProcessingError
            message={scopeError}
            target={scopeDownloadAvailable ? datasetRawDownloadTarget(null, request) : undefined}
            accessToken={session?.access_token}
            sourceUrl={sourceUrl}
          />
        )}
        <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
          <p role="status" aria-live="polite" className="min-w-0 truncate" title={restrictions}>
            {loading || scopeApplying
              ? t('plateJs.dataView.loadingDataSample')
              : preview
                ? t(
                    preview.sampled
                      ? 'plateJs.dataView.explorerSampleCount'
                      : 'plateJs.dataView.explorerRowCount',
                    { count: total }
                  )
                : ''}
            {restrictions ? ` · ${restrictions}` : ''}
          </p>
          {preview?.metadata?.importScope &&
          Object.keys(preview.metadata.importScope as object).length > 0 ? (
            <p
              className="min-w-0 truncate border-l pl-2"
              title={t('plateJs.dataView.scopedSnapshotExplanation')}
            >
              {t('plateJs.dataView.scopedSnapshotExplanation')}
            </p>
          ) : null}
          {preview?.sampled && (
            <p
              className="min-w-0 truncate border-l pl-2"
              title={t('plateJs.dataView.explorerSampleHint')}
            >
              {t('plateJs.dataView.explorerSampleHint')}
            </p>
          )}
        </div>
        {(conditions.length + Object.keys(rowFilters).length > 0 || quick.area || quick.period) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              ...(quick.area && preview?.rowFilters
                ? Object.entries(preview.rowFilters)
                    .filter(([id]) =>
                      preview.columns.some(column => column.name === id && column.role === 'geo')
                    )
                    .map(
                      ([id, value]) =>
                        `${preview.columns.find(column => column.name === id)?.label}: ${labelValue(id, value)}`
                    )
                : []),
              ...(quick.period
                ? [`${t('plateJs.dataView.searchPeriod')}: ${from || '…'}–${to || '…'}`]
                : []),
              ...Object.entries(rowFilters)
                .filter(([, value]) => value)
                .map(
                  ([column, value]) =>
                    `${preview?.columns.find(item => item.name === column)?.label ?? column}: ${labelValue(column, value)}`
                ),
              ...conditions.map(
                condition =>
                  `${preview?.columns.find(item => item.name === condition.column)?.label ?? condition.column}: ${condition.operator === 'in' ? condition.values.map(value => labelValue(condition.column, value)).join(', ') : condition.operator === 'contains' ? condition.value : condition.operator === 'range' ? `${condition.min ?? '…'}–${condition.max ?? '…'}` : t('plateJs.dataView.missingValue')}`
              ),
            ].map((label, index) => (
              <span
                key={index}
                className="bg-muted max-w-full truncate rounded px-2 py-1"
                title={label}
              >
                {label}
              </span>
            ))}
            <Button
              data-action-id="charts.dataset-explorer.filters.clear"
              variant="ghost"
              size="sm"
              onClick={() => clearQuick(true)}
            >
              {t('plateJs.dataView.clearFilters')}
            </Button>
          </div>
        )}
      </div>
      {error ? (
        <DatasetProcessingError
          message={error}
          className="p-5"
          target={downloadAvailable ? datasetRawDownloadTarget(null, request) : undefined}
          accessToken={session?.access_token}
          sourceUrl={sourceUrl}
          onRetry={() => setRevision(current => current + 1)}
          hint={t('plateJs.dataView.sampleNarrowHint')}
        />
      ) : loading && !preview ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <PolityLoadingScreen label={t('plateJs.dataView.loadingDataSample')} />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto"
          role="region"
          aria-label={t('plateJs.dataView.explorerTable')}
          aria-busy={loading || undefined}
          tabIndex={0}
        >
          {!visibleProfiles.length ? (
            <p className="p-5 text-sm">{t('plateJs.dataView.explorerChooseColumns')}</p>
          ) : (
            <table
              className="table-fixed border-collapse text-left text-xs"
              style={{ width: Math.max(visibleProfiles.length * 190, 600) }}
              aria-rowcount={total + 2}
            >
              <thead className="bg-background sticky top-0 z-10 shadow-sm">
                <tr>
                  {visibleProfiles.map(column => {
                    const rowFilter =
                      rowFilters[column.name] ??
                      (quick.area && column.role === 'geo'
                        ? preview?.rowFilters[column.name]
                        : undefined);
                    const condition =
                      conditions.find(item => item.column === column.name) ??
                      (rowFilter
                        ? {
                            column: column.name,
                            operator: 'in' as const,
                            values: [rowFilter],
                          }
                        : quick.period && column.role === 'time' && scope.period
                          ? {
                              column: column.name,
                              operator: 'range' as const,
                              min: from || undefined,
                              max: to
                                ? `${to}${column.type === 'number' ? '' : '\uffff'}`
                                : undefined,
                            }
                          : timeRange?.column === column.name
                            ? {
                                column: column.name,
                                operator: 'range' as const,
                                min: String(timeRange.startYear),
                                max: `${timeRange.endYear}${column.type === 'number' ? '' : '\uffff'}`,
                              }
                            : undefined);
                    return (
                      <th
                        key={column.name}
                        scope="col"
                        className="h-11 border-r border-b px-2"
                        aria-sort={
                          sort?.column === column.name
                            ? sort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        <ColumnFilter
                          column={column}
                          condition={condition}
                          values={[
                            ...(preview?.facets?.[column.name]?.values ?? []),
                            ...(dimensions
                              .find(item => item.id === column.name)
                              ?.values.map(value => value.id) ?? []),
                          ]}
                          incomplete={!preview?.facets?.[column.name]?.complete}
                          labelValue={value => labelValue(column.name, value)}
                          onChange={next => changeCondition(column, next)}
                          onHide={() =>
                            setColumns(current => current.filter(name => name !== column.name))
                          }
                          onSort={() =>
                            setSort({
                              column: column.name,
                              direction:
                                sort?.column === column.name && sort.direction === 'asc'
                                  ? 'desc'
                                  : 'asc',
                            })
                          }
                        />
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  {visibleProfiles.map(column => (
                    <td
                      key={column.name}
                      className="text-muted-foreground h-8 border-r border-b px-2"
                    >
                      {t(`plateJs.dataView.dataTypes.${column.type}`)}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={visibleProfiles.length} className="py-6">
                      <div className="flex justify-center">
                        <PolityLoadingScreen label={t('plateJs.dataView.loadingDataSample')} />
                      </div>
                    </td>
                  </tr>
                )}
                {items.length > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={visibleProfiles.length}
                      style={{ height: Math.max(0, items[0].start - 76), padding: 0 }}
                    />
                  </tr>
                )}
                {items.map(item => {
                  const row = pages.get(Math.floor(item.index / PAGE_SIZE) * PAGE_SIZE)?.[
                    item.index % PAGE_SIZE
                  ];
                  return (
                    <tr
                      key={item.index}
                      aria-rowindex={item.index + 3}
                      aria-busy={!row || undefined}
                      style={{ height: ROW_HEIGHT }}
                      className="even:bg-muted/20"
                    >
                      {visibleProfiles.map(column => (
                        <td
                          key={column.name}
                          className="max-w-0 truncate border-r border-b px-2 py-1"
                          title={row ? labelValue(column.name, row[column.name] ?? '') : undefined}
                        >
                          {row ? (
                            labelValue(column.name, row[column.name] ?? '')
                          ) : (
                            <span className="text-muted-foreground">
                              {t('plateJs.dataView.loadingDataSample')}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {items.length > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={visibleProfiles.length}
                      style={{
                        height: Math.max(
                          0,
                          virtualizer.getTotalSize() - items[items.length - 1].end
                        ),
                        padding: 0,
                      }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {!loading && total === 0 && (
            <p role="status" className="p-5 text-sm">
              {t('plateJs.dataView.sampleEmpty')}
            </p>
          )}
        </div>
      )}
      <div className="bg-background flex shrink-0 items-center justify-between gap-3 border-t p-4">
        <Button data-action-id="charts.dataset-explorer.back" variant="outline" onClick={onBack}>
          <ArrowLeftIcon className="size-4" />
          {t('plateJs.dataView.explorerBack')}
        </Button>
        <Button
          data-action-id="charts.dataset-explorer.apply"
          disabled={
            loading ||
            scopeApplying ||
            Boolean(error) ||
            !preview ||
            total === 0 ||
            !visibleProfiles.length
          }
          onClick={() =>
            preview &&
            onApply({
              filters: preview.appliedFilters,
              rowFilters: preview.rowFilters,
              rowConditions: conditions,
              timeRange: preview.timeRange,
              columns: visibleProfiles.map(column => column.name),
              sort,
            })
          }
        >
          {t('plateJs.dataView.explorerContinue')}
        </Button>
      </div>
    </div>
  );
}
