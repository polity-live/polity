/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  selected: false,
  collapsed: false,
  readOnly: false,
  element: { id: 'equation-id', type: 'equation', texExpression: '' },
  editor: {
    tf: { select: vi.fn() },
    getApi: vi.fn(() => ({ blockSelection: { set: vi.fn() } })),
  },
}));

const math = vi.hoisted(() => ({
  useEquationElement: vi.fn(),
  useEquationInput: vi.fn(),
}));

vi.mock('react-textarea-autosize', () => ({
  default: (props: Record<string, unknown>) => <textarea {...props} />,
}));

vi.mock('@platejs/math/react', () => ({
  useEquationElement: math.useEquationElement,
  useEquationInput: math.useEquationInput,
}));

vi.mock('@platejs/selection/react', () => ({
  BlockSelectionPlugin: { key: 'block-selection' },
}));

vi.mock('lucide-react', () => ({
  CornerDownLeftIcon: () => <span>return-icon</span>,
  RadicalIcon: () => <span>radical-icon</span>,
}));

vi.mock('platejs/react', () => ({
  createPrimitiveComponent:
    (_component: unknown) =>
    (_options: unknown) =>
    ({ state: inputState, ...props }: Record<string, unknown>) => (
      <textarea data-testid="equation-input" data-state={JSON.stringify(inputState)} {...props} />
    ),
  PlateElement: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  useEditorRef: () => state.editor,
  useEditorSelector: (selector: (editor: { api: { isCollapsed: () => boolean } }) => unknown) =>
    selector({ api: { isCollapsed: () => state.collapsed } }),
  useElement: () => state.element,
  useReadOnly: () => state.readOnly,
  useSelected: () => state.selected,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="popover" data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(!open)}>
        toggle
      </button>
      {children}
    </div>
  ),
  PopoverContent: ({
    children,
    onEscapeKeyDown,
  }: {
    children: ReactNode;
    onEscapeKeyDown?: (event: { preventDefault: () => void }) => void;
  }) => (
    <div
      data-testid="popover-content"
      onKeyDown={event => {
        if (event.key === 'Escape') onEscapeKeyDown?.(event);
      }}
    >
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { EquationElement, InlineEquationElement } from '../equation-node';

function props(texExpression: string) {
  const element = { id: 'equation-id', type: 'equation', texExpression };
  state.element = element;
  return { element, editor: {}, attributes: {} } as unknown as ComponentProps<
    typeof EquationElement
  >;
}

describe('equation nodes', () => {
  beforeEach(() => {
    state.selected = false;
    state.collapsed = false;
    state.readOnly = false;
    state.editor.tf.select.mockReset();
    state.editor.getApi.mockClear();
    math.useEquationElement.mockClear();
  });

  afterEach(cleanup);

  it('renders empty and populated block equations and closes through block selection', () => {
    const { rerender } = render(<EquationElement {...props('')}>block-child</EquationElement>);
    expect(screen.getByText('plateJs.equation.addTex')).not.toBeNull();
    expect(screen.getByTestId('popover').getAttribute('data-open')).toBe('false');
    fireEvent.click(screen.getByText('toggle'));

    state.selected = true;
    rerender(<EquationElement {...props('x + y')}>block-child</EquationElement>);
    expect(screen.queryByText('plateJs.equation.addTex')).toBeNull();
    expect(screen.getByTestId('popover').getAttribute('data-open')).toBe('true');
    fireEvent.keyDown(screen.getByTestId('popover-content'), { key: 'Escape' });
    fireEvent.click(screen.getByText('plateJs.equation.done'));

    expect(state.editor.getApi).toHaveBeenCalled();
    expect(math.useEquationElement).toHaveBeenCalledWith(
      expect.objectContaining({ element: expect.objectContaining({ texExpression: 'x + y' }) })
    );
  });

  it('opens a selected collapsed inline equation and focuses the next position on close', () => {
    state.selected = true;
    state.collapsed = true;
    const { rerender } = render(
      <InlineEquationElement {...props('x')}>inline-child</InlineEquationElement>
    );

    expect(screen.getByTestId('popover').getAttribute('data-open')).toBe('true');
    fireEvent.click(screen.getByText('plateJs.equation.done'));
    expect(state.editor.tf.select).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'equation-id' }),
      { focus: true, next: true }
    );

    state.selected = false;
    state.collapsed = false;
    rerender(<InlineEquationElement {...props('')}>inline-child</InlineEquationElement>);
    expect(screen.getByText('plateJs.equation.newEquation')).not.toBeNull();
    expect(screen.getByTestId('popover').getAttribute('data-open')).toBe('false');
  });

  it('covers selected expanded and unselected collapsed inline visual states', () => {
    state.selected = true;
    state.collapsed = false;
    const { rerender, container } = render(
      <InlineEquationElement {...props('x')}>inline-child</InlineEquationElement>
    );
    expect(container.querySelector('[class*="after:bg-brand/15"]')).not.toBeNull();

    state.selected = false;
    state.collapsed = true;
    rerender(<InlineEquationElement {...props('x')}>inline-child</InlineEquationElement>);
    expect(screen.getByTestId('popover').getAttribute('data-open')).toBe('false');
  });

  it('omits popover controls in read-only mode', () => {
    state.readOnly = true;
    render(<EquationElement {...props('x')}>read-only-child</EquationElement>);

    expect(screen.queryByTestId('popover-content')).toBeNull();
    expect(screen.queryByText('plateJs.equation.done')).toBeNull();
  });
});
