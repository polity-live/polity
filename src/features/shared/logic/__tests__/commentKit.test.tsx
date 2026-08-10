/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isSlateString: vi.fn(),
  draftKey: vi.fn(() => 'draft-key'),
  plugin: null as any,
}));

vi.mock('@platejs/comment', () => ({
  BaseCommentPlugin: { key: 'comment' },
  getDraftCommentKey: mocks.draftKey,
}));
vi.mock('platejs', () => ({ isSlateString: mocks.isSlateString }));
vi.mock('platejs/react', () => ({
  toTPlatePlugin: (_base: unknown, config: unknown) => {
    const plugin: any = {
      config,
      extendTransforms(factory: unknown) {
        plugin.transformFactory = factory;
        return plugin;
      },
      configure(configuration: unknown) {
        plugin.configuration = configuration;
        return plugin;
      },
    };
    mocks.plugin = plugin;
    return plugin;
  },
}));
vi.mock('@/features/shared/ui/ui-platejs/comment-node.tsx', () => ({
  CommentLeaf: () => null,
}));

import { CommentKit, commentPlugin } from '../commentKit';

function click(args: { target: HTMLElement; node?: unknown; nodeId?: string | null }) {
  const setOption = vi.fn();
  const node = vi.fn(() => args.node);
  const nodeId = vi.fn(() => args.nodeId);
  mocks.plugin.config.handlers.onClick({
    api: { comment: { node, nodeId } },
    event: { target: args.target },
    setOption,
    type: 'comment',
  });
  return { setOption, node, nodeId };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSlateString.mockReturnValue(true);
});

describe('CommentKit click handling', () => {
  it('exports the configured plugin kit and clears non-Slate targets', () => {
    expect(CommentKit).toEqual([commentPlugin]);
    expect(mocks.plugin.configuration).toMatchObject({
      shortcuts: { setDraft: { keys: 'mod+shift+m' } },
    });
    mocks.isSlateString.mockReturnValue(false);
    const { setOption } = click({ target: document.createElement('span') });
    expect(setOption).toHaveBeenCalledWith('activeId', null);
  });

  it('clears a Slate target outside comment markup', () => {
    const { setOption } = click({ target: document.createElement('span') });
    expect(setOption).toHaveBeenCalledTimes(1);
    expect(setOption).toHaveBeenCalledWith('activeId', null);
  });

  it('clears comment markup when no comment node exists', () => {
    const root = document.createElement('div');
    const parent = document.createElement('span');
    parent.className = 'slate-comment';
    const child = document.createElement('span');
    parent.append(child);
    root.append(parent);
    const { setOption, nodeId } = click({ target: child });
    expect(setOption).toHaveBeenCalledWith('activeId', null);
    expect(nodeId).not.toHaveBeenCalled();
  });

  it.each([
    ['comment-1', 'comment-1'],
    [null, null],
    [undefined, null],
  ] as const)('sets resolved node ID %s as the active comment', (nodeIdValue, expected) => {
    const root = document.createElement('div');
    const parent = document.createElement('span');
    parent.className = 'slate-comment';
    const child = document.createElement('span');
    parent.append(child);
    root.append(parent);
    const entry = [{ comment: true }, [0]];
    const { setOption, nodeId } = click({ target: child, node: entry, nodeId: nodeIdValue });
    expect(nodeId).toHaveBeenCalledWith(entry[0]);
    expect(setOption).toHaveBeenCalledWith('activeId', expected);
  });
});

describe('CommentKit setDraft transform', () => {
  function transform({
    collapsed,
    block,
    selection,
  }: {
    collapsed: boolean;
    block?: unknown;
    selection?: any;
  }) {
    const select = vi.fn();
    const collapse = vi.fn();
    const setDraft = vi.fn();
    const setOption = vi.fn();
    const editor = {
      api: { isCollapsed: vi.fn(() => collapsed), block: vi.fn(() => block) },
      tf: { select, collapse },
      selection,
    };
    const transforms = mocks.plugin.transformFactory({
      editor,
      setOption,
      tf: { comment: { setDraft } },
    });
    transforms.setDraft();
    return { select, collapse, setDraft, setOption };
  }

  it('selects the current block for collapsed selections and records the commenting path', () => {
    const block = [{ type: 'p' }, [3, 2]];
    const result = transform({
      collapsed: true,
      block,
      selection: { focus: { path: [3, 4, 5] } },
    });
    expect(result.select).toHaveBeenCalledWith(block[1]);
    expect(result.setDraft).toHaveBeenCalledOnce();
    expect(result.collapse).toHaveBeenCalledOnce();
    expect(result.setOption).toHaveBeenCalledWith('activeId', 'draft-key');
    expect(result.setOption).toHaveBeenCalledWith('commentingBlock', [3]);
  });

  it('handles a missing block and selection without selecting or recording a path', () => {
    const result = transform({ collapsed: true });
    expect(result.select).not.toHaveBeenCalled();
    expect(result.setOption).not.toHaveBeenCalledWith('commentingBlock', expect.anything());
  });

  it('does not expand an already ranged selection', () => {
    const result = transform({
      collapsed: false,
      block: [{}, [0]],
      selection: { focus: { path: [1] } },
    });
    expect(result.select).not.toHaveBeenCalled();
    expect(result.setOption).toHaveBeenCalledWith('commentingBlock', [1]);
  });
});
