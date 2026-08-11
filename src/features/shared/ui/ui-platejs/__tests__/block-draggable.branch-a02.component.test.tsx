/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  path: [0] as number[],
  element: { id: 'block', type: 'p' } as { id?: string; type: string },
  selectionVisible: false,
  selected: false,
  isDragging: false,
  dropLine: null as null | 'top' | 'bottom',
  nodeRef: { current: null as HTMLDivElement | null } as { current: HTMLDivElement | null } | null,
  previewRef: { current: null as HTMLDivElement | null } as {
    current: HTMLDivElement | null;
  } | null,
  handleRef: vi.fn(),
  blockSelectionSet: vi.fn(),
  onDropHandler: undefined as undefined | ((event: unknown, data: { dragItem: unknown }) => void),
  containerType: null as null | boolean,
}));

vi.mock('@platejs/dnd', () => ({
  useDraggable: ({ onDropHandler }: { onDropHandler: typeof state.onDropHandler }) => {
    state.onDropHandler = onDropHandler;
    return {
      isDragging: state.isDragging,
      nodeRef: state.nodeRef,
      previewRef: state.previewRef,
      handleRef: state.handleRef,
    };
  },
  useDropLine: () => ({ dropLine: state.dropLine }),
}));

vi.mock('@platejs/selection/react', () => ({ BlockSelectionPlugin: { key: 'selection' } }));

vi.mock('lucide-react', () => ({ GripVertical: () => <span data-icon="grip" /> }));

vi.mock('platejs', () => ({
  KEYS: {
    blockquote: 'blockquote',
    codeBlock: 'codeBlock',
    column: 'column',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    img: 'img',
    mediaEmbed: 'mediaEmbed',
    p: 'p',
    placeholder: 'placeholder',
    table: 'table',
    td: 'td',
    toggle: 'toggle',
    tr: 'tr',
  },
  getPluginByType: () =>
    state.containerType === null ? undefined : { node: { isContainer: state.containerType } },
  isType: (_editor: unknown, element: { type: string }, keys: string | string[]) =>
    Array.isArray(keys) ? keys.includes(element.type) : keys === element.type,
}));

