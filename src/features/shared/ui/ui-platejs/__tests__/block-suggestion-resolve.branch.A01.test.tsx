/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  suggestionNodes: [] as [any, number[]][],
  allEntries: [] as [any, number[]][],
  discussions: [] as any[],
  uniquePathMap: new Map<string, number[]>(),
  currentMode: 'edit',
  documentId: undefined as string | undefined,
  currentDiscussions: [] as any[] | undefined,
  nodeAtPrevious: {} as Record<string, unknown>,
  parentAtPath: {} as Record<string, unknown>,
  setOption: vi.fn(),
  editorSetOption: vi.fn(),
  nextCrId: vi.fn(() => 'CR-next'),
  consoleError: vi.fn(),
}));

const KEYS = vi.hoisted(() => ({
  audio: 'audio',
  blockquote: 'blockquote',
  callout: 'callout',
  codeBlock: 'codeBlock',
  column: 'column',
  columnGroup: 'columnGroup',
  date: 'date',
  equation: 'equation',
  file: 'file',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  hr: 'hr',
  img: 'img',
  inlineEquation: 'inlineEquation',
  link: 'link',
  listTodo: 'todo',
  listType: 'listType',
  mediaEmbed: 'mediaEmbed',
  ol: 'ol',
  p: 'p',
  suggestion: 'suggestion',
  table: 'table',
  toc: 'toc',
  toggle: 'toggle',
  ul: 'ul',
  video: 'video',
}));

vi.mock('platejs', () => ({
  KEYS,
  ElementApi: { isElement: (node: { kind?: string }) => node?.kind === 'element' },
  TextApi: { isText: (node: { kind?: string }) => node?.kind === 'text' },
  PathApi: {
    equals: (left: number[], right: number[]) => JSON.stringify(left) === JSON.stringify(right),
    isChild: (left: number[], right: number[]) => left.length > right.length,
    isPath: (value: unknown) => Array.isArray(value),
  },
}));

vi.mock('@platejs/suggestion', () => ({
  acceptSuggestion: vi.fn(),
  rejectSuggestion: vi.fn(),
  getSuggestionKey: (id: string) => `suggestion_${id}`,
  keyId2SuggestionId: (id: string) => id.replace(/^suggestion_/, ''),
}));

vi.mock('@platejs/suggestion/react', () => ({ SuggestionPlugin: { key: 'suggestion' } }));
vi.mock('@/features/shared/ui/kit-platejs/discussion-kit.tsx', () => ({
  discussionPlugin: { key: 'discussion' },
}));
vi.mock('@/features/shared/ui/kit-platejs/suggestion-kit.tsx', () => ({
  suggestionPlugin: { key: 'suggestion' },
}));
vi.mock('@/features/shared/ui/kit-platejs/suggestion-callbacks-context.tsx', () => ({
  useSuggestionCallbacks: () => ({}),
}));
vi.mock('@/features/shared/ui/kit-platejs/mode-context.tsx', () => ({
  useModeContext: () => ({ currentMode: state.currentMode }),
}));

const suggestionApi = {
  dataList: (node: { dataList?: unknown[] }) => node.dataList ?? [],
  isBlockSuggestion: (node: { suggestion?: unknown }) => Boolean(node.suggestion),
  nodeId: (node: { nodeId?: string; suggestion?: { id?: string } }) =>
    node.nodeId ?? node.suggestion?.id,
  suggestionData: (node: { dataList?: unknown[]; suggestion?: unknown }) =>
    node.dataList?.[0] ?? node.suggestion,
  node: ({ id, at }: { id: string; at: number[] }) =>
    state.nodeAtPrevious[`${id}:${JSON.stringify(at)}`],
  withoutSuggestions: (callback: () => void) => callback(),
};

const editor = {
  api: {
    nodes: ({ match }: { match: (node: any) => boolean }) =>
      state.allEntries.filter(([node]) => match(node)),
  },
  getOption: (_plugin: unknown, key: string) =>
    key === 'documentId' ? state.documentId : state.currentDiscussions,
  setOption: (...args: unknown[]) => state.editorSetOption(...args),
};

