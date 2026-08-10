/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DataTableView } from '../DataTableView';

const header = {
  column: { columnDef: { header: 'Header', meta: { headerClassName: 'header-meta' } } },
  getContext: () => ({}),
  id: 'header',
  isPlaceholder: false,
};
const table = {
  getCanNextPage: () => true,
  getCanPreviousPage: () => true,
  getHeaderGroups: () => [{ headers: [header], id: 'group' }],
  getPageCount: () => 2,
  nextPage: vi.fn(),
  previousPage: vi.fn(),
} as any;

const baseProps = {
  columnsLength: 1,
  filterPlaceholder: 'Filter',
  globalFilter: '',
  isLoading: false,
  loadingRows: [0],
  paginationEnabled: false,
  resolvedEmptyTitle: 'Empty',
  resolvedNextLabel: 'Next',
  resolvedPreviousLabel: 'Previous',
  rows: [] as any[],
  setGlobalFilter: vi.fn(),
  table,
};

describe('DataTableView branches', () => {
  it('renders loading rows with filter, toolbar, fallback placeholder, and standalone surface', () => {
    render(
      <DataTableView
        {...baseProps}
        filter={{} as any}
        isLoading
        surface="standalone"
        toolbar={<button>Tool</button>}
      />
    );
    expect(screen.getByPlaceholderText('Filter')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tool' })).toBeTruthy();
    expect(document.querySelector('[data-surface="standalone"]')?.className).toContain('bg-card');
  });

  it('renders a filter without a toolbar and placeholder headers', () => {
    const placeholderTable = {
      ...table,
      getHeaderGroups: () => [{ headers: [{ ...header, isPlaceholder: true }], id: 'group' }],
    } as any;
    render(
      <DataTableView
        {...baseProps}
        filter={{ placeholder: 'Only filter' } as any}
        table={placeholderTable}
      />
    );
    expect(screen.getByPlaceholderText('Only filter')).toBeTruthy();
  });

  it('renders selected rows with function metadata and pagination', () => {
    const row = {
      getIsSelected: () => true,
      getVisibleCells: () => [
        {
          column: { columnDef: { cell: 'Cell', meta: { cellClassName: 'cell-meta' } } },
          getContext: () => ({}),
          id: 'cell',
        },
      ],
      id: 'row',
      index: 1,
      original: { id: 'record' },
    };
    render(
      <DataTableView
        {...baseProps}
        getRowClassName={() => 'row-meta'}
        paginationEnabled
        rowTestId={(record: { id: string }) => `row-${record.id}`}
        rows={[row] as any}
      />
    );
    expect(screen.getByTestId('row-record').getAttribute('data-state')).toBe('selected');
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(table.previousPage).toHaveBeenCalled();
    expect(table.nextPage).toHaveBeenCalled();
  });

  it('renders empty description and action content', () => {
    render(
      <DataTableView
        {...baseProps}
        resolvedEmptyAction={<button>Create</button>}
        resolvedEmptyDescription="Nothing here"
      />
    );
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
  });
});
