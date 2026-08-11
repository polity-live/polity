/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  activeCommentId: undefined as string | undefined,
  activeSuggestionId: undefined as string | undefined,
  hidden: false,
  editing: false,
  linkEntry: undefined as any,
  insertState: vi.fn(),
  editState: vi.fn(),
  blockApi: { blockMenu: { hide: vi.fn(), show: vi.fn() } },
  blockEditor: undefined as any,
  aiShow: vi.fn(),
  setNodes: vi.fn(),
  isTouch: false,
  readOnly: false,
}));

vi.mock('platejs', () => ({
  KEYS: {
    p: 'p',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    blockquote: 'blockquote',
    listType: 'listType',
    comment: 'comment',
    suggestion: 'suggestion',
    link: 'link',
  },
}));
vi.mock('@platejs/floating', () => ({
  offset: (value: number) => ({ offset: value }),
  flip: (value: unknown) => ({ flip: value }),
}));
vi.mock('@platejs/link', () => ({ getLinkAttributes: () => ({ href: '/linked' }) }));
vi.mock('@platejs/link/react', () => ({
  FloatingLinkUrlInput: (props: any) => <input aria-label="url" {...props} />,
  useFloatingLinkInsertState: (options: unknown) => {
    state.insertState(options);
    return options;
  },
  useFloatingLinkInsert: () => ({
    hidden: state.hidden,
    props: { style: { top: 1 } },
    ref: vi.fn(),
    textInputProps: { 'aria-label': 'text' },
  }),
  useFloatingLinkEditState: (options: unknown) => {
    state.editState(options);
    return { ...(options as object), isEditing: state.editing };
  },
  useFloatingLinkEdit: () => ({
    editButtonProps: {},
    props: { style: { top: 2 } },
    ref: vi.fn(),
    unlinkButtonProps: {},
  }),
}));
vi.mock('platejs/react', () => ({
  usePluginOption: (plugin: { key: string }) =>
    plugin.key === 'suggestion' ? state.activeSuggestionId : state.activeCommentId,
  useFormInputProps: () => ({ onSubmit: vi.fn() }),
  useEditorRef: () => ({ api: { node: () => state.linkEntry }, getType: () => 'link' }),
  useEditorSelection: () => ({ anchor: 1 }),
  useEditorPlugin: () => ({ api: state.blockApi, editor: state.blockEditor }),
  usePlateState: () => [state.readOnly],
}));
vi.mock('@platejs/selection/react', () => ({
  BlockMenuPlugin: { key: 'menu' },
  BlockSelectionPlugin: { key: 'selection' },
  BLOCK_CONTEXT_MENU_ID: 'block-menu',
}));
vi.mock('@platejs/ai/react', () => ({ AIChatPlugin: { key: 'ai' } }));
vi.mock('@/features/shared/hooks/use-is-touch-device.ts', () => ({
  useIsTouchDevice: () => state.isTouch,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({ buttonVariants: () => 'button' }));
vi.mock('@/features/shared/ui/ui/separator.tsx', () => ({ Separator: () => <hr /> }));
vi.mock('@/features/shared/ui/ui/context-menu.tsx', () => ({
  ContextMenu: ({ children, onOpenChange }: any) => (
    <div>
      <button aria-label="open-change-false" onClick={() => onOpenChange(false)} />
      <button aria-label="open-change-true" onClick={() => onOpenChange(true)} />
      {children}
    </div>
  ),
  ContextMenuContent: ({ children, onCloseAutoFocus }: any) => (
    <div>
      <button aria-label="close-menu" onClick={onCloseAutoFocus} />
      {children}
    </div>
  ),
  ContextMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  ContextMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ContextMenuSubContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ContextMenuSubTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  ContextMenuTrigger: ({ children, onContextMenu }: any) => (
    <div data-testid="context-trigger" onContextMenu={onContextMenu}>
      {children}
    </div>
  ),
}));

import { BlockContextMenuView } from '../BlockContextMenuView';
import { LinkFloatingToolbar } from '../link-toolbar';
import { useBlockContextMenuController } from '../useBlockContextMenuController';
import { act, renderHook } from '@testing-library/react';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  state.activeCommentId = undefined;
  state.activeSuggestionId = undefined;
  state.hidden = false;
  state.editing = false;
  state.linkEntry = undefined;
  state.isTouch = false;
  state.readOnly = false;
  state.blockEditor = {
    getApi: vi.fn(() => ({
      blockSelection: { focus: vi.fn(), getNodes: vi.fn(() => []) },
      aiChat: { show: state.aiShow },
    })),
    getTransforms: vi.fn(() => ({
      blockSelection: {
        removeNodes: vi.fn(),
        duplicate: vi.fn(),
        setIndent: vi.fn(),
        setNodes: state.setNodes,
      },
    })),
    tf: { focus: vi.fn(), unsetNodes: vi.fn(), toggleBlock: vi.fn() },
  };
});
afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('LinkFloatingToolbar', () => {
  it('covers hidden, insert/edit, placement and link-entry states', () => {
    state.hidden = true;
    const view = render(<LinkFloatingToolbar />);
    expect(view.container.firstElementChild).toBeNull();
    state.hidden = false;
    state.editing = true;
    state.activeSuggestionId = 'suggestion';
    view.rerender(
      <LinkFloatingToolbar state={{ floatingOptions: { strategy: 'fixed' } } as never} />
    );
    expect(screen.getAllByLabelText('url')).toHaveLength(2);
    expect(state.insertState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        floatingOptions: expect.objectContaining({ placement: 'top-start', strategy: 'fixed' }),
      })
    );
    state.editing = false;
    state.activeSuggestionId = undefined;
    state.activeCommentId = 'comment';
    state.linkEntry = [{ url: '/linked' }];
    view.rerender(<LinkFloatingToolbar />);
    fireEvent.mouseOver(screen.getByLabelText('plateJs.toolbar.openInNewTab'));
    expect(screen.getByLabelText('plateJs.toolbar.openInNewTab').getAttribute('href')).toBe(
      '/linked'
    );
    state.activeCommentId = undefined;
    state.linkEntry = undefined;
    view.rerender(<LinkFloatingToolbar />);
    expect(state.insertState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        floatingOptions: expect.objectContaining({ placement: 'bottom-start' }),
      })
    );
    expect(screen.getByLabelText('plateJs.toolbar.openInNewTab').getAttribute('href')).toBeNull();
  });
});