vi.mock('platejs/react', () => ({
  usePluginOption: (_plugin: unknown, key: string) =>
    key === 'discussions' ? state.discussions : state.uniquePathMap,
  useEditorPlugin: () => ({
    api: {
      node: (path: number[]) => state.parentAtPath[JSON.stringify(path)],
      suggestion: suggestionApi,
    },
    editor,
    getOption: () => state.uniquePathMap,
    setOption: (...args: unknown[]) => state.setOption(...args),
  }),
}));

vi.mock('@/features/charts/types', () => ({ DATA_VIEW_NODE_TYPE: 'data_view' }));
vi.mock('@/features/change-requests/logic/suggestionBlockLabels', () => ({
  BLOCK_SUGGESTION_MARKER: '__block__',
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/utils/suggestion-utils.ts', () => ({
  getNextSuggestionIdFromDiscussions: () => state.nextCrId(),
}));
vi.mock('../comment.tsx', () => ({ Comment: () => null, CommentCreateForm: () => null }));

import { isResolvedSuggestion, useResolveSuggestion } from '../block-suggestion';

const path = [0];
const textNode = (
  id: string | undefined,
  type: string,
  text: string,
  overrides: Record<string, unknown> = {}
) => ({
  kind: 'text',
  text,
  nodeId: id,
  suggestion: true,
  ...(id ? { [`suggestion_${id}`]: true } : {}),
  dataList: id
    ? [
        {
          id,
          type,
          createdAt: 1_000,
          userId: 'author',
          properties: {},
          newProperties: {},
          ...overrides,
        },
      ]
    : [],
});

const blockNode = (
  id: string,
  type: string,
  suggestionOverrides: Record<string, unknown> = {},
  nodeOverrides: Record<string, unknown> = {}
) => ({
  kind: 'element',
  type,
  children: [{ text: '' }],
  suggestion: { id, type: 'insert', createdAt: 1_000, userId: 'author', ...suggestionOverrides },
  ...nodeOverrides,
});

function renderResolve(nodes = state.suggestionNodes, block = path) {
  return renderHook(() => useResolveSuggestion(nodes as never, block));
}

beforeEach(() => {
  vi.clearAllMocks();
  state.suggestionNodes = [];
  state.allEntries = [];
  state.discussions = [];
  state.uniquePathMap = new Map();
  state.currentMode = 'edit';
  state.documentId = undefined;
  state.currentDiscussions = [];
  state.nodeAtPrevious = {};
  state.parentAtPath = {};
  state.nextCrId.mockReturnValue('CR-next');
  vi.spyOn(console, 'error').mockImplementation(state.consoleError);
});

describe('useResolveSuggestion path-map contracts', () => {
  it('returns empty resolution for an empty source and ignores missing ids', () => {
    expect(renderResolve([]).result.current).toEqual([]);

    const missingId = textNode(undefined, 'insert', 'none');
    state.suggestionNodes = [[missingId, path]];
    const { result } = renderResolve();
    expect(result.current).toEqual([]);
    expect(state.setOption).not.toHaveBeenCalled();
  });

  it('repairs absent, stale, and non-line-break paths while preserving valid paths', () => {
    const absent = textNode('absent', 'insert', 'a');
    const stale = textNode('stale', 'insert', 'b');
    const valid = textNode('valid', 'insert', 'c');
    const parentMatch = textNode('parent-match', 'insert', 'd');
    const nonPath = textNode('non-path', 'insert', 'e');
    const parentWithoutId = textNode('parent-no-id', 'insert', 'f');
    state.suggestionNodes = [absent, stale, valid, parentMatch, nonPath, parentWithoutId].map(
      (node, index) => [node, [index]]
    );
    state.uniquePathMap = new Map([
      ['stale', [1]],
      ['valid', [2]],
      ['parent-match', [3]],
      ['non-path', null as never],
      ['parent-no-id', [4]],
    ]);
    state.nodeAtPrevious['valid:[2]'] = [valid, [2]];
    state.parentAtPath['[1]'] = [{ kind: 'text' }, [1]];
    state.parentAtPath['[3]'] = [blockNode('parent-match', 'p'), [3]];
    state.parentAtPath['[4]'] = [{ kind: 'element', type: 'p' }, [4]];

    renderResolve();
    expect(state.setOption).toHaveBeenCalledWith('uniquePathMap', expect.any(Map));
  });
});

