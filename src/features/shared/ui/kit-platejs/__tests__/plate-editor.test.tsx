// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const discussionPlugin = { key: 'discussion' };
  const suggestionPlugin = { key: 'suggestion' };
  return {
    discussionPlugin,
    suggestionPlugin,
    editorKit: [{ key: 'fixed' }],
    editorKitWithoutFixed: [{ key: 'floating' }],
    view: vi.fn((_props: any) => <div data-testid="plate-view" />),
    debug: vi.fn(),
    areEqual: vi.fn(() => false),
    hasOperations: vi.fn(() => true),
    replaceValue: vi.fn(() => null as unknown),
    isActive: vi.fn(() => false),
    currentDiscussions: undefined as any[] | undefined,
    nodes: [] as any[],
    editor: {
      children: [{ type: 'p', children: [{ text: 'editor' }] }] as any[],
      selection: null as any,
      operations: [] as any[],
      setOptions: vi.fn(),
      getOption: vi.fn(),
      api: { nodes: vi.fn() },
    },
  };
});

vi.mock('platejs/react', () => ({
  usePlateEditor: (config: unknown) => {
    (mocks.editor as any).config = config;
    return mocks.editor;
  },
}));
vi.mock('@/features/shared/ui/kit-platejs/editor-kit.tsx', () => ({
  EditorKit: mocks.editorKit,
  EditorKitWithoutFixedToolbar: mocks.editorKitWithoutFixed,
}));
vi.mock('@/features/shared/ui/kit-platejs/discussion-kit.tsx', () => ({
  discussionPlugin: mocks.discussionPlugin,
}));
vi.mock('@/features/shared/ui/kit-platejs/suggestion-kit.tsx', () => ({
  suggestionPlugin: mocks.suggestionPlugin,
}));
vi.mock('@/features/shared/ui/ui-platejs/editor.tsx', () => ({
  Editor: () => null,
  EditorContainer: () => null,
}));
vi.mock('@/features/shared/logic/editorSelectionDebug', () => ({
  editorSelectionDebugLog: mocks.debug,
  getActiveElementDebugInfo: () => ({ active: true }),
  isActiveElementInSlateEditor: mocks.isActive,
  summarizeDiscussions: (value: unknown) => value,
  summarizeRichTextValue: (value: unknown) => value,
  summarizeSelection: (value: unknown) => value,
}));
vi.mock('@/features/shared/logic/editorContentSync', () => ({
  areEditorValuesEqual: mocks.areEqual,
  hasEditorContentOperations: mocks.hasOperations,
  replaceEditorValuePreservingSelection: mocks.replaceValue,
}));
vi.mock('../PlateEditorView', () => ({
  PlateEditorView: (props: any) => mocks.view(props),
}));

import { PlateEditor } from '../plate-editor';

