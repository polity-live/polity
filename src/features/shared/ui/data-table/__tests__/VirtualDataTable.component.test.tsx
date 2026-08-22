// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  config: undefined as any,
  list: {
    items: [] as any[],
    rowsEmpty: true,
    spaceAfter: 0,
    spaceBefore: 0,
    total: 0,
  },
}));

vi.mock('@/features/shared/virtualization', () => ({
  usePolityZeroList: (config: unknown) => {
    mocks.config = config;
    return mocks.list;
  },
}));

vi.mock('@rocicorp/zero-virtual/react', () => ({
  rowAttributes: (index: number, key: string) => ({ 'data-row-key': key, 'data-row-index': index }),
}));

vi.mock('@tanstack/react-table', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-table')>();

  return {
    ...actual,
    flexRender: (renderer: any, context: unknown) =>
      typeof renderer === 'function' ? renderer(context) : renderer,
    useTable: ({ columns, data, getRowId }: any) => ({
      getHeaderGroups: () => [
        {
          headers: [
            { id: 'placeholder', isPlaceholder: true },
            {
              column: { columnDef: { header: columns[0]?.header ?? 'Header' } },
              getContext: () => ({ header: true }),
              id: 'header',
              isPlaceholder: false,
            },
          ],
          id: 'group',
        },
      ],
      getRowModel: () => ({
        rows: data
          .filter((row: any) => getRowId(row) !== 'missing')
          .map((row: any) => ({
            getVisibleCells: () =>
              columns.map((column: any, index: number) => ({
                column: { columnDef: column },
                getContext: () => ({ row }),
                id: `${getRowId(row)}-${index}`,
              })),
            id: getRowId(row),
          })),
      }),
    }),
  };
});

vi.mock('@/features/shared/ui/ui/skeleton', () => ({
  Skeleton: () => <span data-testid="skeleton" />,
}));

vi.mock('@/features/shared/ui/ui/table', () => ({
  Table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: any) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
}));

import { VirtualDataTable } from '../VirtualDataTable';

const columns = [
  {
    cell: ({ row }: any) => <span>{row.name}</span>,
    header: () => <span>Name</span>,
  },
  { cell: 'Static cell', header: 'Static' },
] as any;

function source(overrides: Record<string, unknown> = {}) {
  return {
    context: { scope: 'all' },
    getPageQuery: vi.fn(),
    getRowKey: (row: any) => row.id,
    getSingleQuery: vi.fn(),
    historyKey: 'table-history',
    permalinkID: null,
    toStartRow: (row: any) => ({ id: row.id }),
    ...overrides,
  } as any;
}

describe('VirtualDataTable', () => {
  beforeEach(() => {
    mocks.list = {
      items: [],
      rowsEmpty: true,
      spaceAfter: 0,
      spaceBefore: 0,
      total: 0,
    };
  });
  afterEach(cleanup);

  it('renders the default empty table and initializes virtualization callbacks', () => {
    render(<VirtualDataTable columns={columns} source={source()} />);

    expect(screen.getByText('No results')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(document.querySelectorAll('th')[0].textContent).toBe('');
    expect(mocks.config.estimateSize()).toBe(68);
    expect(mocks.config.getScrollElement()).toBeTruthy();
    expect(mocks.config.overscan).toBe(10);
    expect(mocks.config.permalinkID).toBeUndefined();
    expect(document.querySelector('table')?.getAttribute('aria-rowcount')).toBeNull();
  });

  it('renders mapped rows, loading rows, spacers, and skips unmatched table rows', () => {
    mocks.list = {
      items: [
        { index: 0, key: 'loading', row: null },
        { index: 1, key: 'one', row: { id: 'one', name: 'Ada' } },
        { index: 2, key: 'missing', row: { id: 'missing', name: 'Missing' } },
      ],
      rowsEmpty: false,
      spaceAfter: 25,
      spaceBefore: 15,
      total: 3,
    };
    const mapRow = vi.fn((row: any) => ({ ...row, name: `${row.name} mapped` }));
    render(
      <VirtualDataTable
        columns={columns}
        source={source({ mapRow, permalinkID: 'one' })}
        estimateRowSize={80}
        overscan={4}
        emptyTitle="Nothing"
        className="wrapper"
        tableClassName="table"
        viewportClassName="viewport"
        rowTestId={(row: any) => `row-${row.id}`}
        getRowClassName={(row: any) => `class-${row.id}`}
      />
    );

    expect(screen.getByText('Ada mapped')).toBeTruthy();
    expect(screen.queryByText('Missing mapped')).toBeNull();
    expect(screen.getAllByTestId('skeleton')).toHaveLength(2);
    expect(screen.getByTestId('row-one').className).toContain('class-one');
    expect(document.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(2);
    expect(document.querySelector('table')?.getAttribute('aria-rowcount')).toBe('3');
    expect(mocks.config.estimateSize()).toBe(80);
    expect(mocks.config.overscan).toBe(4);
    expect(mocks.config.permalinkID).toBe('one');
  });

  it('renders raw rows with a static test id and no optional row class callback', () => {
    mocks.list = {
      items: [{ index: 0, key: 'raw', row: { id: 'raw', name: 'Raw row' } }],
      rowsEmpty: false,
      spaceAfter: 0,
      spaceBefore: 0,
      total: 1,
    };
    render(<VirtualDataTable columns={columns} source={source()} rowTestId="raw-row" />);
    expect(screen.getByTestId('raw-row')).toBeTruthy();
    expect(screen.getByText('Raw row')).toBeTruthy();
    expect(screen.getByText('Static cell')).toBeTruthy();
  });
});
