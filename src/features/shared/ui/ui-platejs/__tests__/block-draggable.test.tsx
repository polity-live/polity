/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BlockDraggable } from '../block-draggable';

const mocks = vi.hoisted(() => ({
  blockSelectionSet: vi.fn(),
  currentElement: { children: [{ text: 'Move me' }], id: 'block-1', type: 'p' },
  handleRef: vi.fn(),
  nodeRef: { current: null as HTMLDivElement | null },
  previewRef: { current: null as HTMLDivElement | null },
  useDraggable: vi.fn(),
  useDropLine: vi.fn(),
}));

vi.mock('@platejs/dnd', () => ({
  useDraggable: mocks.useDraggable,
  useDropLine: mocks.useDropLine,
}));

vi.mock('@platejs/selection/react', () => ({
  BlockSelectionPlugin: { key: 'blockSelection' },
}));

vi.mock('lucide-react', () => ({
  GripVertical: () => <svg aria-hidden="true" />,
}));

vi.mock('platejs', () => ({
  KEYS: {
    blockquote: 'blockquote',
    codeBlock: 'code_block',
    column: 'column',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    img: 'img',
    mediaEmbed: 'media_embed',
    p: 'p',
    placeholder: 'placeholder',
    table: 'table',
    td: 'td',
    toggle: 'toggle',
    tr: 'tr',
  },
  getPluginByType: () => ({ node: { isContainer: false } }),
  isType: (_editor: unknown, element: { type?: string }, keys: string[] | string) =>
    Array.isArray(keys) ? keys.includes(element.type ?? '') : element.type === keys,
}));

vi.mock('platejs/react', () => ({
  MemoizedChildren: ({ children }: { children: React.ReactNode }) => children,
  useEditorRef: () => ({
    getApi: () => ({
      blockSelection: {
        set: mocks.blockSelectionSet,
      },
    }),
  }),
  useElement: () => mocks.currentElement,
  usePath: () => [0],
  usePluginOption: () => false,
  useSelected: () => false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('BlockDraggable', () => {
  const editor = {
    api: {
      some: vi.fn(),
    },
    dom: {
      readOnly: false,
    },
    getApi: () => ({
      blockSelection: {
        set: mocks.blockSelectionSet,
      },
    }),
    getType: (key: string) => key,
  };

  function renderBlockDraggable() {
    const element = mocks.currentElement;

    function Harness() {
      const Wrapper = BlockDraggable({
        editor,
        element,
        path: [0],
      } as any);

      if (!Wrapper) return null;

      return (
        <Wrapper editor={editor as any} element={element as any} path={[0] as any}>
          <p>Move me</p>
        </Wrapper>
      );
    }

    return render(<Harness />);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nodeRef.current = null;
    mocks.previewRef.current = null;
    mocks.useDraggable.mockReturnValue({
      handleRef: mocks.handleRef,
      isDragging: false,
      nodeRef: mocks.nodeRef,
      previewRef: mocks.previewRef,
    });
    mocks.useDropLine.mockReturnValue({ dropLine: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('wires drag handle and block wrapper refs for Plate DnD', () => {
    const { container } = renderBlockDraggable();

    const handle = container.querySelector('button[data-block-id="block-1"]');
    const blockWrapper = container.querySelector('.slate-blockWrapper');

    expect(handle).toBeInstanceOf(HTMLButtonElement);
    expect(mocks.handleRef).toHaveBeenCalledWith(handle);
    expect(blockWrapper).toBeInstanceOf(HTMLDivElement);
    expect(mocks.nodeRef.current).toBe(blockWrapper);
    expect(mocks.previewRef.current).toBe(blockWrapper);
  });
});