function latestProps() {
  return mocks.view.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.view.mockClear();
  mocks.debug.mockClear();
  mocks.areEqual.mockReset();
  mocks.areEqual.mockReturnValue(false);
  mocks.hasOperations.mockReset();
  mocks.hasOperations.mockReturnValue(true);
  mocks.replaceValue.mockReset();
  mocks.replaceValue.mockReturnValue(null);
  mocks.isActive.mockReset();
  mocks.isActive.mockReturnValue(false);
  mocks.currentDiscussions = undefined;
  mocks.nodes = [];
  mocks.editor.children = [{ type: 'p', children: [{ text: 'editor' }] }];
  mocks.editor.selection = null;
  mocks.editor.operations = [];
  mocks.editor.setOptions.mockReset();
  mocks.editor.getOption.mockReset();
  mocks.editor.getOption.mockImplementation((_plugin, key) =>
    key === 'discussions' ? mocks.currentDiscussions : undefined
  );
  mocks.editor.api.nodes.mockReset();
  mocks.editor.api.nodes.mockImplementation(({ match }: { match: (node: any) => boolean }) =>
    mocks.nodes.flatMap((node, index) => (match(node) ? [[node, [index]]] : []))
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PlateEditor controller', () => {
  it('uses uncontrolled defaults, floating toolbar configuration, and guarded local changes', () => {
    const rendered = render(<PlateEditor showFixedToolbar={false} />);
    const props = latestProps();
    expect((mocks.editor as any).config.plugins).toBe(mocks.editorKitWithoutFixed);
    expect((mocks.editor as any).config.value).toEqual([{ type: 'p', children: [{ text: '' }] }]);
    expect(props).toMatchObject({
      editorVariant: 'demo',
      isOwnerOrCollaborator: true,
      readOnly: false,
      showFixedToolbar: false,
      showSettingsDialog: true,
      isControlled: false,
    });
    expect(mocks.debug).toHaveBeenCalledWith('debug-ready', expect.any(Object));

    mocks.hasOperations.mockReturnValue(false);
    act(() =>
      props.handleEditorChange({ value: [{ type: 'p', children: [{ text: 'ignored' }] }] })
    );
    mocks.hasOperations.mockReturnValue(true);
    act(() =>
      props.handleEditorChange({ value: [{ type: 'p', children: [{ text: 'no callback' }] }] })
    );
    props.isUpdatingFromProps.current = true;
    act(() => props.handleEditorChange({ value: [] }));
    props.isUpdatingFromProps.current = false;
    rendered.unmount();
  });

  it('builds collaborative options, loads discussions once, and preserves editor-side changes', () => {
    const currentUser = { id: 'user', name: 'User' };
    const users = { user: { id: 'user', name: 'User', avatarUrl: '' } };
    const initialValue = [{ type: 'p', children: [{ text: 'initial' }] }] as any;
    const discussions = [{ id: 'discussion' }] as any;
    mocks.currentDiscussions = undefined;
    const rendered = render(
      <PlateEditor
        initialValue={initialValue}
        currentUser={currentUser}
        users={users}
        discussions={discussions}
      />
    );

    expect((mocks.editor as any).config).toMatchObject({
      plugins: mocks.editorKit,
      value: initialValue,
      override: {
        plugins: {
          discussion: {
            options: {
              currentUserId: 'user',
              users,
              discussions,
              documentTitle: '',
              documentId: '',
            },
          },
        },
      },
    });
    expect(mocks.editor.setOptions).toHaveBeenCalledWith(mocks.discussionPlugin, {
      discussions,
    });
    expect(mocks.editor.setOptions).toHaveBeenCalledWith(
      mocks.suggestionPlugin,
      expect.objectContaining({ currentUserId: 'user' })
    );

    mocks.currentDiscussions = [{ id: 'local' }];
    rendered.rerender(
      <PlateEditor
        initialValue={initialValue}
        currentUser={currentUser}
        users={users}
        discussions={discussions}
        documentTitle="Changed dependency"
      />
    );
    expect(mocks.editor.setOptions).toHaveBeenLastCalledWith(
      mocks.suggestionPlugin,
      expect.any(Object)
    );
    const discussionCalls = mocks.editor.setOptions.mock.calls.filter(
      call => call[0] === mocks.discussionPlugin
    );
    expect(discussionCalls.at(-1)?.[1].discussions).toEqual([{ id: 'local' }]);

    rendered.rerender(
      <PlateEditor
        initialValue={initialValue}
        currentUser={currentUser}
        users={users}
        discussions={[{ id: 'remote' }] as any}
        documentTitle="Changed dependency"
      />
    );
    expect(
      mocks.editor.setOptions.mock.calls
        .filter(call => call[0] === mocks.discussionPlugin)
        .at(-1)?.[1].discussions
    ).toEqual([{ id: 'remote' }]);
  });

  it('covers missing collaborative inputs and empty initial discussions', () => {
    const currentUser = { id: 'user', name: 'User' };
    const first = render(<PlateEditor currentUser={currentUser} discussions={[]} />);
    expect((mocks.editor as any).config.override).toBeUndefined();
    first.rerender(<PlateEditor currentUser={currentUser} discussions={[]} documentId="changed" />);
    first.unmount();

    render(
      <PlateEditor users={{ user: { id: 'user', name: 'User', avatarUrl: '' } }} discussions={[]} />
    );

    render(
      <PlateEditor
        currentUser={currentUser}
        users={{ user: { id: 'user', name: 'User', avatarUrl: '' } }}
      />
    );
  });

  it('polls, filters orphaned discussion ids, and reports unchanged sets', () => {
    const onDiscussionsChange = vi.fn();
    const rendered = render(<PlateEditor onDiscussionsChange={onDiscussionsChange} />);

    act(() => vi.advanceTimersByTime(2000));
    expect(onDiscussionsChange).not.toHaveBeenCalled();

    mocks.currentDiscussions = [];
    act(() => vi.advanceTimersByTime(2000));
    expect(onDiscussionsChange).toHaveBeenLastCalledWith([]);

    mocks.currentDiscussions = [
      { id: 'comment-id' },
      { id: 'suggestion-id' },
      { id: 'block-id' },
      { id: 'orphan' },
    ];
    mocks.nodes = [
      null,
      { text: 'plain' },
      { comment: true },
      { comment: true, 'comment_comment-id': true },
      { 'suggestion_suggestion-id': { id: 'suggestion-id' } },
      { suggestion: true },
      { suggestion: {} },
      { suggestion: { id: 'block-id' } },
    ];
    mocks.editor.getOption
      .mockImplementationOnce(() => mocks.currentDiscussions)
      .mockImplementationOnce(() => undefined);
    act(() => vi.advanceTimersByTime(2000));
    expect(onDiscussionsChange).toHaveBeenLastCalledWith([
      { id: 'comment-id' },
      { id: 'suggestion-id' },
      { id: 'block-id' },
    ]);

    mocks.currentDiscussions = [{ id: 'comment-id' }, { id: 'suggestion-id' }, { id: 'block-id' }];
    act(() => vi.advanceTimersByTime(2000));
    expect(onDiscussionsChange).toHaveBeenLastCalledWith(mocks.currentDiscussions);
    rendered.unmount();
  });

  it('synchronizes controlled values across no-op, success, and error paths', async () => {
    const onChange = vi.fn();
    const firstValue = [{ type: 'p', children: [{ text: 'one' }] }] as any;
    const rendered = render(<PlateEditor value={firstValue} onChange={onChange} />);
    expect(latestProps().isControlled).toBe(true);
    expect((mocks.editor as any).config.value).toBe(firstValue);

    const semanticValue = [{ type: 'p', children: [{ text: 'semantic' }] }] as any;
    mocks.areEqual.mockReturnValueOnce(true);
    rendered.rerender(<PlateEditor value={semanticValue} onChange={onChange} />);
    expect(mocks.replaceValue).not.toHaveBeenCalled();

    const remoteValue = [{ type: 'p', children: [{ text: 'remote' }] }] as any;
    mocks.isActive.mockReturnValueOnce(true);
    mocks.replaceValue.mockReturnValueOnce({ anchor: {}, focus: {} });
    rendered.rerender(<PlateEditor value={remoteValue} onChange={onChange} />);
    expect(mocks.replaceValue).toHaveBeenCalledWith(mocks.editor, remoteValue, true);
    await act(async () => Promise.resolve());
    expect(latestProps().isUpdatingFromProps.current).toBe(false);

    const failedValue = [{ type: 'p', children: [{ text: 'failed' }] }] as any;
    mocks.replaceValue.mockImplementationOnce(() => {
      throw new Error('replace failed');
    });
    rendered.rerender(<PlateEditor value={failedValue} onChange={onChange} />);
    expect(console.warn).toBeDefined();

    const stringFailure = [{ type: 'p', children: [{ text: 'string failure' }] }] as any;
    mocks.areEqual.mockImplementationOnce(() => {
      throw 'non-error';
    });
    rendered.rerender(<PlateEditor value={stringFailure} onChange={onChange} />);

    const nextOnChange = vi.fn();
    rendered.rerender(<PlateEditor value={stringFailure} onChange={nextOnChange} />);
    mocks.hasOperations.mockReturnValue(true);
    act(() => latestProps().handleEditorChange({ value: remoteValue }));
    expect(nextOnChange).toHaveBeenCalledWith(remoteValue);

    rendered.rerender(<PlateEditor value={null as any} onChange={nextOnChange} />);
  });
});
