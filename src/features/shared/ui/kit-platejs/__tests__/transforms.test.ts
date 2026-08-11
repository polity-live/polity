import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertAudio: vi.fn(),
  insertCallout: vi.fn(),
  insertCode: vi.fn(),
  insertColumn: vi.fn(),
  insertDate: vi.fn(),
  insertEquation: vi.fn(),
  insertFile: vi.fn(),
  insertInlineEquation: vi.fn(),
  insertMedia: vi.fn(),
  insertToc: vi.fn(),
  insertVideo: vi.fn(),
  nextPath: vi.fn((path: number[]) => [...path.slice(0, -1), path.at(-1)! + 1]),
  toggleColumn: vi.fn(),
  triggerLink: vi.fn(),
}));

vi.mock('@platejs/callout', () => ({ insertCallout: mocks.insertCallout }));
vi.mock('@platejs/code-block', () => ({ insertCodeBlock: mocks.insertCode }));
vi.mock('@platejs/date', () => ({ insertDate: mocks.insertDate }));
vi.mock('@platejs/layout', () => ({
  insertColumnGroup: mocks.insertColumn,
  toggleColumnGroup: mocks.toggleColumn,
}));
vi.mock('@platejs/link/react', () => ({ triggerFloatingLink: mocks.triggerLink }));
vi.mock('@platejs/math', () => ({
  insertEquation: mocks.insertEquation,
  insertInlineEquation: mocks.insertInlineEquation,
}));
vi.mock('@platejs/media', () => ({
  insertAudioPlaceholder: mocks.insertAudio,
  insertFilePlaceholder: mocks.insertFile,
  insertMedia: mocks.insertMedia,
  insertVideoPlaceholder: mocks.insertVideo,
}));
vi.mock('@platejs/suggestion/react', () => ({ SuggestionPlugin: { key: 'suggestion' } }));
vi.mock('@platejs/table/react', () => ({ TablePlugin: { key: 'table' } }));
vi.mock('@platejs/toc', () => ({ insertToc: mocks.insertToc }));

vi.mock('platejs', () => ({
  KEYS: {
    audio: 'audio',
    callout: 'callout',
    codeBlock: 'code_block',
    date: 'date',
    equation: 'equation',
    file: 'file',
    img: 'img',
    inlineEquation: 'inline_equation',
    link: 'link',
    listTodo: 'todo',
    listType: 'listStyleType',
    mediaEmbed: 'media_embed',
    ol: 'decimal',
    table: 'table',
    toc: 'toc',
    ul: 'disc',
    video: 'video',
  },
  PathApi: { next: mocks.nextPath },
}));

import { getBlockType, insertBlock, insertInlineElement, setBlockType } from '../transforms';

function editor(overrides: Record<string, unknown> = {}) {
  const insertTable = vi.fn();
  const removeNodes = vi.fn();
  const setNodes = vi.fn();
  const unsetNodes = vi.fn();
  const insertNodes = vi.fn();
  const blocks = vi.fn((_options?: unknown): unknown[] => []);
  const node = vi.fn();
  const block = vi.fn((_options?: unknown): unknown => [{ type: 'paragraph', children: [] }, [2]]);
  const createBlock = vi.fn((props: unknown) => ({
    children: [{ text: '' }],
    ...(props as object),
  }));
  const withoutSuggestions = vi.fn((callback: () => void) => callback());

  const instance = {
    api: { block, blocks, create: { block: createBlock }, node },
    getApi: vi.fn(() => ({ suggestion: { withoutSuggestions } })),
    getTransforms: vi.fn(() => ({ insert: { table: insertTable } })),
    tf: {
      insertNodes,
      removeNodes,
      setNodes,
      unsetNodes,
      withoutNormalizing: (callback: () => void) => callback(),
    },
    ...overrides,
  } as any;

  return {
    block,
    blocks,
    createBlock,
    insertNodes,
    insertTable,
    instance,
    node,
    removeNodes,
    setNodes,
    unsetNodes,
    withoutSuggestions,
  };
}