describe('useResolveSuggestion type labels', () => {
  it('resolves every static block label plus paragraph list and data-view variants', () => {
    const types = [
      'audio',
      'blockquote',
      'callout',
      'codeBlock',
      'column',
      'columnGroup',
      'date',
      'equation',
      'file',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'img',
      'inlineEquation',
      'link',
      'mediaEmbed',
      'table',
      'toc',
      'toggle',
      'video',
      'custom',
    ];
    const nodes = types.map((type, index) => blockNode(`type-${index}`, type));
    nodes.push(
      blockNode('paragraph-todo', 'p', {}, { listType: 'todo' }),
      blockNode('paragraph-ol', 'p', {}, { listType: 'ol' }),
      blockNode('paragraph-ul', 'p', {}, { listType: 'ul' }),
      blockNode('paragraph-default', 'p'),
      blockNode('view-chart', 'data_view', {}, { view: 'chart' }),
      blockNode('view-table', 'data_view', {}, { view: 'table' }),
      blockNode('view-stat', 'data_view', {}, { view: 'stat' }),
      blockNode('view-default', 'data_view', {}, { view: 'other' })
    );
    state.suggestionNodes = nodes.map((node, index) => [node, [index]]);
    state.allEntries = [...state.suggestionNodes];
    state.uniquePathMap = new Map(nodes.map(node => [node.suggestion.id, path]));
    const { result } = renderResolve(state.suggestionNodes, path);
    expect(result.current).toHaveLength(nodes.length);
    expect(result.current.map(item => item.newText)).toEqual(
      expect.arrayContaining([
        '__block__plateJs.lists.todo',
        '__block__plateJs.lists.numbered',
        '__block__plateJs.lists.bulleted',
        '__block__plateJs.text',
        '__block__plateJs.dataView.table',
        '__block__plateJs.dataView.stat',
        '__block__plateJs.dataView.insertTitle',
      ])
    );
  });
});

