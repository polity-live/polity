/* @vitest-environment jsdom */

import * as React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@platejs/table', () => ({ BaseTablePlugin: { key: 'table' } }));
vi.mock('platejs/static', () => ({
  SlateElement: ({ as: Component = 'div', attributes, children, ...props }: any) =>
    React.createElement(Component, { ...attributes, ...props, 'data-testid': 'slate' }, children),
}));
vi.mock('@/features/shared/utils/utils.ts', () => ({
  cn: (...values: unknown[]) => values.flat(Infinity).filter(Boolean).join(' '),
}));

import {
  TableCellElementStatic,
  TableCellHeaderElementStatic,
  TableElementStatic,
  TableRowElementStatic,
} from '../table-node-static';

const StaticTable = TableElementStatic as React.ComponentType<any>;
const StaticTableRow = TableRowElementStatic as React.ComponentType<any>;
const StaticTableCell = TableCellElementStatic as React.ComponentType<any>;
const StaticTableHeaderCell = TableCellHeaderElementStatic as React.ComponentType<any>;

afterEach(() => cleanup());

function editor({
  borders = null as any,
  disableMarginLeft = false,
  minHeight = 33,
  width = 0,
} = {}) {
  return {
    getOptions: vi.fn(() => ({ disableMarginLeft })),
    getPlugin: vi.fn(() => ({
      api: {
        table: {
          getCellBorders: vi.fn(() => borders),
          getCellSize: vi.fn(() => ({ minHeight, width })),
          getColSpan: vi.fn(() => 2),
          getRowSpan: vi.fn(() => 3),
        },
      },
    })),
  } as any;
}

describe('static table elements', () => {
  it('renders configured and disabled table margins plus rows', () => {
    const configured = render(
      <StaticTable editor={editor()} element={{ marginLeft: 18 } as any} attributes={{} as any}>
        <tr>
          <td>cell</td>
        </tr>
      </StaticTable>
    );
    expect(screen.getByTestId('slate').style.paddingLeft).toBe('18px');
    expect(screen.getByRole('table')).toBeTruthy();
    configured.unmount();

    render(
      <StaticTable
        editor={editor({ disableMarginLeft: true })}
        element={{ marginLeft: 18 } as any}
        attributes={{} as any}
      >
        <tr>
          <td>content</td>
        </tr>
      </StaticTable>
    );
    expect(screen.getByTestId('slate').style.paddingLeft).toBe('0px');
    cleanup();

    render(
      <table>
        <tbody>
          <StaticTableRow editor={editor()} element={{} as any} attributes={{} as any}>
            <td>row</td>
          </StaticTableRow>
        </tbody>
      </table>
    );
    expect(screen.getByRole('row').textContent).toBe('row');
  });

  it('renders a default data cell without optional decorations', () => {
    const tableEditor = editor();
    render(
      <table>
        <tbody>
          <tr>
            <StaticTableCell
              editor={tableEditor}
              element={{ background: '' } as any}
              attributes={{ 'data-origin': 'attributes' } as any}
            >
              default cell
            </StaticTableCell>
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByRole('cell');
    expect(cell.className).toContain('bg-background');
    expect(cell.className).not.toContain('text-left');
    expect(cell.style.maxWidth).toBe('240px');
    expect(cell.style.minWidth).toBe('120px');
    expect(cell.getAttribute('colspan')).toBe('2');
    expect(cell.getAttribute('rowspan')).toBe('3');
    expect(cell.getAttribute('data-origin')).toBe('attributes');
    expect(cell.firstElementChild?.getAttribute('style')).toContain('min-height: 33px');
  });

  it('renders a header with every border and explicit width/background', () => {
    const borders = {
      bottom: { size: 1 },
      left: { size: 2 },
      right: { size: 3 },
      top: { size: 4 },
    };
    render(
      <table>
        <thead>
          <tr>
            <StaticTableHeaderCell
              editor={editor({ borders, width: 175 })}
              element={{ background: '#fff' } as any}
              attributes={{} as any}
            >
              header
            </StaticTableHeaderCell>
          </tr>
        </thead>
      </table>
    );

    const header = screen.getByRole('columnheader');
    expect(header.className).toContain('bg-(--cellBackground)');
    expect(header.className).toContain('text-left');
    expect(header.className).toContain('before:border-b');
    expect(header.className).toContain('before:border-r');
    expect(header.className).toContain('before:border-l');
    expect(header.className).toContain('before:border-t');
    expect(header.style.maxWidth).toBe('175px');
    expect(header.style.minWidth).toBe('175px');
  });

  it('ignores individual borders whose sizes are absent', () => {
    render(
      <table>
        <tbody>
          <tr>
            <StaticTableCell
              editor={editor({
                borders: { bottom: {}, left: undefined, right: null, top: { size: 0 } },
              })}
              element={{} as any}
              attributes={{} as any}
            >
              sparse borders
            </StaticTableCell>
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByRole('cell');
    expect(cell.className).not.toContain('before:border-b');
    expect(cell.className).not.toContain('before:border-r');
    expect(cell.className).not.toContain('before:border-l');
    expect(cell.className).not.toContain('before:border-t');
  });
});
