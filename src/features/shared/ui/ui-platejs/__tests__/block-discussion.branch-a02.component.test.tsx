/* @vitest-environment jsdom */

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  mobile: false,
  tutorial: false,
  activeId: undefined as string | undefined,
  activeSuggestionId: undefined as string | undefined,
  commentingBlock: undefined as number[] | undefined,
  discussions: [] as any[],
  documentTitle: '',
  uniquePathMap: new Map<string, number[]>(),
  editor: undefined as any,
  pluginApi: undefined as any,
  resolvedSuggestions: [] as any[],
}));

vi.mock('@platejs/comment', () => ({ getDraftCommentKey: () => 'draft-comment' }));
vi.mock('@platejs/comment/react', () => ({ CommentPlugin: { key: 'comment-react' } }));
vi.mock('@platejs/suggestion/react', () => ({ SuggestionPlugin: { key: 'suggestion-react' } }));
vi.mock('lucide-react', async () => {
  const ReactModule = await import('react');
  const Icon = ({ className }: { className?: string }) =>
    ReactModule.createElement('i', { className, 'data-testid': 'icon' });
  return {
    Check: Icon,
    MessageSquareTextIcon: Icon,
    MessagesSquareIcon: Icon,
    Pencil: Icon,
    PencilLineIcon: Icon,
    X: Icon,
  };
});
vi.mock('platejs', () => ({
  PathApi: {
    equals: (left: number[], right: number[]) =>
      left.length === right.length && left.every((value, index) => value === right[index]),
    isPath: (value: unknown) =>
      Array.isArray(value) && value.every(segment => typeof segment === 'number'),
  },
  TextApi: { isText: (node: any) => typeof node?.text === 'string' },
}));
vi.mock('platejs/react', () => ({
  useEditorPlugin: () => h.pluginApi,
  useEditorRef: () => h.editor,
  usePluginOption: (plugin: { key?: string }, key: string) => {
    if (plugin.key === 'suggestion' && key === 'activeId') return h.activeSuggestionId;
    if (plugin.key === 'comment' && key === 'commentingBlock') return h.commentingBlock;
    if (plugin.key === 'comment' && key === 'activeId') return h.activeId;
    if (plugin.key === 'discussion' && key === 'discussions') return h.discussions;
    if (plugin.key === 'discussion' && key === 'documentTitle') return h.documentTitle;
    if (plugin.key === 'comment' && key === 'uniquePathMap') return h.uniquePathMap;
    return undefined;
  },
}));
vi.mock('@/features/shared/ui/ui/button.tsx', async () => {
  const ReactModule = await import('react');
  return {
    Button: ({ children, presentation: _presentation, ...props }: any) =>
      ReactModule.createElement('button', props, children),
  };
});
vi.mock('@/features/shared/ui/ui/input.tsx', async () => {
  const ReactModule = await import('react');
  return { Input: (props: any) => ReactModule.createElement('input', props) };
});
vi.mock('@/features/shared/ui/ui/popover.tsx', async () => {
  const ReactModule = await import('react');
  return {
    Popover: ({ children, onOpenChange }: any) =>
      ReactModule.createElement(
        'section',
        { 'data-testid': 'popover', onDoubleClick: () => onOpenChange(false) },
        children
      ),
    PopoverAnchor: ({ virtualRef }: any) =>
      ReactModule.createElement('span', {
        'data-anchor': virtualRef.current?.dataset?.anchor ?? 'missing',
        'data-testid': 'anchor',
      }),
    PopoverContent: ({ children, onCloseAutoFocus, onOpenAutoFocus }: any) =>
      ReactModule.createElement(
        'aside',
        {
          'data-testid': 'popover-content',
          onBlur: onCloseAutoFocus,
          onFocus: onOpenAutoFocus,
        },
        children
      ),
    PopoverTrigger: ({ children }: any) => children,
  };
});
vi.mock('@/features/shared/ui/ui/dialog.tsx', async () => {
  const ReactModule = await import('react');
  return {
    Dialog: ({ children, onOpenChange }: any) =>
      ReactModule.createElement(
        'section',
        { 'data-testid': 'dialog', onDoubleClick: () => onOpenChange(false) },
        children
      ),
    DialogContent: ({ children, onCloseAutoFocus, onInteractOutside, onOpenAutoFocus }: any) =>
      ReactModule.createElement(
        'aside',
        {
          'data-testid': 'dialog-content',
          onBlur: onCloseAutoFocus,
          onFocus: onOpenAutoFocus,
          onPointerDown: onInteractOutside,
        },
        children
      ),
    DialogTitle: ({ children }: any) => ReactModule.createElement('h2', {}, children),
    DialogTrigger: ({ children }: any) => children,
  };
});
vi.mock('@/features/shared/ui/kit-platejs/comment-kit.tsx', () => ({
  commentPlugin: { key: 'comment' },
}));
vi.mock('@/features/shared/ui/kit-platejs/discussion-kit.tsx', () => ({
  discussionPlugin: { key: 'discussion' },
}));
vi.mock('@/features/shared/ui/kit-platejs/suggestion-kit.tsx', () => ({
  suggestionPlugin: { key: 'suggestion' },
}));
vi.mock('@/features/shared/ui/kit-platejs/mode-context.tsx', () => ({
  useModeContext: () => ({ selectedCrIds: h.editor.selectedCrIds }),
}));
vi.mock('../block-suggestion.tsx', async () => {
  const ReactModule = await import('react');
  return {
    BlockSuggestionCard: ({ idx, isLast, suggestion }: any) =>
      ReactModule.createElement(
        'article',
        { 'data-idx': idx, 'data-last': isLast, 'data-testid': 'suggestion-card' },
        suggestion.suggestionId
      ),
    isResolvedSuggestion: (item: any) => 'suggestionId' in item,
    useResolveSuggestion: () => h.resolvedSuggestions,
  };
});
vi.mock('../comment.tsx', async () => {
  const ReactModule = await import('react');
  return {
    Comment: ({ comment, index, onReply, setEditingId }: any) =>
      ReactModule.createElement(
        'article',
        { 'data-index': index, 'data-testid': 'comment' },
        comment.id,
        onReply ? ReactModule.createElement('button', { onClick: onReply }, 'reply') : null,
        ReactModule.createElement(
          'button',
          { onClick: () => setEditingId(comment.id) },
          'edit-comment'
        )
      ),
    CommentCreateForm: ({ discussionId, onSubmitted }: any) =>
      ReactModule.createElement(
        'form',
        { 'data-discussion': discussionId, 'data-testid': 'comment-form' },
        onSubmitted
          ? ReactModule.createElement('button', { onClick: onSubmitted, type: 'button' }, 'submit')
          : null
      ),
  };
});
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? 'translated',
}));
vi.mock('@/features/shared/hooks/useIsMobileScreen', () => ({
  useIsMobileScreen: () => h.mobile,
}));
vi.mock('@/features/app-tutorial/events', () => ({
  isAppTutorialActiveInDocument: () => h.tutorial,
}));