describe('BlockContextMenuView', () => {
  const props = () => ({
    children: <span>content</span>,
    api: state.blockApi,
    editor: state.blockEditor,
    value: null,
    setValue: vi.fn(),
    isTouch: state.isTouch,
    readOnly: state.readOnly,
    t: (key: string) => key,
    handleTurnInto: vi.fn(),
    handleAlign: vi.fn(),
  });

  it('returns children on touch and handles allowed/blocked context targets and open changes', () => {
    state.isTouch = true;
    const view = render(<BlockContextMenuView {...props()} isTouch />);
    expect(screen.getByText('content')).toBeTruthy();
    state.isTouch = false;
    view.rerender(<BlockContextMenuView {...props()} />);
    const trigger = screen.getByTestId('context-trigger');
    fireEvent.contextMenu(trigger, { clientX: 3, clientY: 4 });
    expect(state.blockApi.blockMenu.show).toHaveBeenCalledWith('block-menu', { x: 3, y: 4 });
    const editorTarget = document.createElement('div');
    editorTarget.dataset.slateEditor = 'true';
    trigger.append(editorTarget);
    fireEvent.contextMenu(editorTarget);
    view.rerender(<BlockContextMenuView {...props()} readOnly />);
    fireEvent.contextMenu(screen.getByTestId('context-trigger'));
    fireEvent.click(screen.getByLabelText('open-change-true'));
    fireEvent.click(screen.getByLabelText('open-change-false'));
    act(() => vi.runAllTimers());
    expect(state.blockApi.blockMenu.hide).toHaveBeenCalled();
  });

  it('runs close focus AI/null branches and all menu actions', () => {
    const base = props();
    const view = render(<BlockContextMenuView {...base} value="askAI" />);
    fireEvent.click(screen.getByLabelText('close-menu'));
    expect(state.aiShow).toHaveBeenCalled();
    view.rerender(<BlockContextMenuView {...base} value={null} />);
    fireEvent.click(screen.getByLabelText('close-menu'));
    for (const label of [
      'plateJs.blockContextMenu.askAI',
      'plateJs.blockContextMenu.delete',
      'plateJs.blockContextMenu.duplicate',
      'plateJs.blockContextMenu.paragraph',
      'plateJs.headings.heading1',
      'plateJs.blockContextMenu.heading2',
      'plateJs.blockContextMenu.heading3',
      'plateJs.blockContextMenu.blockquote',
      'plateJs.blockContextMenu.indent',
      'plateJs.blockContextMenu.outdent',
      'plateJs.blockContextMenu.alignLeft',
      'plateJs.blockContextMenu.alignCenter',
      'plateJs.blockContextMenu.alignRight',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
    }
    expect(base.handleTurnInto).toHaveBeenCalledTimes(5);
    expect(base.handleAlign).toHaveBeenCalledTimes(3);
  });
});

describe('useBlockContextMenuController', () => {
  it('turns list/non-list nodes and aligns block selections', () => {
    const nodes = [
      [{ listType: 'ul' }, [0]],
      [{}, [1]],
    ];
    state.blockEditor.getApi.mockReturnValue({ blockSelection: { getNodes: () => nodes } });
    const { result } = renderHook(() => useBlockContextMenuController({ children: 'child' }));
    act(() => result.current.handleTurnInto('p'));
    expect(state.blockEditor.tf.unsetNodes).toHaveBeenCalledTimes(1);
    expect(state.blockEditor.tf.toggleBlock).toHaveBeenCalledTimes(2);
    act(() => result.current.handleAlign('center'));
    expect(state.setNodes).toHaveBeenCalledWith({ align: 'center' });
  });
});
