/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { forwardRef, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  readOnly: false,
  selectionVisible: false,
  isDragging: false,
  dropLine: null as null | 'left' | 'right',
  isOpen: false,
  element: { id: 'column', type: 'column', width: undefined as string | undefined },
  canDropNode: undefined as undefined | ((args: any) => boolean),
  setColumns: vi.fn(),
  removeClick: vi.fn(),
  handleRef: vi.fn(),
  previewRef: vi.fn(),
}));

vi.mock('@platejs/dnd', () => ({
  useDraggable: (options: { canDropNode: (args: any) => boolean }) => {
    state.canDropNode = options.canDropNode;
    return {
      isDragging: state.isDragging,
      previewRef: state.previewRef,
      handleRef: state.handleRef,
    };
  },
  useDropLine: () => ({ dropLine: state.dropLine }),
}));

vi.mock('@platejs/layout', () => ({
  setColumns: (...args: unknown[]) => state.setColumns(...args),
}));

vi.mock('@platejs/layout/react', () => ({
  useDebouncePopoverOpen: () => state.isOpen,
}));

vi.mock('@platejs/resizable', () => ({
  ResizableProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@platejs/selection/react', () => ({ BlockSelectionPlugin: { key: 'selection' } }));

vi.mock('@udecode/cn', () => ({
  useComposedRef:
    (...refs: (((node: HTMLElement | null) => void) | { current?: HTMLElement | null } | null)[]) =>
    (node: HTMLElement | null) => {
      for (const ref of refs) {
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }
    },
}));

vi.mock('lucide-react', () => ({
  GripHorizontal: ({ onClick }: { onClick?: (event: React.MouseEvent) => void }) => (
    <span data-icon="grip" onClick={onClick} />
  ),
  Trash2Icon: () => <span data-icon="trash" />,
}));

vi.mock('platejs', () => ({
  PathApi: {
    parent: (path: number[]) => path.slice(0, -1),
    equals: (left: number[], right: number[]) => JSON.stringify(left) === JSON.stringify(right),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('platejs/react', () => ({
  PlateElement: forwardRef(
    (
      { children, className, ...props }: { children: ReactNode; className?: string },
      ref: React.ForwardedRef<HTMLDivElement>
    ) => (
      <div {...props} className={className} ref={ref} data-plate-element>
        {children}
      </div>
    )
  ),
  useEditorRef: () => ({ id: 'editor' }),
  useElement: () => state.element,
  usePluginOption: () => state.selectionVisible,
  useReadOnly: () => state.readOnly,
  useRemoveNodeButton: () => ({ props: { onClick: state.removeClick } }),
  withHOC: (_Provider: unknown, Component: unknown) => Component,
}));

vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children, open }: { children: ReactNode; open: boolean }) => (
    <div data-popover-open={open}>{children}</div>
  ),
  PopoverAnchor: ({ children }: { children: ReactNode }) => <div data-anchor>{children}</div>,
  PopoverContent: ({
    children,
    onOpenAutoFocus,
  }: {
    children: ReactNode;
    onOpenAutoFocus: (event: { preventDefault: () => void }) => void;
  }) => (
    <div data-popover-content onFocus={() => onOpenAutoFocus({ preventDefault: vi.fn() })}>
      {children}
    </div>
  ),
}));

vi.mock('@/features/shared/ui/ui/separator.tsx', () => ({
  Separator: () => <hr />,
}));

vi.mock('@/features/shared/ui/ui/tooltip.tsx', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/features/shared/utils/utils.ts', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

import { ColumnElement, ColumnGroupElementView } from '../ColumnGroupElementView';

const TestColumnElement = ColumnElement as unknown as ComponentType<Record<string, unknown>>;

const columnProps = (overrides: Record<string, unknown> = {}) => ({
  children: <p>Column content</p>,
  element: state.element,
  ref: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.readOnly = false;
  state.selectionVisible = false;
  state.isDragging = false;
  state.dropLine = null;
  state.isOpen = false;
  state.element = { id: 'column', type: 'column', width: undefined };
  state.canDropNode = undefined;
});

afterEach(cleanup);

describe('ColumnGroupElementView branch contracts', () => {
  it('renders editable default-width columns, composes refs, and validates sibling drops', () => {
    const originalRef = vi.fn();
    const view = render(<TestColumnElement {...columnProps({ ref: originalRef })} />);
    const outer = view.container.firstElementChild as HTMLElement;
    expect(outer.style.width).toBe('100%');
    expect(state.handleRef).toHaveBeenCalled();
    expect(state.previewRef).toHaveBeenCalled();
    expect(originalRef).toHaveBeenCalled();
    expect(state.canDropNode?.({ dragEntry: [{}, [0, 0]], dropEntry: [{}, [0, 1]] })).toBe(true);
    expect(state.canDropNode?.({ dragEntry: [{}, [0, 0]], dropEntry: [{}, [1, 0]] })).toBe(false);
  });

  it('covers explicit width, dragging, read-only, and selection-area guards', () => {
    state.element = { id: 'column', type: 'column', width: '35%' };
    state.isDragging = true;
    const view = render(<TestColumnElement {...columnProps()} />);
    expect((view.container.firstElementChild as HTMLElement).style.width).toBe('35%');
    expect(view.container.querySelector('.opacity-50')).not.toBeNull();

    state.readOnly = true;
    view.rerender(<TestColumnElement {...columnProps()} />);
    expect(view.container.querySelector('[data-icon="grip"]')).toBeNull();

    state.readOnly = false;
    state.selectionVisible = true;
    view.rerender(<TestColumnElement {...columnProps()} />);
    expect(view.container.querySelector('[data-icon="grip"]')).toBeNull();
  });

  it('stops drag-handle pointer defaults and renders no, left, and right drop lines', () => {
    const view = render(<TestColumnElement {...columnProps()} />);
    const grip = view.container.querySelector('[data-icon="grip"]') as HTMLElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    grip.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    state.dropLine = 'left';
    view.rerender(<TestColumnElement {...columnProps()} />);
    expect(view.container.querySelector('.left-\\[-10\\.5px\\]')).not.toBeNull();

    state.dropLine = 'right';
    view.rerender(<TestColumnElement {...columnProps()} />);
    expect(view.container.querySelector('.right-\\[-11px\\]')).not.toBeNull();
  });

  it('renders read-only group content without a toolbar', () => {
    state.readOnly = true;
    const view = render(
      <ColumnGroupElementView
        props={{ children: <span>Group child</span>, element: state.element }}
      />
    );
    expect(view.getByText('Group child')).toBeDefined();
    expect(view.container.querySelector('[data-popover-content]')).toBeNull();
  });

  it('applies all five layouts, removal, popover focus, and both open states', () => {
    const view = render(
      <ColumnGroupElementView
        props={{ children: <span>Group child</span>, element: state.element }}
      />
    );
    const buttons = view.container.querySelectorAll('button');
    expect(buttons).toHaveLength(6);
    const expected = [
      ['50%', '50%'],
      ['33%', '33%', '33%'],
      ['70%', '30%'],
      ['30%', '70%'],
      ['25%', '50%', '25%'],
    ];
    expected.forEach((widths, index) => {
      fireEvent.click(buttons[index]);
      expect(state.setColumns).toHaveBeenNthCalledWith(
        index + 1,
        { id: 'editor' },
        {
          at: state.element,
          widths,
        }
      );
    });
    fireEvent.click(buttons[5]);
    expect(state.removeClick).toHaveBeenCalledOnce();
    fireEvent.focus(view.container.querySelector('[data-popover-content]') as HTMLElement);

    state.isOpen = true;
    view.rerender(
      <ColumnGroupElementView
        props={{ children: <span>Group child</span>, element: state.element }}
      />
    );
    expect(view.container.querySelector('[data-popover-open="true"]')).not.toBeNull();
  });
});
