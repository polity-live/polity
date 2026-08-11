/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readOnly: false,
  selectionVisible: false,
  selected: true,
  collapsed: true,
  canMerge: true,
  canSplit: true,
  dragging: false,
  dropLine: null as null | 'top' | 'bottom',
  blockSelected: true,
  selectedCells: undefined as unknown[] | undefined,
  element: { id: 'element', type: 'tr' } as Record<string, unknown>,
  draggableOptions: [] as Record<string, any>[],
  setCellBackground: vi.fn(),
  focus: vi.fn(),
  select: vi.fn(),
  merge: vi.fn(),
  split: vi.fn(),
  insertRow: vi.fn(),
  removeRow: vi.fn(),
  insertColumn: vi.fn(),
  removeColumn: vi.fn(),
  borderSelect: vi.fn(),
  cell: {
    borders: {
      top: { size: 1 },
      right: { size: 1 },
      bottom: { size: 1 },
      left: { size: 1 },
    },
    colIndex: 0,
    colSpan: 1,
    minHeight: 40,
    rowIndex: 0,
    selected: true,
    width: 200,
  } as Record<string, any>,
  resizable: {
    bottomProps: { 'data-bottom': 'true' },
    hiddenLeft: false,
    leftProps: { 'data-left': 'true' },
    rightProps: { 'data-right': 'true' },
  } as Record<string, any>,
}));

