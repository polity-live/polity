// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/form/SearchField', () => ({
  SearchField: ({ value, onValueChange, ...props }: any) => (
    <input
      aria-label="search"
      value={value}
      onChange={event => onValueChange(event.target.value)}
      {...props}
    />
  ),
}));

vi.mock('@/features/shared/ui/status/StatusBadges', () => ({
  StatusBadge: ({ children, status, ...props }: any) => (
    <span data-status={status} {...props}>
      {children}
    </span>
  ),
}));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, loading: _loading, loadingLabel: _loadingLabel, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr data-testid="separator" />,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  ArrowDown: () => <i data-testid="sort-down" />,
  ArrowUp: () => <i data-testid="sort-up" />,
  ArrowUpDown: () => <i data-testid="sort-none" />,
  ChevronLeft: () => <i>left</i>,
  ChevronRight: () => <i>right</i>,
  MoreHorizontal: () => <i>more</i>,
}));

import {
  DataTablePagination,
  DataTableToolbar,
  DateCell,
  EntityCell,
  RowActions,
  SortableHeader,
  StatusCell,
  TableActionIconButton,
} from '../DataTableParts';

afterEach(cleanup);

describe('DataTableParts', () => {
  it.each([
    ['asc', 'sort-up', true],
    ['desc', 'sort-down', false],
    [false, 'sort-none', false],
  ] as const)('renders and toggles sort state %s', (sortState, icon, descending) => {
    const toggleSorting = vi.fn();
    render(
      <SortableHeader
        column={{ getIsSorted: () => sortState, toggleSorting } as any}
        className="header"
      >
        Name
      </SortableHeader>
    );
    expect(screen.getByTestId(icon)).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(toggleSorting).toHaveBeenCalledWith(descending);
  });

  it('renders searchable and placeholder toolbars with optional children', () => {
    const onSearchChange = vi.fn();
    const searchable = render(
      <DataTableToolbar
        searchValue="ada"
        onSearchChange={onSearchChange}
        searchPlaceholder="Find"
        className="toolbar"
      >
        <span>Filters</span>
      </DataTableToolbar>
    );
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'grace' } });
    expect(onSearchChange).toHaveBeenCalledWith('grace');
    expect(screen.getByPlaceholderText('Find')).toBeTruthy();
    expect(screen.getByText('Filters')).toBeTruthy();
    searchable.unmount();

    const noCallback = render(<DataTableToolbar searchValue="value" />);
    expect(screen.queryByLabelText('search')).toBeNull();
    noCallback.unmount();

    render(<DataTableToolbar onSearchChange={onSearchChange} />);
    expect(screen.queryByLabelText('search')).toBeNull();
  });

  it('forwards pagination availability and actions with default and custom labels', () => {
    const previousPage = vi.fn();
    const nextPage = vi.fn();
    const table = {
      getCanNextPage: () => true,
      getCanPreviousPage: () => false,
      nextPage,
      previousPage,
    } as any;
    const view = render(<DataTablePagination table={table} />);
    expect(screen.getByText('Previous').closest('button')?.disabled).toBe(true);
    fireEvent.click(screen.getByText('Next'));
    expect(nextPage).toHaveBeenCalledOnce();
    view.unmount();

    render(
      <DataTablePagination
        table={{ ...table, getCanNextPage: () => false, getCanPreviousPage: () => true }}
        previousLabel="Back"
        nextLabel="Forward"
      />
    );
    fireEvent.click(screen.getByText('Back'));
    expect(previousPage).toHaveBeenCalledOnce();
    expect(screen.getByText('Forward').closest('button')?.disabled).toBe(true);
  });

  it('renders row action separators, variants, disabled state, and labels', () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <RowActions
        label="Actions"
        className="actions"
        actions={[
          { label: 'Edit', onSelect: first },
          {
            destructive: true,
            disabled: true,
            label: 'Delete',
            onSelect: second,
            separatorBefore: true,
          },
        ]}
      />
    );
    fireEvent.click(screen.getByText('Edit'));
    expect(first).toHaveBeenCalledOnce();
    expect(screen.getByText('Delete').closest('button')?.getAttribute('variant')).toBe(
      'destructive'
    );
    expect(screen.getByText('Delete').closest('button')?.disabled).toBe(true);
    expect(screen.getByTestId('separator')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('uses the default row action label', () => {
    render(<RowActions actions={[]} />);
    expect(screen.getByText('Open row actions')).toBeTruthy();
  });

  it('covers icon-action labels, tooltips, wrapping, defaults, and destructive style', () => {
    const first = render(
      <TableActionIconButton
        label="Delete"
        icon={<i>trash</i>}
        destructive
        loading
        loadingLabel="Deleting"
      />
    );
    expect(screen.getByLabelText('Deleting')).toBeTruthy();
    expect(screen.getByText('Deleting')).toBeTruthy();
    expect(screen.getByLabelText('Deleting').parentElement?.className).toContain(
      'cursor-not-allowed'
    );
    first.unmount();

    const loadingTooltip = render(
      <TableActionIconButton label="Save" icon={<i>save</i>} loading tooltip="Saving details" />
    );
    expect(screen.getByLabelText('Save')).toBeTruthy();
    expect(screen.getByText('Saving details')).toBeTruthy();
    loadingTooltip.unmount();

    const loadingFallback = render(
      <TableActionIconButton label="Loading fallback" icon={<i>loading</i>} loading />
    );
    expect(screen.getByText('Loading fallback')).toBeTruthy();
    loadingFallback.unmount();

    const disabled = render(
      <TableActionIconButton label="Disabled" icon={<i>disabled</i>} disabled />
    );
    expect(screen.getByText('Disabled')).toBeTruthy();
    disabled.unmount();

    const active = render(
      <TableActionIconButton label="Active" icon={<i>active</i>} tooltip="Active tooltip" />
    );
    expect(screen.getByText('Active tooltip')).toBeTruthy();
    expect(screen.getByLabelText('Active').parentElement?.className).not.toContain(
      'cursor-not-allowed'
    );
    active.unmount();

    render(<TableActionIconButton label="Plain" icon={<i>plain</i>} />);
    expect(screen.getByText('Plain')).toBeTruthy();
  });

  it('renders every optional entity-cell section', () => {
    const complete = render(
      <EntityCell
        title="Ada"
        description="Mathematician"
        meta="London"
        leading={<i>avatar</i>}
        className="entity"
      />
    );
    expect(screen.getByText('Mathematician')).toBeTruthy();
    expect(screen.getByText('London')).toBeTruthy();
    expect(screen.getByText('avatar')).toBeTruthy();
    complete.unmount();

    render(<EntityCell title="Bare" />);
    expect(screen.getByText('Bare')).toBeTruthy();
    expect(screen.queryByText('Mathematician')).toBeNull();
  });

  it('renders empty, invalid, Date, and primitive date values', () => {
    const empty = render(<DateCell value={null} />);
    expect(screen.getByText('-')).toBeTruthy();
    empty.unmount();

    const invalid = render(<DateCell value="not-a-date" emptyLabel="Unknown" />);
    expect(screen.getByText('Unknown')).toBeTruthy();
    invalid.unmount();

    const date = render(
      <DateCell
        value={new Date('2025-01-02T12:00:00Z')}
        locale="en-US"
        format={{ year: 'numeric' }}
      />
    );
    expect(screen.getByText('2025')).toBeTruthy();
    date.unmount();

    render(<DateCell value="2025-01-02T12:00:00Z" locale="en-US" format={{ year: 'numeric' }} />);
    expect(screen.getByText('2025')).toBeTruthy();
  });

  it('forwards status cells', () => {
    render(
      <StatusCell status="active" className="status">
        Active
      </StatusCell>
    );
    expect(screen.getByText('Active').getAttribute('data-status')).toBe('active');
  });
});
