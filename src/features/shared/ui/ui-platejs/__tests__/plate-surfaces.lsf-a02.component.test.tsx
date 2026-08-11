/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  childProps: [] as { name: string; props: Record<string, unknown> }[],
  focus: vi.fn(),
  setDraft: vi.fn(),
  setOption: vi.fn(),
  table: {
    insert: vi.fn(),
    merge: vi.fn(),
    split: vi.fn(),
    insertRow: vi.fn(),
    removeRow: vi.fn(),
    insertColumn: vi.fn(),
    removeColumn: vi.fn(),
    remove: vi.fn(),
  },
}));

function view(name: string) {
  return (props: Record<string, unknown>) => {
    mocks.childProps.push({ name, props });
    return <div data-testid={name}>{props.children as React.ReactNode}</div>;
  };
}

const editor = {
  api: {
    some: vi.fn(() => true),
    comment: { nodeId: vi.fn(() => 'comment') },
  },
  getType: vi.fn((key: string) => key),
  getTransforms: vi.fn(() => ({ comment: { setDraft: mocks.setDraft } })),
  tf: { focus: mocks.focus },
};
const tableTf = {
  insert: {
    table: mocks.table.insert,
    tableRow: mocks.table.insertRow,
    tableColumn: mocks.table.insertColumn,
  },
  remove: {
    table: mocks.table.remove,
    tableRow: mocks.table.removeRow,
    tableColumn: mocks.table.removeColumn,
  },
  table: { merge: mocks.table.merge, split: mocks.table.split },
};