vi.mock('@platejs/dnd', () => ({
  useDraggable: (options: Record<string, any>) => {
    mocks.draggableOptions.push(options);
    return { isDragging: mocks.dragging, previewRef: vi.fn(), handleRef: vi.fn() };
  },
  useDropLine: () => ({ dropLine: mocks.dropLine }),
}));
vi.mock('@platejs/selection/react', () => ({
  BlockSelectionPlugin: {},
  useBlockSelected: () => mocks.blockSelected,
}));
vi.mock('@platejs/table', () => ({ setCellBackground: mocks.setCellBackground }));
vi.mock('@platejs/table/react', () => ({
  TablePlugin: {},
  TableProvider: ({ children }: { children: ReactNode }) => children,
  useTableElement: () => ({ marginLeft: 12, props: { 'data-table-props': 'true' } }),
  useTableMergeState: () => ({ canMerge: mocks.canMerge, canSplit: mocks.canSplit }),
  useTableBordersDropdownMenuContentState: () => ({
    getOnSelectTableBorder: (side: string) => () => mocks.borderSelect(side),
    hasBottomBorder: true,
    hasLeftBorder: false,
    hasNoBorders: false,
    hasOuterBorders: true,
    hasRightBorder: true,
    hasTopBorder: false,
  }),
  useTableCellElement: () => mocks.cell,
  useTableCellElementResizable: () => mocks.resizable,
}));
vi.mock('platejs', () => ({
  KEYS: { tr: 'tr' },
  PathApi: {
    parent: (path: number[]) => path.slice(0, -1),
    equals: (left: number[], right: number[]) => JSON.stringify(left) === JSON.stringify(right),
  },
}));
vi.mock('platejs/react', () => ({
  withHOC: (_provider: unknown, Component: unknown) => Component,
  PlateElement: ({ as: Tag = 'div', children, attributes, ...props }: any) => {
    const safe = { ...props, ...attributes };
    delete safe.editor;
    delete safe.element;
    delete safe.nodeProps;
    return <Tag {...safe}>{children}</Tag>;
  },
  useReadOnly: () => mocks.readOnly,
  useSelected: () => mocks.selected,
  usePluginOption: (_plugin: unknown, key: string) =>
    key === 'isSelectionAreaVisible' ? mocks.selectionVisible : mocks.selectedCells,
  useEditorPlugin: () => ({
    tf: {
      table: { merge: mocks.merge, split: mocks.split },
      insert: { tableRow: mocks.insertRow, tableColumn: mocks.insertColumn },
      remove: { tableRow: mocks.removeRow, tableColumn: mocks.removeColumn },
    },
    api: { table: { getColSpan: () => 2, getRowSpan: () => 3 } },
  }),
  useEditorRef: () => ({ tf: { focus: mocks.focus, select: mocks.select } }),
  useEditorSelector: (selector: (editor: unknown) => unknown) =>
    selector({ api: { isCollapsed: () => mocks.collapsed } }),
  useElement: () => mocks.element,
  useRemoveNodeButton: () => ({ props: { onClick: vi.fn(), 'data-remove': 'true' } }),
  useComposedRef: (...refs: unknown[]) => refs[0],
  useElementSelector: (selector: (entry: [Record<string, unknown>]) => unknown) =>
    selector([{ id: 'row-id' }]),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children, onOpenChange }: any) => (
    <div>
      <button type="button" onClick={() => onOpenChange?.(true)}>
        open-menu
      </button>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children }: any) => children,
  DropdownMenuPortal: ({ children }: any) => children,
  DropdownMenuContent: ({ children, onCloseAutoFocus }: any) => (
    <div>
      <button type="button" onClick={() => onCloseAutoFocus?.({ preventDefault: vi.fn() })}>
        close-menu
      </button>
      {children}
    </div>
  ),
  DropdownMenuGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuCheckboxItem: ({ children, onCheckedChange }: any) => (
    <button type="button" onClick={() => onCheckedChange?.(true)}>
      {children}
    </button>
  ),
  DropdownMenuItem: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children, onOpenAutoFocus }: any) => (
    <div>
      <button type="button" onClick={() => onOpenAutoFocus?.({ preventDefault: vi.fn() })}>
        focus-toolbar
      </button>
      {children}
    </div>
  ),
}));
vi.mock('@radix-ui/react-popover', () => ({ PopoverAnchor: ({ children }: any) => children }));
vi.mock('@/features/shared/ui/layout', () => ({
  Toolbar: ({ children }: any) => <div>{children}</div>,
  ToolbarButton: ({ children, tooltip, ...props }: any) => (
    <button aria-label={tooltip} {...props}>
      {children}
    </button>
  ),
  ToolbarGroup: ({ children }: any) => <div>{children}</div>,
  ToolbarMenuGroup: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('./font-color-toolbar-button.tsx', () => ({}));
vi.mock('../font-color-toolbar-button.tsx', () => ({
  DEFAULT_COLORS: ['red'],
  ColorDropdownMenuItems: ({ updateColor }: { updateColor: (color: string) => void }) => (
    <button type="button" onClick={() => updateColor('red')}>
      choose-red
    </button>
  ),
}));
vi.mock('@/features/shared/ui/rich-text', () => ({
  ResizeHandle: (props: any) => <div {...props} />,
}));
vi.mock('../block-selection.tsx', () => ({ blockSelectionVariants: () => 'block-selected' }));
vi.mock('../table-icons.tsx', () => ({
  BorderAllIcon: () => null,
  BorderBottomIcon: () => null,
  BorderLeftIcon: () => null,
  BorderNoneIcon: () => null,
  BorderRightIcon: () => null,
  BorderTopIcon: () => null,
}));

import {
  TableCellElement,
  TableCellHeaderElement,
  TableElement,
  TableRowElement,
} from '../table-node';

const props = (element: Record<string, unknown>, children: ReactNode = <span>content</span>) =>
  ({ element, children, attributes: {}, editor: {} }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readOnly = false;
  mocks.selectionVisible = false;
  mocks.selected = true;
  mocks.collapsed = true;
  mocks.canMerge = true;
  mocks.canSplit = true;
  mocks.dragging = false;
  mocks.dropLine = null;
  mocks.blockSelected = true;
  mocks.selectedCells = undefined;
  mocks.element = { id: 'element', type: 'tr' };
  mocks.draggableOptions = [];
  mocks.cell = {
    borders: {
      top: { size: 1 },
      right: { size: 1 },
      bottom: { size: 1 },
      left: { size: 1 },
    },
    colIndex: 0,
    colSpan: 1,
    minHeight: 40,
    rowIndex: 0,
    selected: true,
    width: 200,
  };
  mocks.resizable = {
    bottomProps: { 'data-bottom': 'true' },
    hiddenLeft: false,
    leftProps: { 'data-left': 'true' },
    rightProps: { 'data-right': 'true' },
  };
});

afterEach(cleanup);

describe('table node branch campaign A02', () => {
  it('renders read-only and interactive tables and dispatches every toolbar action', () => {
    mocks.readOnly = true;
    const view = render(<TableElement {...props({ id: 'table', type: 'table' })} />);
    expect(screen.getByText('content')).toBeTruthy();

    mocks.readOnly = false;
    view.rerender(<TableElement {...props({ id: 'table', type: 'table' })} />);
    for (const name of [
      'plateJs.toolbar.table.mergeCells',
      'plateJs.toolbar.table.splitCell',
      'plateJs.toolbar.table.insertRowBefore',
      'plateJs.toolbar.table.insertRowAfter',
      'plateJs.toolbar.table.deleteRow',
      'plateJs.toolbar.table.insertColumnBefore',
      'plateJs.toolbar.table.insertColumnAfter',
      'plateJs.toolbar.table.deleteColumn',
    ]) {
      const button = screen.getByRole('button', { name });
      fireEvent.mouseDown(button);
      fireEvent.click(button);
    }
    expect(mocks.merge).toHaveBeenCalled();
    expect(mocks.split).toHaveBeenCalled();
    expect(mocks.insertRow).toHaveBeenCalledWith({ before: true });
    expect(mocks.insertRow).toHaveBeenCalledWith();
    expect(mocks.removeRow).toHaveBeenCalled();
    expect(mocks.insertColumn).toHaveBeenCalledWith({ before: true });
    expect(mocks.insertColumn).toHaveBeenCalledWith();
    expect(mocks.removeColumn).toHaveBeenCalled();

    fireEvent.click(screen.getByText('choose-red'));
    fireEvent.click(screen.getByText('plateJs.toolbar.clear'));
    expect(mocks.setCellBackground).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ color: 'red', selectedCells: [] })
    );
    expect(mocks.setCellBackground).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ color: null, selectedCells: [] })
    );
    screen.getAllByText('close-menu').forEach(button => fireEvent.click(button));
    fireEvent.click(screen.getByText('focus-toolbar'));
    expect(mocks.focus).toHaveBeenCalled();
    screen.getAllByRole('button').forEach(button => {
      if (button.textContent?.startsWith('plateJs.toolbar.table.borders.')) fireEvent.click(button);
    });
    expect(mocks.borderSelect).toHaveBeenCalled();

    mocks.canMerge = false;
    mocks.canSplit = false;
    mocks.selected = false;
    mocks.collapsed = false;
    mocks.selectionVisible = true;
    mocks.selectedCells = [{ id: 'cell' }];
    view.rerender(<TableElement {...props({ id: 'table', type: 'table' })} />);
    expect(screen.queryByRole('button', { name: 'plateJs.toolbar.table.mergeCells' })).toBeNull();
  });

  it('covers row dragging, selection, controls, drop directions, and callbacks', () => {
    const view = render(<TableRowElement {...props({ id: 'row', type: 'tr' })} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mocks.select).toHaveBeenCalled();
    const options = mocks.draggableOptions.at(-1)!;
    expect(options.canDropNode({ dragEntry: [{}, [0, 1]], dropEntry: [{}, [0, 2]] })).toBe(true);
    expect(options.canDropNode({ dragEntry: [{}, [0, 1]], dropEntry: [{}, [1, 2]] })).toBe(false);
    options.onDropHandler(null, { dragItem: { element: { id: 'dragged' } } });
    options.onDropHandler(null, { dragItem: { element: null } });
    expect(mocks.select).toHaveBeenCalledWith({ id: 'dragged' });

    mocks.dropLine = 'top';
    mocks.dragging = true;
    view.rerender(<TableRowElement {...props({ id: 'row', type: 'tr' })} />);
    expect(document.querySelector('.-top-px')).toBeTruthy();
    mocks.dropLine = 'bottom';
    mocks.selected = false;
    view.rerender(<TableRowElement {...props({ id: 'row', type: 'tr' })} />);
    expect(document.querySelector('.-bottom-px')).toBeTruthy();
    mocks.readOnly = true;
    view.rerender(<TableRowElement {...props({ id: 'row', type: 'tr' })} />);
    expect(screen.queryByRole('button')).toBeNull();
    mocks.readOnly = false;
    mocks.selectionVisible = true;
    view.rerender(<TableRowElement {...props({ id: 'row', type: 'tr' })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('covers cell/header styling, borders, widths, resizing, and selection alternatives', () => {
    const cellElement = { id: 'cell', background: 'red' };
    const view = render(<TableCellElement {...props(cellElement)} />);
    expect(document.querySelector('td')).toBeTruthy();
    expect(document.querySelector('[data-resizer-left="true"]')).toBeTruthy();
    expect(document.querySelector('.block-selected')).toBeTruthy();

    mocks.cell = {
      borders: {},
      colIndex: 2,
      colSpan: 1,
      minHeight: 0,
      rowIndex: 1,
      selected: false,
      width: 0,
    };
    mocks.resizable = {
      bottomProps: {},
      hiddenLeft: false,
      leftProps: {},
      rightProps: {},
    };
    mocks.blockSelected = false;
    view.rerender(<TableCellHeaderElement {...props({ id: 'cell', background: null })} />);
    expect(document.querySelector('th')).toBeTruthy();
    expect(document.querySelector('[data-resizer-left]')).toBeNull();

    mocks.readOnly = true;
    view.rerender(<TableCellElement {...props({ id: 'cell' })} />);
    mocks.readOnly = false;
    mocks.selectionVisible = true;
    view.rerender(<TableCellElement {...props({ id: 'cell' })} />);
    expect(document.querySelector('[data-right="true"]')).toBeNull();
  });
});