import { BlockDiscussion, ResponsiveDiscussionOverlay } from '../block-discussion';

const path = [0];

function discussion(overrides: Record<string, unknown> = {}) {
  return {
    comments: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    id: 'discussion-1',
    isResolved: false,
    title: 'Initial title',
    userId: 'user-1',
    ...overrides,
  } as any;
}

function suggestion(overrides: Record<string, unknown> = {}) {
  return {
    changeRequestStatus: 'pending',
    crId: 'CR-1',
    createdAt: new Date('2026-01-02T00:00:00Z'),
    suggestionId: 'suggestion-1',
    votingStatus: 'open',
    ...overrides,
  } as any;
}

function configureEditor({
  blockPath = path,
  commentNodes = [],
  draftNode,
  suggestionNodes = [],
}: {
  blockPath?: number[] | undefined;
  commentNodes?: any[];
  draftNode?: any;
  suggestionNodes?: any[];
} = {}) {
  const commentApi = {
    has: vi.fn(({ id }: { id: string }) => id !== 'missing'),
    node: vi.fn(({ at, id, isDraft }: any) => {
      if (isDraft) return draftNode;
      if (id && Array.isArray(at)) return id === 'stale' ? undefined : [commentNodes[0]?.[0], at];
      return undefined;
    }),
    nodeId: vi.fn((node: any) => node.commentId),
    nodes: vi.fn(() => commentNodes),
  };
  const suggestionApi = {
    nodeId: vi.fn((node: any) => node.suggestionId),
    nodes: vi.fn(() => suggestionNodes),
  };
  const setOption = vi.fn((key: string, value: unknown) => {
    if (key === 'uniquePathMap') h.uniquePathMap = value as Map<string, number[]>;
  });
  h.editor = {
    api: {
      findPath: vi.fn(() => blockPath),
      toDOMNode: vi.fn((node: any) => node.dom ?? null),
    },
    getApi: vi.fn((plugin: { key?: string }) =>
      plugin.key === 'suggestion-react' ? { suggestion: suggestionApi } : { comment: commentApi }
    ),
    getOption: vi.fn((_plugin: unknown, key: string) =>
      key === 'discussions' ? h.discussions : undefined
    ),
    selectedCrIds: undefined,
    setOption: vi.fn((_plugin: unknown, key: string, value: unknown) => {
      if (key === 'discussions') h.discussions = value as any[];
    }),
    tf: { unsetNodes: vi.fn() },
  };
  h.pluginApi = {
    api: { comment: commentApi },
    getOption: vi.fn(() => h.uniquePathMap),
    setOption,
  };
  return { commentApi, setOption, suggestionApi };
}

