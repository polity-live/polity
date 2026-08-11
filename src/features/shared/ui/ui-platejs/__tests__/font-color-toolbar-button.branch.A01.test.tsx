/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CSSProperties, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  attachInputRef: true,
  selectionDefinedOverride: undefined as boolean | undefined,
  editor: {
    selection: { anchor: 0 } as object | null,
    mark: '#123456' as string | undefined,
    api: { mark: vi.fn() },
    tf: {
      select: vi.fn(),
      focus: vi.fn(),
      addMarks: vi.fn(),
      removeMarks: vi.fn(),
    },
  },
}));

vi.mock('lodash/debounce', () => ({
  default: (callback: (value: string) => void) => callback,
}));

vi.mock('@udecode/cn', () => ({
  useComposedRef:
    (...refs: unknown[]) =>
    (node: HTMLInputElement | null) => {
      if (!state.attachInputRef) return;
      for (const ref of refs) {
        if (typeof ref === 'function') ref(node);
        else if (ref && typeof ref === 'object' && 'current' in ref) {
          (ref as { current: HTMLInputElement | null }).current = node;
        }
      }
    },
}));

vi.mock('platejs/react', () => ({
  useEditorRef: () => state.editor,
  useEditorSelector: (selector: (editor: typeof state.editor) => unknown) => {
    const value = selector(state.editor);
    return typeof value === 'boolean' && state.selectionDefinedOverride !== undefined
      ? state.selectionDefinedOverride
      : value;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('lucide-react', () => ({
  EraserIcon: () => <span>eraser</span>,
  PlusIcon: () => <span>plus</span>,
}));

vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  buttonVariants: ({ size, variant }: { size: string; variant: string }) => `${size}-${variant}`,
}));

vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="menu" data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(!open)}>
        menu-toggle
      </button>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    className,
    onClick,
    onSelect,
    style,
  }: {
    children?: ReactNode;
    className?: string;
    onClick?: () => void;
    onSelect?: (event: { preventDefault: () => void }) => void;
    style?: CSSProperties;
  }) => (
    <button
      type="button"
      className={className}
      data-color={style?.backgroundColor}
      style={style}
      onClick={() => {
        onSelect?.({ preventDefault: vi.fn() });
        onClick?.();
      }}
    >
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/ui/tooltip.tsx', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ToolbarButton: ({
    children,
    pressed,
    tooltip,
  }: {
    children: ReactNode;
    pressed: boolean;
    tooltip?: string;
  }) => (
    <button type="button" data-testid="toolbar-button" data-pressed={String(pressed)}>
      {tooltip}:{children}
    </button>
  ),
  ToolbarMenuGroup: ({ children, label }: { children: ReactNode; label?: string }) => (
    <section aria-label={label}>{children}</section>
  ),
}));

import {
  ColorDropdownMenuItems,
  DEFAULT_COLORS,
  FontColorToolbarButton,
} from '../font-color-toolbar-button';

describe('font color toolbar', () => {
  beforeEach(() => {
    state.editor.selection = { anchor: 0 };
    state.editor.mark = '#123456';
    state.attachInputRef = true;
    state.selectionDefinedOverride = undefined;
    state.editor.api.mark.mockImplementation(() => state.editor.mark);
    for (const mock of Object.values(state.editor.tf)) mock.mockReset();
  });

  afterEach(cleanup);

  it('applies default and custom colors, toggles the menu, and clears an active mark', () => {
    const { container } = render(
      <FontColorToolbarButton nodeType="color" tooltip="Font color">
        palette
      </FontColorToolbarButton>
    );

    expect(screen.getByTestId('menu').getAttribute('data-open')).toBe('false');
    expect(screen.getByText('plateJs.toolbar.custom')).not.toBeNull();
    expect(container.querySelector('[data-color="#123456"]')).not.toBeNull();

    fireEvent.click(screen.getByText('menu-toggle'));
    expect(screen.getByTestId('menu').getAttribute('data-open')).toBe('true');

    fireEvent.click(container.querySelector('[data-color="#000000"]') as Element);
    expect(state.editor.tf.select).toHaveBeenCalledWith(state.editor.selection);
    expect(state.editor.tf.focus).toHaveBeenCalled();
    expect(state.editor.tf.addMarks).toHaveBeenCalledWith({ color: '#000000' });
    // ColorPicker intentionally memoizes by color arrays, so its update callback keeps
    // the render-time toggle state until the picker inputs change.
    expect(screen.getByTestId('menu').getAttribute('data-open')).toBe('true');

    const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: '#abcdef' } });
    expect(state.editor.tf.addMarks).toHaveBeenCalledWith({ color: '#abcdef' });
    fireEvent.click(screen.getByText('plus'));

    fireEvent.click(screen.getByText('plateJs.toolbar.clear'));
    expect(state.editor.tf.removeMarks).toHaveBeenCalledWith('color');
  });

  it('does not mutate marks without a selection and omits the clear action without a color', () => {
    state.editor.selection = null;
    state.editor.mark = '#123456';
    const first = render(
      <FontColorToolbarButton nodeType="backgroundColor">palette</FontColorToolbarButton>
    );

    fireEvent.click(first.container.querySelector('[data-color="#000000"]') as Element);
    expect(state.editor.tf.addMarks).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('plateJs.toolbar.clear'));
    expect(state.editor.tf.removeMarks).not.toHaveBeenCalled();
    cleanup();

    state.editor.mark = undefined;
    render(<FontColorToolbarButton nodeType="backgroundColor">palette</FontColorToolbarButton>);
    expect(screen.queryByText('plateJs.toolbar.clear')).toBeNull();
  });

  it('keeps an existing mark when selection tracking is unavailable and the input ref is absent', () => {
    state.selectionDefinedOverride = false;
    state.attachInputRef = false;
    const { container } = render(
      <FontColorToolbarButton nodeType="color">palette</FontColorToolbarButton>
    );

    fireEvent.click(screen.getByText('plateJs.toolbar.clear'));
    fireEvent.click(screen.getByText('plus'));
    expect(state.editor.tf.removeMarks).not.toHaveBeenCalled();
    expect(container.querySelector('input[type="color"]')).not.toBeNull();
  });

  it('renders named, unnamed, bright, selected, and custom child swatches', () => {
    const updateColor = vi.fn();
    const { container } = render(
      <ColorDropdownMenuItems
        color="#ffffff"
        colors={[
          { isBrightColor: true, name: 'named', value: '#ffffff' },
          { isBrightColor: false, name: undefined as never, value: '#111111' },
        ]}
        updateColor={updateColor}
      >
        <span>custom-child</span>
      </ColorDropdownMenuItems>
    );

    fireEvent.click(container.querySelector('[data-color="#ffffff"]') as Element);
    fireEvent.click(container.querySelector('[data-color="#111111"]') as Element);
    expect(updateColor.mock.calls).toEqual([['#ffffff'], ['#111111']]);
    expect(screen.getByText('named')).not.toBeNull();
    expect(screen.getByText('custom-child')).not.toBeNull();
    expect(DEFAULT_COLORS).toHaveLength(80);
  });
});
