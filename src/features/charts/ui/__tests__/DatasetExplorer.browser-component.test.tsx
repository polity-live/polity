import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DatasetExplorer } from '../DatasetExplorer';
import { loadDatasetPreview } from '../../api/datasetClient';
import type { DatasetPreviewRequest, DatasetColumnProfile } from '../../types';
import '@/i18n/i18n';
import '@/font-faces.css';
import '@/styles.css';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { access_token: 'test-token' } }),
}));
vi.mock('../../api/datasetClient', () => ({
  prepareDatasetRawDownload: vi.fn(),
  loadDatasetPreview: vi.fn(),
}));
const columns: DatasetColumnProfile[] = [
  {
    name: 'period',
    label: 'Period',
    role: 'time',
    type: 'date',
    nullCount: 0,
    distinctCount: 1000,
  },
  {
    name: 'value',
    label: 'Value',
    role: 'measure',
    type: 'number',
    nullCount: 0,
    distinctCount: 1000,
  },
  { name: 'area', label: 'Area', role: 'geo', type: 'category', nullCount: 0, distinctCount: 2 },
  {
    name: 'code',
    label: 'statistics_code',
    role: 'label',
    type: 'category',
    nullCount: 0,
    distinctCount: 1,
    technical: true,
  },
];
const request: DatasetPreviewRequest = {
  provider: 'UPLOAD',
  datasetId: 'dataset',
  snapshotId: 'snapshot',
};
const rows = Array.from({ length: 1000 }, (_, index) => ({
  period: `row-${String(index).padStart(4, '0')}`,
  value: String(index),
  area: index % 2 ? 'Germany' : 'France',
  code: 'technical',
}));
beforeEach(() => {
  vi.mocked(loadDatasetPreview).mockReset();
  vi.mocked(loadDatasetPreview).mockImplementation(async selected => {
    const filtered = rows.filter(row =>
      (selected.rowConditions ?? []).every(filter =>
        filter.operator === 'range'
          ? Number(row[filter.column as 'value']) >= Number(filter.min ?? 0) &&
            Number(row[filter.column as 'value']) <= Number(filter.max ?? 999)
          : filter.operator === 'in'
            ? filter.values.includes(row[filter.column as 'area'])
            : true
      )
    );
    const offset = selected.page?.offset ?? 0;
    const limit = selected.page?.limit ?? 5;
    return {
      identity: selected,
      columns,
      rows: filtered.slice(offset, offset + limit),
      rowFilters: selected.rowFilters ?? {},
      appliedFilters: selected.filters ?? {},
      timeRange: selected.timeRange,
      sampled: false,
      sampledRowCount: filtered.length,
      page: {
        offset,
        limit,
        total: filtered.length,
        nextOffset: offset + limit < filtered.length ? offset + limit : null,
      },
      facets: {
        area: { values: ['France', 'Germany'], complete: true },
        value: {
          values: Array.from({ length: 100 }, (_, index) => String(index)),
          complete: false,
        },
      },
    };
  });
});
afterEach(cleanup);

it.each([1280, 390])(
  'virtualizes and pages the table, filters actual values and adopts columns at width %s',
  async width => {
    await page.viewport(width, 844);
    const apply = vi.fn();
    const back = vi.fn();
    render(
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <DatasetExplorer request={request} title="Example dataset" onBack={back} onApply={apply} />
      </div>
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
    );
    expect(screen.getByRole('table').getAttribute('aria-rowcount')).toBe('1002');
    expect(screen.getAllByRole('row').length).toBeLessThan(70);
    expect(screen.getAllByRole('row').length).toBeGreaterThan(7);
    const viewport = screen.getByRole('region', { name: 'Virtual data preview' });
    viewport.scrollTo({ top: 900 * 32 });
    await waitFor(() =>
      expect(
        vi
          .mocked(loadDatasetPreview)
          .mock.calls.some(([selected]) => (selected.page?.offset ?? 0) >= 800)
      ).toBe(true)
    );
    await waitFor(() => expect(viewport.textContent).toContain('row-0900'));
    viewport.scrollTo({ top: 0, left: 0 });
    await userEvent.click(screen.getByRole('button', { name: 'Filter Value' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter type' }), {
      target: { value: 'range' },
    });
    await userEvent.fill(screen.getByRole('textbox', { name: 'From' }), '10');
    await userEvent.fill(screen.getByRole('textbox', { name: 'To' }), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
    await waitFor(() => expect(screen.getByRole('table').getAttribute('aria-rowcount')).toBe('5'));
    expect(viewport.scrollTop).toBe(0);
    expect(screen.getByText('row-0010')).toBeVisible();
    expect(screen.queryByText('row-0009')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Visible columns' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Area' }));
    const technical = screen.getByRole('checkbox', { name: 'Show technical columns' });
    technical.focus();
    expect(document.activeElement).toBe(technical);
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Filter Area' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter statistics_code' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Apply selection' }));
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: ['period', 'value', 'code'],
        rowConditions: [
          { column: 'value', operator: 'range', min: '10', max: '12', numeric: true },
        ],
      })
    );
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `../../../../../output/playwright/dataset-explorer-${width}.png`,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).toHaveBeenCalledOnce();
  }
);