function renderBlock() {
  const wrapper = BlockDiscussion({ editor: h.editor, element: {} } as any);
  expect(wrapper).toBeTypeOf('function');
  return render(<>{wrapper!({ children: <p>block content</p> } as any)}</>);
}

beforeEach(() => {
  h.mobile = false;
  h.tutorial = false;
  h.activeId = undefined;
  h.activeSuggestionId = undefined;
  h.commentingBlock = undefined;
  h.discussions = [];
  h.documentTitle = '';
  h.uniquePathMap = new Map();
  h.resolvedSuggestions = [];
  configureEditor();
});

afterEach(() => cleanup());

describe('BlockDiscussion branch contract', () => {
  it('skips nested and unresolved block paths', () => {
    configureEditor({ blockPath: null as any });
    expect(BlockDiscussion({ editor: h.editor, element: {} } as any)).toBeUndefined();

    configureEditor({ blockPath: [0, 1] });
    expect(BlockDiscussion({ editor: h.editor, element: {} } as any)).toBeUndefined();
  });

  it('reserves rail space only for empty mobile blocks', () => {
    configureEditor();
    h.mobile = false;
    const desktop = renderBlock();
    expect(screen.getByText('block content').parentElement?.dataset.slot).toBeUndefined();
    desktop.unmount();

    h.mobile = true;
    renderBlock();
    expect(document.querySelector('[data-slot="discussion-trigger-rail"]')).toBeTruthy();
  });

  it('renders desktop fallbacks when nodes do not resolve to discussions', () => {
    configureEditor({ commentNodes: [[{ commentId: undefined }, path]] });
    renderBlock();
    expect(screen.getByText('block content').parentElement?.className).toBe('w-full');
  });

  it('filters resolved and unselected suggestions and renders the mobile fallback', () => {
    const candidates = [
      suggestion({ suggestionId: 'completed', votingStatus: 'completed' }),
      suggestion({ changeRequestStatus: 'accepted', suggestionId: 'accepted' }),
      suggestion({ changeRequestStatus: 'approved', suggestionId: 'approved' }),
      suggestion({ changeRequestStatus: 'rejected', suggestionId: 'rejected' }),
      suggestion({ changeRequestStatus: 'declined', suggestionId: 'declined' }),
      suggestion({ changeRequestStatus: null, crId: 'CR-9', suggestionId: 'null-status' }),
      suggestion({ crId: null, suggestionId: 'no-cr' }),
      suggestion({ crId: 'CR-2', suggestionId: 'other-cr' }),
    ];
    h.resolvedSuggestions = candidates;
    configureEditor({ suggestionNodes: candidates.map(item => [item, path]) });
    h.editor.selectedCrIds = new Set(['CR-1']);
    h.mobile = true;
    renderBlock();
    expect(document.querySelector('[data-slot="discussion-trigger-rail"]')).toBeTruthy();
  });

  it('renders and anchors a suggestion-only desktop overlay', () => {
    const anchor = document.createElement('div');
    anchor.dataset.anchor = 'suggestion';
    const item = suggestion();
    h.resolvedSuggestions = [item];
    h.activeSuggestionId = item.suggestionId;
    configureEditor({
      suggestionNodes: [[{ dom: anchor, suggestionId: item.suggestionId, text: 'text' }, path]],
    });
    renderBlock();

    expect(screen.getByTestId('suggestion-card').textContent).toBe(item.suggestionId);
    expect(screen.getByTestId('anchor').dataset.anchor).toBe('suggestion');
    expect(screen.getByText('1')).toBeTruthy();
    fireEvent.doubleClick(screen.getByTestId('popover'));
    expect(h.editor.tf.unsetNodes).not.toHaveBeenCalled();
  });

  it('renders merged suggestions and discussions in created order', () => {
    const first = discussion({
      comments: [{ id: 'initial' }, { id: undefined }],
      createdAt: new Date('2026-01-01'),
      documentContent: 'document',
    });
    const later = suggestion({ createdAt: new Date('2026-01-02') });
    h.resolvedSuggestions = [later];
    h.discussions = [first];
    h.uniquePathMap.set(first.id, path);
    h.documentTitle = 'Document title';
    configureEditor({
      commentNodes: [[{ commentId: first.id }, path]],
      suggestionNodes: [[{ suggestionId: later.suggestionId, text: 'text' }, path]],
    });
    renderBlock();

    const items = screen.getAllByRole('article');
    expect(items.map(item => item.textContent)).toEqual([
      expect.stringContaining('initial'),
      'edit-comment',
      later.suggestionId,
    ]);
    expect(screen.getByText('Document title')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('edits, saves, cancels, and keyboard-controls discussion titles', () => {
    const item = discussion({ comments: [] });
    h.discussions = [item, discussion({ id: 'other-discussion' })];
    h.uniquePathMap.set(item.id, path);
    configureEditor({ commentNodes: [[{ commentId: item.id }, path]] });
    renderBlock();

    fireEvent.click(screen.getAllByRole('button')[0]!);
    let input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Saved title' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.editor.setOption).toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button')[0]!);
    input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Cancelled title' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByText('Initial title')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button')[0]!);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Button save' } });
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(h.editor.setOption).toHaveBeenLastCalledWith(
      expect.anything(),
      'discussions',
      expect.arrayContaining([expect.objectContaining({ title: 'Button save' })])
    );

    fireEvent.click(screen.getAllByRole('button')[0]!);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Button cancel' } });
    fireEvent.click(screen.getAllByRole('button')[1]!);
    expect(screen.getByText('Initial title')).toBeTruthy();
  });

  it('adds initial comments, replies, submits, and activates existing comments', () => {
    const empty = discussion({ comments: [], title: '' });
    h.discussions = [empty];
    h.uniquePathMap.set(empty.id, path);
    configureEditor({ commentNodes: [[{ commentId: empty.id }, path]] });
    const firstView = renderBlock();
    fireEvent.click(screen.getAllByRole('button')[0]!);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab' });
    fireEvent.click(screen.getAllByRole('button')[1]!);
    const addButton = screen.getByRole('button', { name: 'translated' });
    expect(addButton).toBeTruthy();
    fireEvent.click(addButton);
    expect(screen.getByTestId('comment-form').dataset.discussion).toBe(empty.id);
    fireEvent.click(screen.getByText('submit'));
    firstView.unmount();

    const populated = discussion({ comments: [{ id: 'initial' }, { id: 'reply' }] });
    h.discussions = [populated];
    h.uniquePathMap.set(populated.id, path);
    h.activeId = populated.id;
    configureEditor({ commentNodes: [[{ commentId: populated.id, dom: undefined }, path]] });
    renderBlock();
    expect(screen.getAllByTestId('comment')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'reply' }));
    expect(screen.getByTestId('comment-form')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'edit-comment' })[0]!);
  });

  it('shows draft comment forms and clears draft nodes when closing', () => {
    const draft = [{ commentId: 'draft-comment' }, path];
    h.activeId = 'draft-comment';
    h.commentingBlock = path;
    configureEditor({ draftNode: draft });
    renderBlock();
    expect(screen.getByTestId('comment-form')).toBeTruthy();
    fireEvent.doubleClick(screen.getByTestId('popover'));
    expect(h.editor.tf.unsetNodes).toHaveBeenCalledWith(
      'draft-comment',
      expect.objectContaining({ at: [], mode: 'lowest' })
    );
    const match = h.editor.tf.unsetNodes.mock.calls[0]![1].match;
    expect(match({ 'draft-comment': true })).toBe(true);
    expect(match({})).toBeUndefined();
  });

  it('keeps a non-current draft and selected content when closing', () => {
    const draft = [{ commentId: 'draft-comment' }, path];
    const item = suggestion();
    h.activeId = 'draft-comment';
    h.commentingBlock = [9];
    h.resolvedSuggestions = [item];
    configureEditor({ draftNode: draft, suggestionNodes: [[item, path]] });
    renderBlock();
    fireEvent.doubleClick(screen.getByTestId('popover'));
    expect(h.editor.tf.unsetNodes).toHaveBeenCalledTimes(1);
  });

  it('repairs unique-path maps and filters unavailable discussions', () => {
    const visible = discussion({ id: 'visible' });
    const wrongPath = discussion({ id: 'wrong-path' });
    const absentPath = discussion({ id: 'absent-path' });
    const missing = discussion({ id: 'missing' });
    const resolved = discussion({ id: 'resolved', isResolved: true });
    const stale = discussion({ id: 'stale' });
    h.discussions = [visible, wrongPath, absentPath, missing, resolved, stale];
    h.uniquePathMap = new Map([
      [visible.id, path],
      [wrongPath.id, [2]],
      [missing.id, path],
      [resolved.id, path],
      [stale.id, [3]],
    ]);
    const nodes = [
      [{ commentId: visible.id }, path],
      [{ commentId: wrongPath.id }, path],
      [{ commentId: absentPath.id }, path],
      [{ commentId: missing.id }, path],
      [{ commentId: resolved.id }, path],
      [{ commentId: stale.id }, path],
      [{ commentId: undefined }, path],
    ];
    const { setOption } = configureEditor({ commentNodes: nodes });
    renderBlock();
    expect(screen.getByText('Initial title')).toBeTruthy();
    expect(setOption).toHaveBeenCalled();
  });
});

