/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  focus: vi.fn(),
  insertTable: vi.fn(),
}));

vi.mock('@platejs/table/react', () => ({ TablePlugin: { key: 'table' } }));

vi.mock('platejs/react', () => ({
  useEditorPlugin: () => ({
    editor: { tf: { focus: mocks.focus } },
    tf: { insert: { table: mocks.insertTable } },
  }),
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ToolbarButton: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { TableToolbarButtonView } from '../TableToolbarButtonView';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TableToolbarButtonView table picker', () => {
  it('selects a size and inserts it with pointer, Enter, and Space semantics', () => {
    const tf = {
      insert: { tableRow: vi.fn(), tableColumn: vi.fn() },
      remove: { tableRow: vi.fn(), tableColumn: vi.fn(), table: vi.fn() },
      table: { merge: vi.fn(), split: vi.fn() },
    };
    const editor = { tf: { focus: mocks.focus } };
    const { container } = render(
      <TableToolbarButtonView
        props={{}}
        tableSelected
        editor={editor}
        tf={tf}
        t={(key: string) => key}
        open
        setOpen={vi.fn()}
        mergeState={{ canMerge: true, canSplit: true }}
      />
    );

    const picker = screen.getByRole('button', { name: /0 x 0/ });
    const gridCell = container.querySelector('.grid > div');
    fireEvent.mouseMove(gridCell!);
    expect(screen.getByText('1 x 1')).toBeTruthy();
    fireEvent.click(picker);
    fireEvent.keyDown(picker, { key: 'Enter' });
    fireEvent.keyDown(picker, { key: ' ' });
    fireEvent.keyDown(picker, { key: 'Escape' });

    expect(mocks.insertTable).toHaveBeenCalledTimes(3);
    expect(mocks.insertTable).toHaveBeenCalledWith({ colCount: 1, rowCount: 1 }, { select: true });
    expect(mocks.focus).toHaveBeenCalledTimes(3);
  });
});