it('aborts an obsolete table request and prevents stale rows from enabling adoption', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof loadDatasetPreview>>) => void;
  vi.mocked(loadDatasetPreview).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  const first = render(
    <div style={{ height: 700 }}>
      <DatasetExplorer
        request={request}
        title="First"
        onBack={() => undefined}
        onApply={() => undefined}
      />
    </div>
  );
  await waitFor(() => expect(loadDatasetPreview).toHaveBeenCalledOnce());
  const firstSignal = vi.mocked(loadDatasetPreview).mock.calls[0][2];
  first.unmount();
  expect(firstSignal?.aborted).toBe(true);
  render(
    <div style={{ height: 700, display: 'flex', flexDirection: 'column' }}>
      <DatasetExplorer
        request={{ ...request, snapshotId: 'second' }}
        title="Second"
        onBack={() => undefined}
        onApply={() => undefined}
      />
    </div>
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  resolve({
    identity: request,
    columns,
    rows: [{ ...rows[0], period: 'obsolete' }],
    rowFilters: {},
    appliedFilters: {},
    sampled: false,
    sampledRowCount: 1,
  });
  expect(screen.queryByText('obsolete')).toBeNull();
});
it('recovers from a sample failure and adopts header filters without a required measure or draft quick scope', async () => {
  await page.viewport(1280, 900);
  const measures = [
    {
      id: 'count',
      label: 'Unemployed',
      unit: 'Number',
      filters: { metric: 'count', unit: 'number' },
    },
    {
      id: 'rate',
      label: 'Unemployment rate',
      unit: 'Percent',
      filters: { metric: 'rate', unit: 'percent' },
    },
  ];
  const base = vi.mocked(loadDatasetPreview).getMockImplementation()!;
  vi.mocked(loadDatasetPreview).mockImplementation(async (selected, token, signal) => {
    const result = await base(selected, token, signal);
    return {
      ...result,
      metadata: { measureOptions: measures },
      ...(selected.filters?.period?.start === 2026
        ? { rows: [], page: { ...result.page!, total: 0, nextOffset: null } }
        : {}),
    };
  });
  vi.mocked(loadDatasetPreview).mockRejectedValueOnce(new Error('Sample unavailable'));
  const apply = vi.fn();
  render(
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <DatasetExplorer
        request={request}
        title="Measures"
        onBack={() => undefined}
        onApply={apply}
      />
    </div>
  );
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Apply selection' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Search again' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  expect(screen.queryByRole('combobox', { name: 'Measure and unit' })).toBeNull();
  await userEvent.fill(screen.getByRole('textbox', { name: 'From year' }), '2026');
  await userEvent.fill(screen.getByRole('textbox', { name: 'Area' }), 'Germany');
  await userEvent.fill(screen.getByRole('textbox', { name: 'To year' }), '2026');
  expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  await screen.findByText('No sample rows match this selection.');
  await userEvent.fill(screen.getByRole('textbox', { name: 'From year' }), '2025');
  await userEvent.fill(screen.getByRole('textbox', { name: 'To year' }), '2025');
  await userEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  await userEvent.click(screen.getByRole('button', { name: 'Sort Value' }));
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].sort?.direction).toBe('asc')
  );
  await userEvent.click(screen.getByRole('button', { name: 'Sort Value' }));
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].sort?.direction).toBe('desc')
  );
  await userEvent.click(screen.getByRole('button', { name: 'Filter Area' }));
  await userEvent.fill(screen.getByRole('textbox', { name: 'Find a value' }), 'Germany');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Germany' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].rowConditions?.[0]).toMatchObject({
      column: 'area',
      values: ['Germany'],
    })
  );
  await userEvent.click(screen.getByRole('button', { name: 'Filter Area' }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove filter' }));
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].rowConditions).toEqual([])
  );
  await userEvent.click(screen.getByRole('button', { name: 'Filter Area' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter type' }), 'contains');
  await userEvent.fill(screen.getByRole('textbox', { name: 'Text contains' }), 'German');
  await userEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].rowConditions).toEqual([
      { column: 'area', operator: 'contains', value: 'German' },
    ])
  );
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  await userEvent.click(screen.getByRole('button', { name: 'Apply selection' }));
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({
      rowFilters: {},
      filters: expect.objectContaining({ area: null, period: null }),
      sort: { column: 'value', direction: 'desc' },
    })
  );
});