describe('useResolveSuggestion text and block resolution', () => {
  it('builds update, replace, insert, and remove results and carries complete discussion metadata', () => {
    const update = textNode('update', 'update', 'updated', {
      properties: { old: true },
      newProperties: { next: true },
    });
    const insert = textNode('replace', 'insert', 'new');
    const remove = textNode('replace', 'remove', 'old');
    const onlyInsert = textNode('insert', 'insert', 'inserted');
    const onlyRemove = textNode('remove', 'remove', 'removed');
    const ignoredData = textNode('insert', 'noop', 'ignored');
    ignoredData.dataList.push({ ...ignoredData.dataList[0], id: 'other', type: 'insert' });
    const nodes = [update, insert, remove, onlyInsert, onlyRemove, ignoredData];
    state.suggestionNodes = nodes.map((node, index) => [node, [index]]);
    state.allEntries = [...state.suggestionNodes];
    state.uniquePathMap = new Map([
      ['update', path],
      ['replace', path],
      ['insert', path],
      ['remove', path],
    ]);
    state.discussions = [
      {
        id: 'update',
        comments: [{ id: 'comment' }],
        title: 'Title',
        crId: 'CR-1',
        displayCrId: 'DISPLAY',
        changeRequestEntityId: 'entity',
        votes: [],
        votesFor: 2,
        votesAgainst: 1,
        votesAbstain: 3,
        votingDeadline: 10,
        closeTrigger: 'manual',
        eligibleVoterCount: 4,
        votedCollaboratorCount: 3,
        resolutionMethod: 'majority',
        visibilityScope: 'all',
        resolvedInMode: 'vote',
        votingStatus: 'open',
        changeRequestStatus: 'draft',
        confirmationStatus: 'pending',
        confirmedAt: 20,
      },
    ];
    const { result } = renderResolve();
    expect(result.current.map(item => item.type)).toEqual(
      expect.arrayContaining(['update', 'replace', 'insert', 'remove'])
    );
    expect(result.current.find(item => item.type === 'update')).toMatchObject({
      displayCrId: 'DISPLAY',
      changeRequestEntityId: 'entity',
      comments: [{ id: 'comment' }],
      properties: { old: true },
      newProperties: { next: true },
      changeRequestStatus: 'draft',
    });
  });

  it('covers text ids without updates, update-id expansion, element ids, filtering, sorting, and empty entries', () => {
    const ordinary = textNode('ordinary', 'insert', 'ordinary');
    const multiUpdate = textNode('base', 'insert', 'multi');
    multiUpdate.dataList.push({
      id: 'expanded',
      type: 'update',
      createdAt: 1,
      userId: 'u',
      properties: {},
      newProperties: {},
    });
    const element = blockNode('element', 'p');
    const unknown = { kind: 'unknown' };
    state.suggestionNodes = [
      [ordinary, [0]],
      [multiUpdate, [1]],
      [element, [2]],
      [unknown, [3]],
    ];
    state.allEntries = [
      [ordinary, [0, 0]],
      [ordinary, [0]],
      [multiUpdate, [1]],
      [element, [2]],
    ];
    state.uniquePathMap = new Map([
      ['ordinary', [9]],
      ['expanded', path],
      ['element', path],
      ['base', path],
    ]);
    renderResolve();

    state.uniquePathMap = new Map([
      ['ordinary', null as never],
      ['base', [2]],
    ]);
    const { result } = renderResolve([[ordinary, [0]]]);
    expect(result.current).toEqual([]);
  });

  it('orders a child entry before its parent entry', () => {
    const seed = textNode('sorted', 'insert', 'seed');
    const parent = textNode('sorted', 'insert', 'parent');
    state.suggestionNodes = [[seed, [0]]];
    state.allEntries = [
      [parent, [0]],
      [seed, [0, 0]],
    ];
    state.uniquePathMap = new Map([['sorted', path]]);

    expect(renderResolve().result.current).toEqual([
      expect.objectContaining({ newText: 'seedparent', suggestionId: 'sorted' }),
    ]);
  });

  it('handles block line breaks, typed blocks, mismatched data, missing node data, and empty text', () => {
    const insertBreak = blockNode('insert-break', 'p', { isLineBreak: true });
    const removeBreak = blockNode('remove-break', 'p', { type: 'remove', isLineBreak: true });
    const removeBlock = blockNode('remove-block', 'table', { type: 'remove' });
    const mismatch = blockNode('mismatch', 'p');
    mismatch.suggestion.id = 'different';
    const notSuggestion = { kind: 'element', type: 'p', children: [] };
    const nodes = [insertBreak, removeBreak, removeBlock, mismatch, notSuggestion];
    state.suggestionNodes = nodes.map((node, index) => [node, [index]]);
    state.allEntries = [...state.suggestionNodes];
    state.uniquePathMap = new Map([
      ['insert-break', path],
      ['remove-break', path],
      ['remove-block', path],
      ['mismatch', path],
    ]);
    const { result } = renderResolve();
    expect(result.current.map(item => item.type)).toEqual(
      expect.arrayContaining(['insert', 'remove'])
    );

    const missingData = textNode('missing-data', 'insert', 'text');
    missingData.dataList = [];
    state.suggestionNodes = [[missingData, path]];
    state.allEntries = [[missingData, path]];
    state.uniquePathMap = new Map([['missing-data', path]]);
    expect(renderResolve().result.current).toEqual([]);
  });

  it('ignores non-block elements and resolves a block update without text changes', () => {
    const nonBlockSeed = textNode('non-block', 'insert', 'seed');
    const nonBlock = { kind: 'element', type: 'p', nodeId: 'non-block', children: [] };
    state.suggestionNodes = [[nonBlockSeed, path]];
    state.allEntries = [[nonBlock, path]];
    state.uniquePathMap = new Map([['non-block', path]]);
    expect(renderResolve().result.current).toEqual([]);

    const updateBlock = blockNode('block-update', 'p', { type: 'update' });
    state.suggestionNodes = [[updateBlock, path]];
    state.allEntries = [[updateBlock, path]];
    state.uniquePathMap = new Map([['block-update', path]]);
    expect(renderResolve().result.current).toEqual([
      expect.objectContaining({ suggestionId: 'block-update', type: 'update' }),
    ]);
  });
});