describe('ResponsiveDiscussionOverlay branch contract', () => {
  const props = {
    anchorElement: null,
    blockContent: <p>content</p>,
    onOpenChange: vi.fn(),
    open: true,
    overlayContent: <p>overlay</p>,
    trigger: <button type="button">trigger</button>,
  };

  it('handles mobile focus and outside interactions for tutorial and normal targets', () => {
    h.tutorial = true;
    render(<ResponsiveDiscussionOverlay {...props} isMobileScreen />);
    const content = screen.getByTestId('dialog-content');
    const focusEvent = fireEvent.focus(content);
    const blurEvent = fireEvent.blur(content);
    expect(focusEvent).toBe(true);
    expect(blurEvent).toBe(true);

    const spotlight = document.createElement('span');
    spotlight.dataset.testid = 'app-tutorial-spotlight';
    const target = document.createElement('button');
    spotlight.append(target);
    content.append(spotlight);
    fireEvent.pointerDown(target);

    h.tutorial = false;
    cleanup();
    render(<ResponsiveDiscussionOverlay {...props} isMobileScreen />);
    fireEvent.pointerDown(screen.getByTestId('dialog-content'));
    fireEvent.doubleClick(screen.getByTestId('dialog'));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('handles desktop anchor, focus, trigger, and absent optional content', () => {
    const anchor = document.createElement('span');
    anchor.dataset.anchor = 'desktop';
    const { rerender } = render(
      <ResponsiveDiscussionOverlay {...props} anchorElement={anchor} isMobileScreen={false} />
    );
    const content = screen.getByTestId('popover-content');
    expect(screen.getByTestId('anchor').dataset.anchor).toBe('desktop');
    fireEvent.focus(content);
    fireEvent.blur(content);
    fireEvent.doubleClick(screen.getByTestId('popover'));

    rerender(
      <ResponsiveDiscussionOverlay
        {...props}
        anchorElement={null}
        isMobileScreen={false}
        trigger={null}
      />
    );
    expect(screen.queryByTestId('anchor')).toBeNull();
    expect(screen.queryByRole('button', { name: 'trigger' })).toBeNull();
  });

  it('renders a mobile row without a trigger', () => {
    render(<ResponsiveDiscussionOverlay {...props} isMobileScreen trigger={null} />);
    expect(document.querySelector('[data-slot="discussion-trigger-rail"]')?.children).toHaveLength(
      0
    );
  });
});