it.each([1280, 390])(
  'keeps filter actions in view for 100 long values and hides a filtered column at width %s',
  async width => {
    await page.viewport(width, 700);
    const base = vi.mocked(loadDatasetPreview).getMockImplementation()!;
    vi.mocked(loadDatasetPreview).mockImplementation(async (selected, token, signal) => ({
      ...(await base(selected, token, signal)),
      metadata: {
        providerDimensions: [
          {
            id: 'value',
            label: 'Value',
            values: Array.from({ length: 100 }, (_, index) => ({
              id: String(index),
              label: `A very long descriptive statistical category with several wrapped lines ${index}`,
            })),
          },
        ],
      },
    }));
    const apply = vi.fn();
    render(
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <DatasetExplorer
          request={request}
          title="Columns"
          onBack={() => undefined}
          onApply={apply}
        />
      </div>
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
    );
    await userEvent.click(screen.getByRole('button', { name: 'Filter Value' }));
    const applyFilter = screen.getByRole('button', { name: 'Apply filter' });
    const removeFilter = screen.getByRole('button', { name: 'Remove filter' });
    for (const button of [applyFilter, removeFilter]) {
      const rect = button.getBoundingClientRect();
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThanOrEqual(700);
    }
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'A very long descriptive statistical category with several wrapped lines 10',
      })
    );
    await userEvent.click(applyFilter);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hide column Value' }));
    expect(screen.queryByRole('button', { name: 'Filter Value' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Apply selection' }));
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: ['period', 'area'],
        rowConditions: [{ column: 'value', operator: 'in', values: ['10'] }],
      })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Visible columns' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Value' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Filter Value' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  }
);
it('removes quick scope without removing manual filters and lets a header replace quick geography', async () => {
  await page.viewport(1280, 844);
  const apply = vi.fn();
  render(
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <DatasetExplorer
        request={{
          ...request,
          filters: { area: 'Germany', period: { start: 2025, end: 2025 } },
          rowConditions: [
            { column: 'value', operator: 'range', min: '10', max: '20', numeric: true },
          ],
        }}
        title="Quick filters"
        onBack={() => undefined}
        onApply={apply}
      />
    </div>
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  await userEvent.click(screen.getByRole('button', { name: 'Filter Area' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'France' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  await userEvent.click(screen.getByRole('button', { name: 'Remove quick filters' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  await userEvent.fill(screen.getByRole('textbox', { name: 'From year' }), '2024');
  await userEvent.click(screen.getByRole('button', { name: 'Apply selection' }));
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({
      filters: expect.objectContaining({ area: null, period: null }),
      rowConditions: expect.arrayContaining([
        { column: 'area', operator: 'in', values: ['France'] },
        { column: 'value', operator: 'range', min: '10', max: '20', numeric: true },
      ]),
    })
  );
});
it('validates a one-sided quick period before committing, preserving filters on provider failure', async () => {
  await page.viewport(1280, 844);
  const apply = vi.fn();
  render(
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <DatasetExplorer
        request={request}
        title="Open period"
        onBack={() => undefined}
        onApply={apply}
      />
    </div>
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  await userEvent.fill(screen.getByRole('textbox', { name: 'From year' }), '2024');
  await userEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  await waitFor(() =>
    expect(vi.mocked(loadDatasetPreview).mock.calls.at(-1)?.[0].filters?.period).toEqual({
      start: 2024,
      end: 2199,
    })
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled()
  );
  await userEvent.fill(screen.getByRole('textbox', { name: 'Area' }), 'Unknown');
  vi.mocked(loadDatasetPreview).mockRejectedValueOnce(new Error('Area unavailable'));
  await userEvent.click(screen.getByRole('button', { name: 'Apply quick filters' }));
  await screen.findByRole('alert');
  await userEvent.click(screen.getByRole('button', { name: 'Apply selection' }));
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({
      filters: expect.objectContaining({ area: null, period: { start: 2024, end: 2199 } }),
    })
  );
});