vi.mock('platejs', () => ({ KEYS: { table: 'table', codeBlock: 'code-block' } }));
vi.mock('platejs/react', () => ({
  PlateElement: ({ children, as: Comp = 'div', attributes: _attributes, ...props }: any) => (
    <Comp {...props}>{children}</Comp>
  ),
  PlateLeaf: ({ children, as: Comp = 'span', ...props }: any) => <Comp {...props}>{children}</Comp>,
  useEditorPlugin: () => ({ api: editor.api, editor, setOption: mocks.setOption, tf: tableTf }),
  usePluginOption: (_plugin: unknown, option: string) =>
    option === 'isDragging' ? false : option === 'isSuggested' ? true : 'comment',
  useEditorSelector: (selector: (value: typeof editor) => unknown) => selector(editor),
  useEditorRef: () => editor,
  useElement: () => ({ id: 'element' }),
  useReadOnly: () => false,
  useMarkToolbarButtonState: (options: unknown) => ({ options }),
  useMarkToolbarButton: (state: unknown) => ({ props: { state } }),
  withHOC: (_Provider: unknown, Component: React.ComponentType<any>) => Component,
}));
vi.mock('platejs/static', () => ({
  SlateElement: ({
    children,
    as: Comp = 'div',
    element: _element,
    editor: _editor,
    ...props
  }: any) => <Comp {...props}>{children}</Comp>,
  SlateLeaf: ({ children, as: Comp = 'span', leaf: _leaf, text: _text, ...props }: any) => (
    <Comp {...props}>{children}</Comp>
  ),
}));
vi.mock('@platejs/dnd', () => ({ DndPlugin: {} }));
vi.mock('@platejs/selection/react', () => ({
  useBlockSelected: () => true,
  useCursorOverlay: () => ({ cursors: [{ id: 'cursor' }] }),
}));
vi.mock('@platejs/ai/react', () => ({ CopilotPlugin: {} }));
vi.mock('@platejs/comment', () => ({ getCommentCount: () => 2 }));
vi.mock('@/features/shared/ui/kit-platejs/comment-kit.tsx', () => ({ commentPlugin: {} }));
vi.mock('@platejs/indent/react', () => ({
  useIndentButton: () => ({ props: { 'data-indent': true } }),
  useOutdentButton: () => ({ props: { 'data-outdent': true } }),
}));
vi.mock('@platejs/link/react', () => ({
  useLinkToolbarButtonState: () => ({ open: false }),
  useLinkToolbarButton: (state: unknown) => ({ props: { state } }),
}));
vi.mock('@platejs/toggle/react', () => ({
  useToggleToolbarButtonState: () => ({ open: false }),
  useToggleToolbarButton: (state: unknown) => ({ props: { state } }),
}));
vi.mock('@platejs/media/react', () => ({
  useMediaState: () => ({ name: 'file.txt', unsafeUrl: '/file.txt' }),
}));
vi.mock('@platejs/resizable', () => ({ ResizableProvider: ({ children }: any) => children }));
vi.mock('@platejs/table/react', () => ({
  TablePlugin: {},
  useTableMergeState: () => ({ canMerge: true, canSplit: true }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/ui/layout', () => ({
  Toolbar: ({ children }: any) => <div>{children}</div>,
  ToolbarButton: ({ children, tooltip, ...props }: any) => (
    <button aria-label={tooltip} {...props}>
      {children}
    </button>
  ),
  ToolbarMenuGroup: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children, onCloseAutoFocus }: any) => (
    <div data-close={Boolean(onCloseAutoFocus)}>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, ...props }: any) => (
    <button onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  DropdownMenuRadioItem: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DropdownMenuSub: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@radix-ui/react-dropdown-menu', () => ({
  DropdownMenuItemIndicator: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('../caption.tsx', () => ({
  Caption: ({ children }: any) => <div>{children}</div>,
  CaptionTextarea: (props: any) => <textarea {...props} />,
}));

vi.mock('@/features/shared/hooks/useAlignToolbarButtonController', () => ({
  useAlignToolbarButtonController: () => ({ marker: 'align' }),
}));
vi.mock('@/features/shared/hooks/useEmojiInputElementController', () => ({
  useEmojiInputElementController: () => ({ marker: 'emoji' }),
}));
vi.mock('@/features/shared/hooks/useHistoryToolbarButtonController', () => ({
  useHistoryToolbarButtonController: (action: string) => ({ action }),
}));
vi.mock('@/features/shared/hooks/useImportToolbarButtonController', () => ({
  useImportToolbarButtonController: () => ({ marker: 'import' }),
}));
vi.mock('@/features/shared/hooks/useLineHeightToolbarButtonController', () => ({
  useLineHeightToolbarButtonController: () => ({ marker: 'line-height' }),
}));
vi.mock('@/features/shared/hooks/useMediaToolbarController', () => ({
  useMediaToolbarController: () => ({ marker: 'media' }),
}));
vi.mock('../useBlockContextMenuController', () => ({
  useBlockContextMenuController: (props: unknown) => ({ marker: 'block-context', props }),
}));
vi.mock('../useFloatingToolbarController', () => ({
  useFloatingToolbarController: (props: unknown) => ({ marker: 'floating', props }),
}));
vi.mock('../useTocElementController', () => ({
  useTocElementController: (props: unknown) => ({ marker: 'toc', props }),
}));

vi.mock('../AlignToolbarButtonView', () => ({ AlignToolbarButtonView: view('align-view') }));
vi.mock('../BlockContextMenuView', () => ({ BlockContextMenuView: view('block-context-view') }));
vi.mock('../BlockSelectionView', () => ({ BlockSelectionView: view('block-selection-view') }));
vi.mock('../CommentLeafView', () => ({ CommentLeafView: view('comment-view') }));
vi.mock('../CursorOverlayView', () => ({ CursorOverlayView: view('cursor-view') }));
vi.mock('../EmojiInputElementView', () => ({ EmojiInputElementView: view('emoji-view') }));
vi.mock('../FloatingToolbarView', () => ({ FloatingToolbarView: view('floating-view') }));
vi.mock('../GhostTextView', () => ({ GhostTextView: view('ghost-view') }));
vi.mock('../ImportToolbarButtonView', () => ({ ImportToolbarButtonView: view('import-view') }));
vi.mock('../LineHeightToolbarButtonView', () => ({
  LineHeightToolbarButtonView: view('line-height-view'),
}));
vi.mock('../LinkToolbarButtonView', () => ({ LinkToolbarButtonView: view('link-toolbar-view') }));
vi.mock('../MediaToolbarView', () => ({ MediaToolbarView: view('media-view') }));
vi.mock('../TocElementView', () => ({ TocElementView: view('toc-view') }));
vi.mock('../ToggleToolbarButtonView', () => ({
  ToggleToolbarButtonView: view('toggle-toolbar-view'),
}));

import { AlignToolbarButton } from '../align-toolbar-button';
import { BlockContextMenu } from '../block-context-menu';
import { BlockSelection } from '../block-selection';
import { BlockquoteElement } from '../blockquote-node';
import {
  CodeBlockElementStatic,
  CodeLineElementStatic,
  CodeSyntaxLeafStatic,
} from '../code-block-node-static';
import { CodeLeaf } from '../code-node';
import { CommentLeaf } from '../comment-node';
import { CommentToolbarButton } from '../comment-toolbar-button';
import { CursorOverlay } from '../cursor-overlay';
import { EmojiInputElement } from '../emoji-node';
import { FloatingToolbar } from '../floating-toolbar';
import { GhostText } from '../ghost-text';
import { HighlightLeafStatic } from '../highlight-node-static';
import { RedoToolbarButton, UndoToolbarButton } from '../history-toolbar-button';
import { HistoryToolbarButtonView } from '../HistoryToolbarButtonView';
import { ImportToolbarButton } from '../import-toolbar-button';
import { IndentToolbarButton, OutdentToolbarButton } from '../indent-toolbar-button';
import { KbdLeafStatic } from '../kbd-node-static';
import { LineHeightToolbarButton } from '../line-height-toolbar-button';
import { LinkToolbarButton } from '../link-toolbar-button';
import { LinkElementView } from '../LinkElementView';
import { MarkToolbarButtonView } from '../MarkToolbarButtonView';
import { FileElementStatic } from '../media-file-node-static';
import { FileElement } from '../media-file-node';
import { MediaToolbar } from '../media-toolbar';
import { MoreToolbarButtonView } from '../MoreToolbarButtonView';
import { ParagraphElement } from '../paragraph-node';
import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderRightIcon,
  BorderTopIcon,
} from '../table-icons';
import { TableToolbarButton } from '../table-toolbar-button';
import { TableToolbarButtonView } from '../TableToolbarButtonView';
import { TocElement } from '../toc-node';
import { ToggleElementStatic } from '../toggle-node-static';
import { ToggleToolbarButton } from '../toggle-toolbar-button';
import { TurnIntoToolbarButtonView } from '../TurnIntoToolbarButtonView';
import { useLinkToolbarButtonController } from '../useLinkToolbarButtonController';
import { useMarkToolbarButtonController } from '../useMarkToolbarButtonController';
import { useToggleToolbarButtonController } from '../useToggleToolbarButtonController';

afterEach(cleanup);

describe('A02 Plate LSF surfaces', () => {
  const elementProps = {
    attributes: {},
    element: { id: 'element', name: 'file.txt', url: '/file.txt' },
    editor,
    leaf: { className: 'token' },
    children: <span>child</span>,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.childProps.length = 0;
  });

  it('renders controller-backed wrappers and all node/leaf surfaces', () => {
    render(
      <>
        <AlignToolbarButton />
        <BlockContextMenu>context</BlockContextMenu>
        <BlockSelection {...elementProps} />
        <BlockquoteElement {...elementProps} />
        <CodeBlockElementStatic {...elementProps} />
        <CodeLineElementStatic {...elementProps} />
        <CodeSyntaxLeafStatic {...elementProps} />
        <CodeLeaf {...elementProps} />
        <CommentLeaf {...elementProps} />
        <CursorOverlay />
        <EmojiInputElement {...elementProps} />
        <FloatingToolbar>floating</FloatingToolbar>
        <GhostText />
        <HighlightLeafStatic {...elementProps} />
        <KbdLeafStatic {...elementProps} />
        <LinkElementView props={elementProps} linkProps={{ href: '/link' }} />
        <FileElementStatic {...elementProps} />
        <FileElement {...elementProps} />
        <MediaToolbar plugin={{ key: 'media' } as never}>media</MediaToolbar>
        <ParagraphElement {...elementProps} />
        <TocElement {...elementProps} />
        <ToggleElementStatic {...elementProps} />
      </>
    );
    expect(screen.getByTestId('comment-view')).toBeTruthy();
    expect(screen.getByTestId('cursor-view')).toBeTruthy();
    expect(screen.getAllByText('file.txt')).toHaveLength(2);
  });

  it('renders toolbar wrappers, views, and invokes the comment action', () => {
    render(
      <>
        <CommentToolbarButton />
        <RedoToolbarButton />
        <UndoToolbarButton />
        <HistoryToolbarButtonView icon={<span>history</span>} />
        <ImportToolbarButton />
        <IndentToolbarButton />
        <OutdentToolbarButton />
        <LineHeightToolbarButton />
        <LinkToolbarButton />
        <MarkToolbarButtonView
          clear={null}
          nodeType="bold"
          props={{}}
          state={{}}
          buttonProps={{}}
        />
        <ToggleToolbarButton />
        <TableToolbarButton />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'plateJs.toolbar.comment' }));
    expect(mocks.setDraft).toHaveBeenCalledOnce();
    expect(screen.getByTestId('link-toolbar-view')).toBeTruthy();
  });

  it('executes hook adapter contracts', () => {
    expect(renderHook(() => useLinkToolbarButtonController({})).result.current).toMatchObject({
      props: {},
      state: { open: false },
    });
    expect(
      renderHook(() => useMarkToolbarButtonController({ nodeType: 'bold', clear: 'italic' })).result
        .current
    ).toMatchObject({ nodeType: 'bold', clear: 'italic' });
    expect(renderHook(() => useToggleToolbarButtonController({})).result.current).toMatchObject({
      props: {},
      state: { open: false },
    });
  });

  it('renders every table icon and executes every table menu action', () => {
    const t = (key: string) => key;
    render(
      <>
        <BorderAllIcon />
        <BorderBottomIcon />
        <BorderLeftIcon />
        <BorderNoneIcon />
        <BorderRightIcon />
        <BorderTopIcon />
        <TableToolbarButtonView
          props={{}}
          tableSelected
          editor={editor}
          tf={tableTf}
          t={t}
          open
          setOpen={vi.fn()}
          mergeState={{ canMerge: true, canSplit: true }}
        />
      </>
    );

    const picker = screen.getAllByRole('button').find(button => button.textContent === '0 x 0')!;
    const firstCell = picker.querySelector('.grid > div')!;
    fireEvent.mouseMove(firstCell);
    fireEvent.click(picker);
    for (const label of [
      'plateJs.toolbar.table.cell.merge',
      'plateJs.toolbar.table.cell.split',
      'plateJs.toolbar.table.row.insertBefore',
      'plateJs.toolbar.table.row.insertAfter',
      'plateJs.toolbar.table.row.delete',
      'plateJs.toolbar.table.column.insertBefore',
      'plateJs.toolbar.table.column.insertAfter',
      'plateJs.toolbar.table.column.delete',
      'plateJs.toolbar.table.delete',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
    }
    expect(mocks.table.insert).toHaveBeenCalledWith({ colCount: 1, rowCount: 1 }, { select: true });
    expect(mocks.focus).toHaveBeenCalledTimes(10);
  });

  it('renders more and turn-into menu callbacks', () => {
    const Icon = () => <i />;
    render(
      <>
        <MoreToolbarButtonView
          dropdownProps={{}}
          open
          onOpenChange={vi.fn()}
          labels={{
            more: 'more',
            keyboardInput: 'keyboard',
            superscript: 'super',
            subscript: 'sub',
          }}
          onKeyboardInput={vi.fn()}
          onSuperscript={vi.fn()}
          onSubscript={vi.fn()}
        />
        <TurnIntoToolbarButtonView
          dropdownProps={{}}
          open
          onOpenChange={vi.fn()}
          value="paragraph"
          selectedItem={{ label: 'paragraph', value: 'paragraph', Icon } as never}
          turnIntoItems={[{ label: 'heading', value: 'heading', Icon } as never]}
          labels={{ turnInto: 'turn into' }}
          onCloseAutoFocus={vi.fn()}
          onValueChange={vi.fn()}
        />
      </>
    );
    expect(screen.getByText('heading')).toBeTruthy();
  });
});