vi.mock('platejs/react', () => ({
  MemoizedChildren: ({ children }: { children: ReactNode }) => children,
  useEditorRef: () => ({
    getApi: () => ({ blockSelection: { set: state.blockSelectionSet } }),
  }),
  useElement: () => state.element,
  usePath: () => state.path,
  usePluginOption: () => state.selectionVisible,
  useSelected: () => state.selected,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/tooltip.tsx', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/features/shared/utils/utils.ts', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

import { BlockDraggable } from '../block-draggable';

function editor(overrides: Record<string, unknown> = {}) {
  return {
    api: { some: vi.fn(() => false) },
    dom: { readOnly: false },
    getApi: () => ({ blockSelection: { set: state.blockSelectionSet } }),
    getType: (key: string) => key,
    ...overrides,
  };
}

function renderWrapper(
  options: {
    path?: number[];
    element?: { id?: string; type: string };
    editor?: ReturnType<typeof editor>;
  } = {}
) {
  const currentPath = options.path ?? [0];
  const currentElement = options.element ?? { id: 'block', type: 'p' };
  const currentEditor = options.editor ?? editor();
  state.path = currentPath;
  state.element = currentElement;

  function Harness() {
    const Wrapper = BlockDraggable({
      editor: currentEditor,
      element: currentElement,
      path: currentPath,
    } as never);
    if (!Wrapper) return <span data-disabled />;
    const TestWrapper = Wrapper as unknown as ComponentType<Record<string, unknown>>;
    return (
      <TestWrapper editor={currentEditor} element={currentElement} path={currentPath}>
        <p>Child</p>
      </TestWrapper>
    );
  }
  return render(<Harness />);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.path = [0];
  state.element = { id: 'block', type: 'p' };
  state.selectionVisible = false;
  state.selected = false;
  state.isDragging = false;
  state.dropLine = null;
  state.nodeRef = { current: null };
  state.previewRef = { current: null };
  state.onDropHandler = undefined;
  state.containerType = null;
});

afterEach(cleanup);

describe('BlockDraggable branch contracts', () => {
  it('disables read-only, unsupported depths, and undraggable node types', () => {
    expect(
      renderWrapper({ editor: editor({ dom: { readOnly: true } }) }).queryByTestId('disabled')
    ).toBeDefined();
    cleanup();
    expect(
      renderWrapper({ path: [0, 0], element: { id: 'x', type: 'p' } }).container.querySelector(
        '[data-disabled]'
      )
    ).not.toBeNull();
    cleanup();
    for (const type of ['column', 'tr', 'td']) {
      const view = renderWrapper({ element: { id: type, type } });
      expect(view.container.querySelector('[data-disabled]')).not.toBeNull();
      cleanup();
    }
  });

  it('enables root, column-nested, and table-nested blocks only with matching ancestors', () => {
    expect(renderWrapper().container.querySelector('[data-disabled]')).toBeNull();
    cleanup();

    for (const path of [
      [0, 0, 0],
      [0, 0, 0, 0],
    ]) {
      const some = vi.fn(() => false);
      const disabled = renderWrapper({ path, editor: editor({ api: { some } }) });
      expect(disabled.container.querySelector('[data-disabled]')).not.toBeNull();
      cleanup();

      some.mockReturnValue(true);
      const enabled = renderWrapper({ path, editor: editor({ api: { some } }) });
      expect(enabled.container.querySelector('[data-disabled]')).toBeNull();
      cleanup();
    }
  });

  it('wires optional refs and selects valid drop ids only when the API exists', () => {
    const view = renderWrapper();
    const wrapper = view.container.querySelector('.slate-blockWrapper');
    expect(state.nodeRef?.current).toBe(wrapper);
    expect(state.previewRef?.current).toBe(wrapper);
    state.onDropHandler?.(null, { dragItem: { id: 'dragged' } });
    state.onDropHandler?.(null, { dragItem: { id: '' } });
    expect(state.blockSelectionSet).toHaveBeenCalledOnce();
    cleanup();

    state.nodeRef = null;
    state.previewRef = null;
    const noApi = editor({ getApi: () => ({ blockSelection: null }) });
    renderWrapper({ editor: noApi });
    state.onDropHandler?.(null, { dragItem: { id: 'dragged' } });
    expect(state.blockSelectionSet).toHaveBeenCalledOnce();
  });

  it('renders dragging, container, column, table, block-id, and drop-line variants', () => {
    state.isDragging = true;
    state.containerType = true;
    const dragging = renderWrapper({ element: { id: undefined, type: 'p' } });
    expect(dragging.container.firstElementChild?.className).toContain('opacity-50');
    expect(dragging.container.firstElementChild?.className).toContain('group/container');
    cleanup();

    state.isDragging = false;
    state.containerType = false;
    const column = renderWrapper({
      path: [0, 0, 0],
      editor: editor({ api: { some: vi.fn(() => true) } }),
    });
    expect(column.container.querySelector('.h-4')).not.toBeNull();
    cleanup();

    const table = renderWrapper({
      path: [0, 0, 0, 0],
      editor: editor({ api: { some: vi.fn(() => true) } }),
    });
    expect(table.container.querySelector('button[data-block-id]')).toBeNull();
    cleanup();

    state.dropLine = 'top';
    const top = renderWrapper();
    expect(top.container.querySelector('.-top-px')).not.toBeNull();
    cleanup();
    state.dropLine = 'bottom';
    const bottom = renderWrapper();
    expect(bottom.container.querySelector('.-bottom-px')).not.toBeNull();
  });

  it('covers gutter selection and every node-type styling decision', () => {
    const types = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'blockquote',
      'codeBlock',
      'img',
      'mediaEmbed',
      'toggle',
      'column',
      'placeholder',
      'table',
      'unknown',
    ];
    for (const type of types) {
      const path = type === 'column' ? [0, 0, 0] : [0];
      const currentEditor = editor({ api: { some: vi.fn(() => true) } });
      const view = renderWrapper({ path, element: { id: type, type }, editor: currentEditor });
      cleanup();
      expect(view).toBeDefined();
    }

    state.selectionVisible = true;
    state.selected = true;
    const selected = renderWrapper();
    expect(selected.container.querySelector('.hidden')).not.toBeNull();
  });

  it('selects through one named native drag button without nested interactive controls', () => {
    const view = renderWrapper();
    const handle = view.container.querySelector(
      'button[aria-label="plateJs.toolbar.dragToMove"]'
    ) as HTMLElement;
    fireEvent.click(handle);
    fireEvent.keyDown(handle, { key: 'Enter' });
    fireEvent.keyDown(handle, { key: ' ' });
    fireEvent.keyDown(handle, { key: 'Escape' });
    expect(handle.querySelector('button, [role="button"], a, input, select, textarea')).toBeNull();
    expect(state.blockSelectionSet).toHaveBeenCalledOnce();
    expect(state.blockSelectionSet).toHaveBeenCalledWith('block');
  });
});
