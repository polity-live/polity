/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DataViewDialogModel } from '../../hooks/useDataViewDialogModel';
import { DataViewDialogView } from '../DataViewDialogView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({
    children,
    onEscapeKeyDown,
    onInteractOutside,
    onPointerDownOutside,
  }: {
    children: ReactNode;
    onEscapeKeyDown?: (event: { preventDefault: () => void }) => void;
    onInteractOutside?: (event: { preventDefault: () => void }) => void;
    onPointerDownOutside?: (event: { preventDefault: () => void }) => void;
  }) => (
    <div>
      {children}
      <button
        data-testid="dialog-escape"
        onClick={() => onEscapeKeyDown?.({ preventDefault: vi.fn() })}
      />
      <button
        data-testid="dialog-pointer-outside"
        onClick={() => onPointerDownOutside?.({ preventDefault: vi.fn() })}
      />
      <button
        data-testid="dialog-interact-outside"
        onClick={() => onInteractOutside?.({ preventDefault: vi.fn() })}
      />
    </div>
  ),
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  InlineCheckbox: ({
    checked,
    disabled,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    disabled?: boolean;
    id?: string;
    onCheckedChange: (checked: boolean) => void;
    'data-action-id'?: string;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      aria-disabled={disabled}
      onChange={event => onCheckedChange(event.target.checked)}
      {...props}
    />
  ),
  SelectField: ({
    label,
    onValueChange,
    options,
    value,
    ...props
  }: {
    label?: ReactNode;
    onValueChange: (value: string) => void;
    options: { label: ReactNode; value: string }[];
    value?: string;
    'data-action-id'?: string;
  }) => (
    <select
      aria-label={typeof label === 'string' ? label : undefined}
      value={value}
      onChange={event => onValueChange(event.target.value)}
      {...props}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  TextField: ({
    id,
    label,
    onValueChange,
    value,
  }: {
    id: string;
    label: ReactNode;
    onValueChange?: (value: string) => void;
    value: string;
  }) => (
    <label htmlFor={id}>
      {label}
      <input id={id} value={value} onChange={event => onValueChange?.(event.target.value)} />
    </label>
  ),
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({
    children,
    onOpenChange,
  }: {
    children: ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div>
      {children}
      <button data-testid="open-popover" type="button" onClick={() => onOpenChange?.(true)} />
    </div>
  ),
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({
    children,
    onEscapeKeyDown,
    onInteractOutside,
    onPointerDownOutside,
  }: {
    children: ReactNode;
    onEscapeKeyDown?: (event: { preventDefault: () => void }) => void;
    onInteractOutside?: (event: { preventDefault: () => void }) => void;
    onPointerDownOutside?: (event: { preventDefault: () => void }) => void;
  }) => (
    <div>
      {children}
      <button
        data-testid="sheet-escape"
        onClick={() => onEscapeKeyDown?.({ preventDefault: vi.fn() })}
      />
      <button
        data-testid="sheet-pointer-outside"
        onClick={() => onPointerDownOutside?.({ preventDefault: vi.fn() })}
      />
      <button
        data-testid="sheet-interact-outside"
        onClick={() => onInteractOutside?.({ preventDefault: vi.fn() })}
      />
    </div>
  ),
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  SheetHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/ui/tabs', async () => {
  const { createContext, useContext } = await import('react');
  const TabsContext = createContext<(value: string) => void>(() => undefined);
  return {
    Tabs: ({
      children,
      onValueChange,
    }: {
      children: ReactNode;
      onValueChange: (value: string) => void;
    }) => <TabsContext.Provider value={onValueChange}>{children}</TabsContext.Provider>,
    TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({
      children,
      onClick,
      value,
      ...props
    }: {
      children: ReactNode;
      disabled?: boolean;
      onClick?: () => void;
      value: string;
      'data-action-id'?: string;
    }) => {
      const onValueChange = useContext(TabsContext);
      return (
        <button
          type="button"
          role="tab"
          onClick={() => {
            onClick?.();
            onValueChange(value);
          }}
          {...props}
        >
          {children}
        </button>
      );
    },
  };
});

vi.mock('@/features/shared/ui/ui/toggle-group', async () => {
  const { createContext, useContext } = await import('react');
  const ToggleContext = createContext<(value: string) => void>(() => undefined);
  return {
    ToggleGroup: ({
      children,
      onValueChange,
    }: {
      children: ReactNode;
      onValueChange: (value: string) => void;
    }) => <ToggleContext.Provider value={onValueChange}>{children}</ToggleContext.Provider>,
    ToggleGroupItem: ({
      children,
      value,
      ...props
    }: {
      children: ReactNode;
      value: string;
      disabled?: boolean;
      'data-action-id'?: string;
      'aria-label'?: string;
    }) => {
      const onValueChange = useContext(ToggleContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
  };
});

vi.mock('@/features/file-upload/ui/FileDropzone', () => ({
  FileDropzone: ({
    onFilesRejected,
    onFilesSelected,
  }: {
    onFilesRejected: (rejections: { code?: string }[]) => void;
    onFilesSelected: (files: File[]) => void;
  }) => (
    <div data-testid="file-dropzone">
      <button data-testid="select-no-file" type="button" onClick={() => onFilesSelected([])} />
      {['file-size', 'too-many-files', 'file-invalid-type'].map(code => (
        <button
          data-testid={`reject-${code}`}
          key={code}
          type="button"
          onClick={() => onFilesRejected([{ code }])}
        />
      ))}
    </div>
  ),
}));

vi.mock('../ChartRenderer', () => ({
  ChartRenderer: () => <div data-testid="chart-renderer" />,
}));

vi.mock('../DataViewAttribution', () => ({
  DataViewAttribution: () => <div data-testid="attribution" />,
}));

vi.mock('../ManualChartTableEditor', () => ({
  ManualChartTableEditor: () => <div data-testid="manual-table" />,
}));

afterEach(cleanup);

const dimensionProfile = {
  distinctCount: 2,
  label: 'Year',
  name: 'Year',
  role: 'dimension' as const,
  type: 'date' as const,
};
const valueProfile = {
  distinctCount: 2,
  label: 'Value',
  name: 'Value',
  role: 'measure' as const,
  type: 'number' as const,
};
const otherValueProfile = {
  distinctCount: 2,
  label: 'Other value',
  name: 'OtherValue',
  role: 'measure' as const,
  type: 'number' as const,
};
const categoryProfile = {
  distinctCount: 2,
  label: 'Category',
  name: 'Category',
  role: 'dimension' as const,
  type: 'string' as const,
};
const result = {
  byteSize: 100,
  description: 'A result',
  id: 'result-1',
  provider: 'GOVDATA' as const,
  publisher: 'Publisher',
  title: 'Employment',
};

type TestDataViewDialogModel = DataViewDialogModel & {
  setPresentation: ReturnType<typeof vi.fn>;
  setProviders: ReturnType<typeof vi.fn>;
  setQuery: ReturnType<typeof vi.fn>;
};

function model(overrides: Record<string, unknown> = {}): TestDataViewDialogModel {
  return {
    activeFilterCount: 1,
    canInsert: true,
    canManageDatasets: true,
    canUploadDatasets: true,
    changeDataset: vi.fn(),
    chartType: 'bar',
    columnProfiles: [dimensionProfile, valueProfile, otherValueProfile],
    dimensionProfiles: [dimensionProfile],
    editingElement: undefined,
    error: null,
    filterableProfiles: [dimensionProfile],
    filterValues: { Year: ['2025'] },
    filterValuesLoading: false,
    loadFilterValues: vi.fn(),
    manualTable: { columns: ['Category', 'Value'], rows: [{ Category: '', Value: '' }] },
    numericProfiles: [valueProfile, otherValueProfile],
    open: true,
    preparing: false,
    presentation: { showGrid: true, showLegend: true, title: '' },
    projection: null,
    projectionError: null,
    projectionLoading: false,
    providerErrors: [],
    providers: ['EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA', 'UPLOAD'],
    query: {
      aggregation: 'sum',
      dimensionColumn: 'Year',
      filters: { Year: '2025' },
      layout: 'long',
      limit: 10,
      measureColumn: 'Value',
      sort: { column: 'Year', direction: 'asc' },
      valueColumns: ['Value', 'OtherValue'],
    },
    save: vi.fn(),
    searchQuery: '',
    searchResults: [result],
    searching: false,
    selectedResult: result,
    selectedUploadGroupName: 'Group',
    setChartType: vi.fn(),
    setError: vi.fn(),
    setManualTable: vi.fn(),
    setOpen: vi.fn(),
    setPresentation: vi.fn(),
    setProviders: vi.fn(),
    setQuery: vi.fn(),
    setSearchQuery: vi.fn(),
    setSelectedResult: vi.fn(),
    setUploadDescription: vi.fn(),
    setUploadError: vi.fn(),
    setUploadFile: vi.fn(),
    setUploadGroupId: vi.fn(),
    setUploadMode: vi.fn(),
    setUploadOpen: vi.fn(),
    setUploadTitle: vi.fn(),
    setView: vi.fn(),
    snapshot: {
      byteSize: 100,
      columnCount: 3,
      columnProfiles: [dimensionProfile, valueProfile, otherValueProfile],
      columns: ['Year', 'Value', 'OtherValue'],
      datasetId: 'dataset-1',
      provider: 'GOVDATA',
      rowCount: 2,
      rows: [],
      snapshotId: 'snapshot-1',
      snapshotKey: 'snapshot-key',
      snapshotTakenAt: '2026-08-01T00:00:00Z',
      title: 'Employment',
    },
    stage: 'find',
    submitUpload: vi.fn(),
    uploadDescription: '',
    uploadError: null,
    uploadFile: new File(['a,b'], 'data.csv', { type: 'text/csv' }),
    uploadGroupId: 'group-1',
    uploadGroups: [{ id: 'group-1', name: 'Group' }],
    uploadGroupsLoading: false,
    uploading: false,
    uploadMode: 'file',
    uploadOpen: true,
    uploadTitle: 'Data',
    useSelectedDataset: vi.fn(),
    view: 'chart',
    ...overrides,
  } as unknown as TestDataViewDialogModel;
}

function actionIds(container: HTMLElement) {
  return new Set(
    Array.from(container.querySelectorAll('[data-action-id]')).map(element =>
      element.getAttribute('data-action-id')
    )
  );
}

describe('DataViewDialogView action contracts', () => {
  it('exposes and drives stable finder and source actions across result states', () => {
    const finder = model();
    const view = render(<DataViewDialogView model={finder} />);
    const ids = actionIds(view.container);

    for (const id of [
      'charts.data-view.sources.open',
      'charts.data-view.sources.toggle-provider',
      'charts.data-view.sources.select-all',
      'charts.data-view.sources.clear',
      'charts.data-view.search.use-suggestion',
      'charts.data-view.select-result',
      'charts.data-view.back-to-results',
      'charts.data-view.use-dataset',
    ]) {
      expect(ids.has(id)).toBe(true);
    }

    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.select-result"]')!
    );
    expect(finder.setSelectedResult).toHaveBeenCalledWith(result);
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.sources.select-all"]')!
    );
    expect(finder.setProviders).toHaveBeenCalled();
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.sources.clear"]')!
    );
    expect(finder.setProviders).toHaveBeenCalledWith([]);
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.use-dataset"]')!
    );
    expect(finder.useSelectedDataset).toHaveBeenCalledOnce();

    const noResults = model({ searchQuery: 'missing', searchResults: [], selectedResult: null });
    view.rerender(<DataViewDialogView model={noResults} />);
    expect(actionIds(view.container).has('charts.data-view.upload.open.no-results')).toBe(true);
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.upload.open.no-results"]')!
    );
    expect(noResults.setUploadOpen).toHaveBeenCalledWith(true);
    view.rerender(
      <DataViewDialogView model={model({ searchResults: [], selectedResult: null })} />
    );
    expect(actionIds(view.container).has('charts.data-view.upload.open.empty')).toBe(true);
  });

  it('exposes stable chart, table, metric, upload and save configuration actions', () => {
    const chart = model({ stage: 'build' });
    const view = render(<DataViewDialogView model={chart} />);
    const allIds = actionIds(view.container);

    for (const id of [
      'charts.data-view.change-dataset',
      'charts.data-view.view.chart',
      'charts.data-view.view.table',
      'charts.data-view.view.stat',
      'charts.data-view.filters.open',
      'charts.data-view.filters.clear',
      'charts.data-view.chart.reset-values',
      'charts.data-view.chart.toggle-value',
      'charts.data-view.chart.aggregation',
      'charts.data-view.chart.select-type',
      'charts.data-view.options.toggle',
      'charts.data-view.chart.toggle-legend',
      'charts.data-view.chart.toggle-grid',
      'charts.data-view.upload.mode.file',
      'charts.data-view.upload.mode.manual',
      'charts.data-view.upload.remove-file',
      'charts.data-view.upload.cancel',
      'charts.data-view.upload.submit',
      'charts.data-view.save',
    ]) {
      expect(allIds.has(id)).toBe(true);
    }

    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.view.table"]')!
    );
    expect(chart.setView).toHaveBeenCalledWith('table');
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.view.chart"]')!
    );
    expect(chart.setView).toHaveBeenCalledWith('chart');
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.chart.select-type"]')!
    );
    expect(chart.setChartType).toHaveBeenCalled();
    fireEvent.click(view.container.querySelector('[data-action-id="charts.data-view.save"]')!);
    expect(chart.save).toHaveBeenCalledOnce();

    view.rerender(<DataViewDialogView model={model({ stage: 'build', view: 'table' })} />);
    for (const id of [
      'charts.data-view.table.reset-columns',
      'charts.data-view.table.toggle-column',
      'charts.data-view.table.sort.ascending',
      'charts.data-view.table.sort.descending',
    ]) {
      expect(actionIds(view.container).has(id)).toBe(true);
    }

    view.rerender(<DataViewDialogView model={model({ stage: 'build', view: 'stat' })} />);
    expect(actionIds(view.container).has('charts.data-view.stat.aggregation')).toBe(true);
  });

  it('renders finder metadata, partial states, provider mutations, and oversized details', () => {
    const richResult = {
      ...result,
      byteSize: 2_500_000,
      groupId: 'group-1',
      license: 'CC-BY',
      modified: '2026-07-01T00:00:00Z',
      snapshotTakenAt: '2026-08-01T00:00:00Z',
      spatialCoverage: ['Berlin', 'Brandenburg', 'Ignored'],
      structureSummary: '3 columns',
      timeCoverage: { start: '2020', end: '2025' },
      valueSummary: '20 rows',
    };
    const sparseResult = {
      ...result,
      id: 'sparse',
      byteSize: null,
      description: null,
      publisher: null,
      spatialCoverage: { label: null },
      timeCoverage: { start: '2024' },
    };
    const endOnlyResult = {
      ...result,
      id: 'end-only',
      spatialCoverage: { label: 'Europe' },
      timeCoverage: { end: '2025' },
    };
    const finder = model({
      providerErrors: [{ provider: 'GOVDATA', error: 'offline' }],
      providers: ['EUROSTAT'],
      searching: true,
      searchResults: [richResult, sparseResult, endOnlyResult],
      selectedResult: richResult,
    });
    const view = render(<DataViewDialogView model={finder} />);
    expect(view.getByText(/MB/)).toBeTruthy();
    expect(view.getByText('2020–2025 · Berlin, Brandenburg')).toBeTruthy();

    const providerToggles = Array.from(
      view.container.querySelectorAll('[data-action-id="charts.data-view.sources.toggle-provider"]')
    );
    fireEvent.click(providerToggles[0]!);
    fireEvent.click(providerToggles[1]!);
    const providerUpdaters = finder.setProviders.mock.calls
      .map((call: unknown[]) => call[0])
      .filter(
        (value: unknown): value is (providers: string[]) => string[] => typeof value === 'function'
      );
    expect(providerUpdaters[0](['EUROSTAT'])).toEqual([]);
    expect(providerUpdaters[1]([])).toEqual(['GENESIS_DESTATIS']);
    expect(providerUpdaters[1](['GENESIS_DESTATIS'])).toEqual(['GENESIS_DESTATIS']);

    const details = model({
      preparing: true,
      searchResults: [richResult],
      selectedResult: { ...richResult, byteSize: 60 * 1024 * 1024 },
    });
    view.rerender(<DataViewDialogView model={details} />);
    expect(view.getByText('plateJs.dataView.tooLarge')).toBeTruthy();
    view.rerender(
      <DataViewDialogView
        model={model({
          preparing: false,
          searchResults: [richResult],
          selectedResult: { ...richResult, byteSize: 60 * 1024 * 1024 },
        })}
      />
    );

    view.rerender(
      <DataViewDialogView
        model={model({
          canUploadDatasets: false,
          preparing: false,
          searchQuery: 'missing',
          searchResults: [],
          selectedResult: null,
        })}
      />
    );
    expect(actionIds(view.container).has('charts.data-view.upload.open.no-results')).toBe(false);
    view.rerender(
      <DataViewDialogView
        model={model({
          canUploadDatasets: false,
          searchQuery: '',
          searchResults: [],
          selectedResult: null,
        })}
      />
    );
    expect(actionIds(view.container).has('charts.data-view.upload.open.empty')).toBe(false);
    view.rerender(
      <DataViewDialogView
        model={model({
          preparing: false,
          searchResults: [sparseResult],
          selectedResult: sparseResult,
        })}
      />
    );
    expect(view.queryByText('plateJs.dataView.tooLarge')).toBeNull();
  });

  it('drives builder callbacks through chart, table, wide, stat, and empty-profile boundaries', () => {
    const chart = model({ stage: 'build', chartType: 'pie' });
    const view = render(<DataViewDialogView model={chart} />);

    for (const select of Array.from(view.container.querySelectorAll('select'))) {
      const options = Array.from(select.querySelectorAll('option'));
      if (options.length > 0)
        fireEvent.change(select, { target: { value: options.at(-1)!.value } });
    }
    for (const checkbox of Array.from(view.container.querySelectorAll('input[type="checkbox"]'))) {
      fireEvent.click(checkbox);
    }
    for (const toggle of Array.from(
      view.container.querySelectorAll('[data-action-id="charts.data-view.chart.toggle-value"]')
    )) {
      fireEvent.click(toggle);
    }
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.chart.reset-values"]')!
    );
    fireEvent.click(view.getAllByTestId('open-popover').at(-1)!);
    expect(chart.loadFilterValues).toHaveBeenCalledOnce();

    for (const [updater] of chart.setQuery.mock.calls) {
      if (typeof updater === 'function') updater(chart.query);
    }
    for (const [updater] of chart.setPresentation.mock.calls) {
      if (typeof updater === 'function') updater(chart.presentation);
    }
    expect(chart.setChartType).toHaveBeenCalled();

    const noSelection = model({
      stage: 'build',
      selectedResult: null,
      query: { ...chart.query, valueColumns: undefined, measureColumn: 'Missing' },
    });
    view.rerender(<DataViewDialogView model={noSelection} />);
    for (const select of Array.from(view.container.querySelectorAll('select'))) {
      const option = select.querySelector('option');
      if (option) fireEvent.change(select, { target: { value: option.value } });
    }

    const chartBoundaries = model({
      activeFilterCount: 0,
      chartType: 'pie',
      columnProfiles: [dimensionProfile, categoryProfile, valueProfile, otherValueProfile],
      dimensionProfiles: [dimensionProfile, categoryProfile],
      filterValues: {},
      filterValuesLoading: true,
      query: {
        ...chart.query,
        dimensionColumn: null,
        filters: {},
        measureColumn: null,
        seriesColumn: null,
        valueColumns: ['Value'],
      },
      stage: 'build',
    });
    view.rerender(<DataViewDialogView model={chartBoundaries} />);
    const boundarySelects = Array.from(view.container.querySelectorAll('select'));
    for (const select of boundarySelects) {
      const options = Array.from(select.querySelectorAll('option'));
      for (const option of options) {
        fireEvent.change(select, { target: { value: option.value } });
      }
    }
    const valueToggles = Array.from(
      view.container.querySelectorAll('[data-action-id="charts.data-view.chart.toggle-value"]')
    );
    fireEvent.click(valueToggles[0]!);
    fireEvent.click(valueToggles[1]!);
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.chart.reset-values"]')!
    );
    for (const [updater] of chartBoundaries.setQuery.mock.calls) {
      if (typeof updater === 'function') updater(chartBoundaries.query);
    }

    const nonPie = model({ stage: 'build', chartType: 'bar' });
    view.rerender(<DataViewDialogView model={nonPie} />);
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.chart.reset-values"]')!
    );

    const singleMeasure = model({
      stage: 'build',
      numericProfiles: [valueProfile],
      query: { ...chart.query, valueColumns: undefined, measureColumn: null },
    });
    view.rerender(<DataViewDialogView model={singleMeasure} />);

    const wide = model({
      stage: 'build',
      query: { ...chart.query, dimensionColumn: null, layout: 'wide', valueColumns: [] },
      presentation: {
        description: undefined,
        showGrid: false,
        showLegend: false,
        title: undefined,
      },
    });
    view.rerender(<DataViewDialogView model={wide} />);
    for (const select of Array.from(view.container.querySelectorAll('select'))) {
      const option = select.querySelector('option');
      if (option) fireEvent.change(select, { target: { value: option.value } });
    }

    const table = model({
      stage: 'build',
      view: 'table',
      query: {
        ...chart.query,
        columns: ['Year', 'Value'],
        limit: undefined,
        sort: { column: 'Year', direction: 'asc' },
      },
    });
    view.rerender(<DataViewDialogView model={table} />);
    for (const checkbox of Array.from(view.container.querySelectorAll('input[type="checkbox"]'))) {
      fireEvent.click(checkbox);
    }
    for (const select of Array.from(view.container.querySelectorAll('select'))) {
      const options = Array.from(select.querySelectorAll('option'));
      for (const option of options) {
        fireEvent.change(select, { target: { value: option.value } });
      }
    }
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.table.sort.descending"]')!
    );
    for (const [updater] of table.setQuery.mock.calls) {
      if (typeof updater === 'function') {
        updater({ ...table.query, columns: ['Year'], sort: { column: 'Year', direction: 'asc' } });
        updater({ ...table.query, columns: ['Year'], sort: null });
        updater({ ...table.query, columns: undefined, sort: { column: 'Year', direction: 'asc' } });
      }
    }

    view.rerender(
      <DataViewDialogView
        model={model({
          stage: 'build',
          view: 'table',
          query: { ...chart.query, columns: ['Year'], sort: null },
        })}
      />
    );

    view.rerender(<DataViewDialogView model={model({ stage: 'build', view: 'stat' })} />);
  });

  it('renders every projection and dialog state boundary', () => {
    const view = render(
      <DataViewDialogView model={model({ stage: 'build', projectionLoading: true })} />
    );
    view.rerender(
      <DataViewDialogView model={model({ stage: 'build', projectionError: 'Preview failed' })} />
    );
    expect(view.getByText('Preview failed')).toBeTruthy();
    view.rerender(<DataViewDialogView model={model({ stage: 'build', projection: null })} />);

    const chartProjection = {
      view: 'chart',
      points: [{ x: '2026', value: 1 }],
      rowCount: 1,
      snapshotId: 'snapshot-1',
    };
    view.rerender(
      <DataViewDialogView
        model={model({ stage: 'build', projection: chartProjection, snapshot: null })}
      />
    );
    const statProjection = {
      view: 'stat',
      label: 'Value',
      value: 1,
      aggregation: 'sum',
      rowCount: 1,
      snapshotId: 'snapshot-1',
    };
    view.rerender(
      <DataViewDialogView
        model={model({
          stage: 'build',
          projection: statProjection,
          presentation: { showGrid: true, showLegend: true, title: '' },
        })}
      />
    );
    const tableProjection = {
      view: 'table',
      columns: ['Year'],
      rows: [{ Year: '2026' }],
      rowCount: 1,
      snapshotId: 'snapshot-1',
    };
    view.rerender(
      <DataViewDialogView
        model={model({
          stage: 'build',
          projection: tableProjection,
          presentation: { description: 'Description', title: 'Table title' },
        })}
      />
    );
    view.rerender(
      <DataViewDialogView
        model={model({
          stage: 'build',
          projection: tableProjection,
          presentation: { description: '', title: 'Table title' },
        })}
      />
    );
    view.rerender(
      <DataViewDialogView
        model={model({
          stage: 'build',
          projection: tableProjection,
          presentation: { description: '', title: '' },
        })}
      />
    );
    view.rerender(
      <DataViewDialogView
        model={model({
          editingElement: { type: 'data_view' },
          error: 'Dialog error',
          projectionLoading: true,
          stage: 'build',
          view: 'stat',
        })}
      />
    );
    expect(view.getByText('Dialog error')).toBeTruthy();
  });

  it('covers upload rejection, empty-group, manual, no-file, error, and busy states', () => {
    const upload = model();
    const view = render(<DataViewDialogView model={upload} />);
    for (const code of ['file-size', 'too-many-files', 'file-invalid-type']) {
      fireEvent.click(view.getByTestId(`reject-${code}`));
    }
    fireEvent.click(view.getByTestId('select-no-file'));
    expect(upload.setUploadError).toHaveBeenCalledTimes(3);
    expect(upload.setUploadFile).toHaveBeenCalledWith(null);

    view.rerender(
      <DataViewDialogView
        model={model({
          uploadError: 'Upload failed',
          uploadFile: null,
          uploadGroups: [],
          uploadGroupId: '',
          uploadMode: 'manual',
          uploadOpen: true,
        })}
      />
    );
    expect(view.getByText('plateJs.dataView.noUploadGroups')).toBeTruthy();
    expect(view.getByText('Upload failed')).toBeTruthy();
    view.rerender(
      <DataViewDialogView
        model={model({
          selectedUploadGroupName: null,
          uploadGroupsLoading: true,
          uploading: true,
          uploadFile: null,
          uploadOpen: true,
        })}
      />
    );
  });

  it('invokes every dialog, finder, builder, filter, option, and upload handler', () => {
    const finder = model();
    const view = render(<DataViewDialogView model={finder} />);
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.back-to-results"]')!
    );
    for (const testId of ['dialog-escape', 'dialog-pointer-outside', 'dialog-interact-outside']) {
      fireEvent.click(view.getByTestId(testId));
    }

    const emptyFinder = model({ searchResults: [], selectedResult: null });
    view.rerender(<DataViewDialogView model={emptyFinder} />);
    fireEvent.change(view.getByLabelText('plateJs.dataView.searchLabel'), {
      target: { value: 'population' },
    });
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.search.use-suggestion"]')!
    );
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.upload.open.empty"]')!
    );

    const builder = model({
      activeFilterCount: 1,
      chartType: 'bar',
      numericProfiles: [valueProfile],
      query: { ...model().query, valueColumns: undefined },
      stage: 'build',
    });
    view.rerender(<DataViewDialogView model={builder} />);
    for (const select of Array.from(view.container.querySelectorAll('select'))) {
      const options = Array.from(select.querySelectorAll('option'));
      if (options.length > 0) fireEvent.change(select, { target: { value: options[0]!.value } });
    }
    fireEvent.change(view.container.querySelector('#filter-Year')!, { target: { value: '2024' } });
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.filters.clear"]')!
    );
    for (const id of [
      'data-view-title',
      'data-view-description',
      'data-view-x-label',
      'data-view-y-label',
    ]) {
      fireEvent.change(view.container.querySelector(`#${id}`)!, { target: { value: 'Updated' } });
    }
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.chart.toggle-grid"]')!
    );
    fireEvent.click(view.container.querySelector('[data-action-id="charts.data-view.view.stat"]')!);
    for (const [updater] of builder.setQuery.mock.calls) {
      if (typeof updater === 'function') updater(builder.query);
    }
    for (const [updater] of builder.setPresentation.mock.calls) {
      if (typeof updater === 'function') updater(builder.presentation);
    }

    const table = model({ stage: 'build', view: 'table' });
    view.rerender(<DataViewDialogView model={table} />);
    fireEvent.click(
      view.container.querySelector('[data-action-id="charts.data-view.table.reset-columns"]')!
    );
    for (const [updater] of table.setQuery.mock.calls) {
      if (typeof updater === 'function') updater(table.query);
    }

    const wide = model({ stage: 'build', query: { ...model().query, layout: 'wide' } });
    view.rerender(<DataViewDialogView model={wide} />);
    const rowLabel = view.getByLabelText('plateJs.dataView.rowLabel');
    fireEvent.change(rowLabel, { target: { value: 'Year' } });
    for (const [updater] of wide.setQuery.mock.calls) {
      if (typeof updater === 'function') updater(wide.query);
    }

    const upload = model();
    view.rerender(<DataViewDialogView model={upload} />);
    for (const actionId of [
      'charts.data-view.upload.mode.file',
      'charts.data-view.upload.mode.manual',
      'charts.data-view.upload.remove-file',
      'charts.data-view.upload.cancel',
      'charts.data-view.upload.submit',
    ]) {
      fireEvent.click(view.container.querySelector(`[data-action-id="${actionId}"]`)!);
    }
    for (const testId of ['sheet-escape', 'sheet-pointer-outside', 'sheet-interact-outside']) {
      fireEvent.click(view.getByTestId(testId));
    }
    expect(upload.submitUpload).toHaveBeenCalledOnce();
  });
});
