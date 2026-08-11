import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  config: null as any,
  mode: 'chat',
  options: null as any,
  streamInsertChunk: vi.fn(),
  withAIBatch: vi.fn((_editor: any, callback: () => void) => callback()),
}));

vi.mock('@platejs/ai', () => ({ withAIBatch: mocks.withAIBatch }));
vi.mock('@platejs/ai/react', () => ({
  AIChatPlugin: {
    extend: (config: any) => {
      mocks.config = config;
      return config;
    },
  },
  AIPlugin: { withComponent: () => ({}) },
  streamInsertChunk: mocks.streamInsertChunk,
  useChatChunk: (options: any) => {
    mocks.options = options;
  },
}));
vi.mock('platejs', () => ({
  KEYS: { aiChat: 'aiChat' },
  PathApi: { next: (path: number[]) => [...path, 1] },
}));
vi.mock('platejs/react', () => ({
  usePluginOption: () => mocks.mode,
}));
vi.mock('@/features/shared/ui/ui-platejs/ai-menu.tsx', () => ({
  AILoadingBar: () => null,
  AIMenu: () => null,
}));
vi.mock('@/features/shared/ui/ui-platejs/ai-node.tsx', () => ({
  AIAnchorElement: () => null,
  AILeaf: () => null,
}));
vi.mock('../cursor-overlay-kit.tsx', () => ({ CursorOverlayKit: [] }));
vi.mock('../markdown-kit.tsx', () => ({ MarkdownKit: [] }));

await import('../ai-kit');

function createEditor() {
  const editor = {
    selection: { focus: { path: [0, 0] } } as any,
    setOption: vi.fn(),
    tf: {
      insertNodes: vi.fn(),
      withScrolling: vi.fn((callback: () => void) => callback()),
      withoutSaving: vi.fn((callback: () => void) => callback()),
    },
  };
  return editor;
}

describe('ai chat plugin branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mode = 'chat';
  });

  function setup(mode: string, streaming: boolean, editor = createEditor()) {
    mocks.mode = mode;
    const getOption = vi.fn(() => streaming);
    mocks.config.useHooks({ editor, getOption });
    return { editor, getOption };
  }

  it('evaluates every chat insertion guard and rechecks selection', () => {
    let current = setup('other', false);
    mocks.options.onChunk({ chunk: 'x', isFirst: true, nodes: [] });

    current = setup('chat', false);
    mocks.options.onChunk({ chunk: 'x', isFirst: false, nodes: [] });

    current = setup('chat', true);
    mocks.options.onChunk({ chunk: 'x', isFirst: true, nodes: [] });

    current = setup('chat', false);
    current.editor.selection = null;
    mocks.options.onChunk({ chunk: 'x', isFirst: true, nodes: [] });

    current = setup('chat', false);
    mocks.options.onChunk({ chunk: 'x', isFirst: true, nodes: [] });
    expect(current.editor.tf.insertNodes).toHaveBeenCalled();
    expect(current.editor.setOption).toHaveBeenCalledWith(expect.anything(), 'streaming', true);

    current = setup('chat', false);
    current.editor.tf.withoutSaving.mockImplementationOnce(callback => {
      current.editor.selection = null;
      callback();
    });
    mocks.options.onChunk({ chunk: 'x', isFirst: true, nodes: [] });
  });

  it('evaluates insert mode, node, and streaming guards', () => {
    setup('other', true);
    mocks.options.onChunk({ chunk: 'x', isFirst: false, nodes: [{}] });
    setup('insert', true);
    mocks.options.onChunk({ chunk: 'x', isFirst: false, nodes: [] });

    setup('insert', false);
    mocks.options.onChunk({ chunk: 'x', isFirst: false, nodes: [{}] });

    const current = setup('insert', true);
    mocks.options.onChunk({ chunk: 'chunk', isFirst: true, nodes: [{}] });
    expect(mocks.streamInsertChunk).toHaveBeenCalledWith(
      current.editor,
      'chunk',
      expect.objectContaining({ textProps: { ai: true } })
    );
  });

  it('clears streaming state on finish', () => {
    const { editor } = setup('chat', false);
    mocks.options.onFinish();
    expect(editor.setOption).toHaveBeenCalledTimes(3);
  });
});