describe('kit plate transforms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when no active block exists', () => {
    const current = editor();
    current.block.mockReturnValue(undefined);
    insertBlock(current.instance, 'paragraph');
    expect(current.insertNodes).not.toHaveBeenCalled();
  });

  it.each(['todo', 'decimal', 'disc'])('inserts list type %s', type => {
    const current = editor();
    insertBlock(current.instance, type);
    expect(current.createBlock).toHaveBeenCalledWith({ indent: 1, listStyleType: type });
    expect(current.insertNodes).toHaveBeenCalledWith(expect.any(Object), { select: true });
    expect(current.removeNodes).toHaveBeenCalledWith({ previousEmptyBlock: true });
  });

  it('invokes every registered block insertion', () => {
    const cases = [
      ['action_three_columns', mocks.insertColumn],
      ['audio', mocks.insertAudio],
      ['callout', mocks.insertCallout],
      ['code_block', mocks.insertCode],
      ['equation', mocks.insertEquation],
      ['file', mocks.insertFile],
      ['img', mocks.insertMedia],
      ['media_embed', mocks.insertMedia],
      ['toc', mocks.insertToc],
      ['video', mocks.insertVideo],
    ] as const;

    for (const [type, insertion] of cases) {
      const current = editor();
      insertBlock(current.instance, type);
      expect(insertion).toHaveBeenCalled();
    }

    const table = editor();
    insertBlock(table.instance, 'table');
    expect(table.insertTable).toHaveBeenCalledWith({}, { select: true });
    expect(mocks.insertMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ select: true, type: 'img' })
    );
    expect(mocks.insertMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ select: true, type: 'media_embed' })
    );
  });

  it('inserts an unregistered block after the current block and preserves matching blocks', () => {
    const current = editor();
    current.block.mockReturnValue([{ type: 'quote', children: [] }, [4]]);
    insertBlock(current.instance, 'quote');

    expect(mocks.nextPath).toHaveBeenCalledWith([4]);
    expect(current.insertNodes).toHaveBeenCalledWith(expect.objectContaining({ type: 'quote' }), {
      at: [5],
      select: true,
    });
    expect(current.removeNodes).not.toHaveBeenCalled();
  });

  it('invokes every registered inline insertion and ignores unknown types', () => {
    const current = editor();
    insertInlineElement(current.instance, 'date');
    insertInlineElement(current.instance, 'inline_equation');
    insertInlineElement(current.instance, 'link');
    insertInlineElement(current.instance, 'unknown');

    expect(mocks.insertDate).toHaveBeenCalledWith(current.instance, { select: true });
    expect(mocks.insertInlineEquation).toHaveBeenCalledWith(current.instance, '', { select: true });
    expect(mocks.triggerLink).toHaveBeenCalledWith(current.instance, { focused: true });
  });

  it('sets a direct path entry and returns without scanning blocks', () => {
    const current = editor();
    current.node.mockReturnValue([{ type: 'paragraph', children: [] }, [1]]);
    setBlockType(current.instance, 'heading', { at: [1] });
    expect(current.setNodes).toHaveBeenCalledWith({ type: 'heading' }, { at: [1] });
    expect(current.blocks).not.toHaveBeenCalled();
  });

  it('falls back to scanned blocks when a direct path is absent', () => {
    const current = editor();
    current.node.mockReturnValue(undefined);
    current.blocks.mockReturnValue([[{ type: 'heading', children: [] }, [3]]]);
    setBlockType(current.instance, 'heading', { at: [1] });
    expect(current.setNodes).not.toHaveBeenCalled();
    expect(current.blocks).toHaveBeenCalledWith({ mode: 'lowest' });
  });

  it('unsets list metadata and invokes every mapped block setter', () => {
    for (const type of ['todo', 'decimal', 'disc']) {
      const current = editor();
      current.blocks.mockReturnValue([
        [{ type: 'paragraph', listStyleType: 'disc', children: [] }, [2]],
      ]);
      setBlockType(current.instance, type);
      expect(current.unsetNodes).toHaveBeenCalledWith(['listStyleType', 'indent'], { at: [2] });
      expect(current.setNodes).toHaveBeenCalledWith(
        expect.objectContaining({ indent: 1, listStyleType: type }),
        { at: [2] }
      );
    }

    const columns = editor();
    columns.blocks.mockReturnValue([[{ type: 'paragraph', children: [] }, [0]]]);
    setBlockType(columns.instance, 'action_three_columns');
    expect(mocks.toggleColumn).toHaveBeenCalledWith(columns.instance, { columns: 3 });
  });

  it('normalizes ordered, todo, unordered, and ordinary block types', () => {
    expect(getBlockType({ listStyleType: 'decimal' } as any)).toBe('decimal');
    expect(getBlockType({ listStyleType: 'todo' } as any)).toBe('todo');
    expect(getBlockType({ listStyleType: 'square' } as any)).toBe('disc');
    expect(getBlockType({ type: 'paragraph' } as any)).toBe('paragraph');
  });
});