describe('useResolveSuggestion CR assignment', () => {
  const prepare = (discussionRows: any[] | undefined, mode = 'edit') => {
    const node = textNode('assign', 'insert', 'text');
    state.suggestionNodes = [[node, path]];
    state.allEntries = [[node, path]];
    state.uniquePathMap = new Map([['assign', path]]);
    state.documentId = 'document';
    state.currentDiscussions = discussionRows;
    state.discussions = discussionRows ?? [];
    state.currentMode = mode;
    return node;
  };

  it('skips absent documents, empty resolution, and already assigned CR ids', async () => {
    prepare([]);
    state.documentId = undefined;
    renderResolve();
    prepare([{ id: 'assign', crId: 'CR-existing' }]);
    renderResolve();
    await waitFor(() => expect(state.editorSetOption).not.toHaveBeenCalled());
  });

  it('creates missing discussions with fallback arrays and event confirmation', async () => {
    prepare(undefined, 'suggest_event');
    renderResolve();
    await waitFor(() =>
      expect(state.editorSetOption).toHaveBeenCalledWith(expect.anything(), 'discussions', [
        expect.objectContaining({ id: 'assign', crId: 'CR-next', confirmationStatus: 'pending' }),
      ])
    );
  });

  it('creates an edit-mode discussion without event confirmation', async () => {
    prepare([], 'edit');
    renderResolve();
    await waitFor(() =>
      expect(state.editorSetOption).toHaveBeenCalledWith(expect.anything(), 'discussions', [
        expect.objectContaining({ id: 'assign', confirmationStatus: undefined }),
      ])
    );
  });

  it('preserves a currently assigned discussion without writing', async () => {
    prepare([]);
    state.currentDiscussions = [{ id: 'assign', crId: 'CR-current' }];
    renderResolve();
    await waitFor(() => expect(state.editorSetOption).not.toHaveBeenCalled());
  });

  it('updates existing discussions in edit/event modes and preserves or defaults confirmation', async () => {
    prepare([{ id: 'assign', confirmationStatus: 'confirmed' }], 'suggest_event');
    renderResolve();
    await waitFor(() =>
      expect(state.editorSetOption).toHaveBeenCalledWith(expect.anything(), 'discussions', [
        expect.objectContaining({ confirmationStatus: 'confirmed' }),
      ])
    );
    vi.clearAllMocks();
    prepare([{ id: 'assign' }], 'suggest_event');
    renderResolve();
    await waitFor(() =>
      expect(state.editorSetOption).toHaveBeenCalledWith(expect.anything(), 'discussions', [
        expect.objectContaining({ confirmationStatus: 'pending' }),
      ])
    );
    vi.clearAllMocks();
    prepare([{ id: 'assign' }], 'edit');
    renderResolve();
    await waitFor(() => expect(state.editorSetOption).toHaveBeenCalled());
  });

  it('contains assignment failures for missing and existing discussions', async () => {
    state.nextCrId.mockImplementation(() => {
      throw new Error('id failure');
    });
    prepare([]);
    renderResolve();
    await waitFor(() =>
      expect(state.consoleError).toHaveBeenCalledWith(
        'Failed to assign CR ID to suggestion:',
        expect.any(Error)
      )
    );
    vi.clearAllMocks();
    state.nextCrId.mockImplementation(() => {
      throw new Error('id failure');
    });
    prepare([{ id: 'assign' }]);
    renderResolve();
    await waitFor(() =>
      expect(state.consoleError).toHaveBeenCalledWith(
        'Failed to assign CR ID to discussion:',
        expect.any(Error)
      )
    );
  });
});

describe('isResolvedSuggestion', () => {
  it('distinguishes resolved suggestions from discussions', () => {
    expect(isResolvedSuggestion({ suggestionId: 'id' } as never)).toBe(true);
    expect(isResolvedSuggestion({ id: 'discussion' } as never)).toBe(false);
  });
});
