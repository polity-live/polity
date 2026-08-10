/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ordered: false,
  readOnly: false,
  focused: false,
  selected: false,
  dragging: false,
  suggestionText: undefined as string | undefined,
  insertEmoji: vi.fn(),
  checkboxProps: { 'aria-label': 'todo-checkbox' },
  emojiPickerProps: undefined as unknown,
}));

vi.mock('@platejs/list', () => ({ isOrderedList: () => mocks.ordered }));
vi.mock('@platejs/list/react', () => ({
  useTodoListElementState: ({ element }: { element: unknown }) => ({ element }),
  useTodoListElement: () => ({ checkboxProps: mocks.checkboxProps }),
}));
vi.mock('@platejs/dnd', () => ({
  useDraggable: () => ({ isDragging: mocks.dragging, handleRef: vi.fn() }),
}));
vi.mock('@platejs/media/react', () => ({
  Image: (props: any) => <img {...props} alt={props.alt ?? 'image'} />,
  ImagePlugin: {},
  useMediaState: () => ({
    align: undefined,
    focused: mocks.focused,
    readOnly: mocks.readOnly,
    selected: mocks.selected,
  }),
}));
vi.mock('@platejs/resizable', () => ({
  ResizableProvider: ({ children }: { children: ReactNode }) => children,
  useResizableValue: () => 320,
}));
vi.mock('@platejs/ai/react', () => ({ CopilotPlugin: {} }));
vi.mock('@platejs/emoji', () => ({
  insertEmoji: (...args: unknown[]) => mocks.insertEmoji(...args),
}));
vi.mock('platejs/react', () => ({
  withHOC: (_provider: unknown, Component: unknown) => Component,
  PlateElement: ({
    as: Tag = 'div',
    children,
    attributes,
    element: _element,
    editor: _editor,
    ...props
  }: any) => (
    <Tag {...attributes} {...props}>
      {children}
    </Tag>
  ),
  PlateLeaf: ({ children, attributes, leaf: _leaf, ...props }: any) => (
    <span {...attributes} {...props}>
      {children}
    </span>
  ),
  useReadOnly: () => mocks.readOnly,
  useFocused: () => mocks.focused,
  useSelected: () => mocks.selected,
  usePluginOption: () => mocks.suggestionText,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/ui/ui/checkbox.tsx', () => ({
  Checkbox: (props: any) => <button type="button" {...props} />,
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/layout', () => ({
  Toolbar: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));
vi.mock('@/features/shared/ui/rich-text', () => ({
  InlineCombobox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InlineComboboxContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InlineComboboxEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InlineComboboxGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InlineComboboxInput: () => <input aria-label="emoji-input" />,
  InlineComboboxItem: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Resizable: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizeHandle: (props: any) => <div {...props} />,
  mediaResizeHandleVariants: ({ direction }: { direction: string }) => direction,
}));
vi.mock('../caption.tsx', () => ({
  Caption: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CaptionTextarea: (props: any) => <textarea aria-label="caption" {...props} />,
}));
vi.mock('../media-toolbar.tsx', () => ({
  MediaToolbar: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../emoji-toolbar-button.tsx', () => ({
  EmojiPopover: ({ children, control }: { children: ReactNode; control: ReactNode }) => (
    <div>
      {control}
      {children}
    </div>
  ),
  EmojiPicker: (props: unknown) => {
    mocks.emojiPickerProps = props;
    return <div data-testid="emoji-picker" />;
  },
}));

import { BlockList } from '../block-list';
import { BlockSelectionView } from '../BlockSelectionView';
import { CalloutElementView } from '../CalloutElementView';
import { CommentLeafView } from '../CommentLeafView';
import { EmojiInputElementView } from '../EmojiInputElementView';
import { FloatingToolbarView } from '../FloatingToolbarView';
import { GhostTextView } from '../GhostTextView';
import { HrElement } from '../hr-node';
import { ImageElement } from '../media-image-node';
import { ToggleElementView } from '../ToggleElementView';

const props = (element: Record<string, unknown>, children: ReactNode = <span>child</span>) =>
  ({ element, children, attributes: { alt: 'asset' }, editor: {} }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ordered = false;
  mocks.readOnly = false;
  mocks.focused = false;
  mocks.selected = false;
  mocks.dragging = false;
  mocks.suggestionText = undefined;
});

afterEach(cleanup);

describe('interactive Plate surfaces branch campaign A02', () => {
  it('wraps only list nodes and renders normal, ordered and todo list alternatives', () => {
    expect(BlockList(props({}))).toBeUndefined();
    const normal = BlockList(props({ listStyleType: 'disc' }))!;
    const view = render(normal(props({ listStyleType: 'disc' })));
    expect(view.container.querySelector('ul')).toBeTruthy();
    view.unmount();

    mocks.ordered = true;
    const ordered = BlockList(props({ listStyleType: 'decimal' }))!;
    const second = render(ordered(props({ listStyleType: 'decimal', listStart: 4 })));
    expect(second.container.querySelector('ol')?.getAttribute('start')).toBe('4');
    second.unmount();

    const todo = BlockList(props({ listStyleType: 'todo' }))!;
    const third = render(todo(props({ listStyleType: 'todo', checked: false })));
    expect(screen.getByRole('button', { name: 'todo-checkbox' })).toBeTruthy();
    mocks.readOnly = true;
    third.rerender(todo(props({ listStyleType: 'todo', checked: true })));
    expect(third.container.querySelector('li')?.className).toContain('line-through');
    expect(screen.getByRole('button').className).toContain('pointer-events-none');
  });

  it('shows selection only for selected non-table-row blocks and reflects dragging', () => {
    const { container, rerender } = render(
      <BlockSelectionView
        props={{ plugin: { key: 'p' } }}
        isBlockSelected={false}
        isDragging={false}
      />
    );
    expect(container.firstChild).toBeNull();
    rerender(
      <BlockSelectionView props={{ plugin: { key: 'tr' } }} isBlockSelected isDragging={false} />
    );
    expect(container.firstChild).toBeNull();
    rerender(<BlockSelectionView props={{ plugin: { key: 'p' } }} isBlockSelected isDragging />);
    expect(container.firstElementChild?.className).toContain('opacity-0');
    rerender(
      <BlockSelectionView props={{ plugin: { key: 'p' } }} isBlockSelected isDragging={false} />
    );
    expect(container.firstElementChild?.className).toContain('opacity-100');
  });

  it('renders custom and fallback callout icons and forwards picker inputs', () => {
    const base = {
      attributes: {},
      children: <span>callout</span>,
      className: '',
      emojiPickerState: { searchValue: 'x' },
      emojiToolbarDropdownProps: {},
      calloutProps: { isOpen: true },
    } as any;
    const view = render(<CalloutElementView {...base} props={props({ icon: '' })} />);
    expect(screen.getByRole('button').textContent).toBe('💡');
    view.rerender(<CalloutElementView {...base} props={props({ icon: '🚀' })} />);
    expect(screen.getByRole('button').textContent).toBe('🚀');
    expect(mocks.emojiPickerProps).toMatchObject({ searchValue: 'x', isOpen: true });
  });

  it('handles comment overlap, hover, active, null ids, and pointer events', () => {
    const setOption = vi.fn();
    const base = {
      props: { attributes: {} },
      children: 'comment',
      leaf: {},
      api: {},
      setOption,
      hoverId: null,
      activeId: null,
    };
    const view = render(
      <CommentLeafView
        {...base}
        currentId={undefined}
        isActive={false}
        isHover={false}
        isOverlapping={false}
      />
    );
    const leaf = screen.getByText('comment');
    fireEvent.click(leaf);
    fireEvent.mouseEnter(leaf);
    fireEvent.mouseLeave(leaf);
    expect(setOption).toHaveBeenNthCalledWith(1, 'activeId', null);
    expect(setOption).toHaveBeenNthCalledWith(2, 'hoverId', null);
    expect(setOption).toHaveBeenNthCalledWith(3, 'hoverId', null);
    view.rerender(<CommentLeafView {...base} currentId="c1" isActive isHover isOverlapping />);
    expect(screen.getByText('comment').className).toContain('bg-highlight/45');
  });

  it('shows pending/non-pending emoji results and inserts a chosen emoji', () => {
    const emoji = { id: 'wave', name: 'wave', skins: [{ native: '👋' }] };
    const base = { ...props({}), value: '', setValue: vi.fn() };
    const view = render(<EmojiInputElementView {...base} isPending filteredEmojis={[]} />);
    expect(document.body.textContent).not.toContain('no_results');
    view.rerender(
      <EmojiInputElementView {...base} isPending={false} filteredEmojis={[emoji] as never} />
    );
    expect(document.body.textContent).toContain('no_results');
    fireEvent.click(screen.getByRole('button', { name: /wave/i }));
    expect(mocks.insertEmoji).toHaveBeenCalledWith(base.editor, emoji);
  });

  it('hides or displays floating toolbar and ghost text alternatives', () => {
    const toolbar = render(
      <FloatingToolbarView
        children="tools"
        className="extra"
        state={{}}
        props={{}}
        editorId="e"
        focusedEditorId="e"
        isFloatingLinkOpen={false}
        isAIChatOpen={false}
        floatingToolbarState={{}}
        clickOutsideRef={vi.fn()}
        hidden
        rootProps={{}}
        floatingRef={vi.fn()}
        ref={vi.fn()}
      />
    );
    expect(toolbar.container.firstChild).toBeNull();
    toolbar.rerender(
      <FloatingToolbarView
        children="tools"
        className="extra"
        state={{}}
        props={{}}
        editorId="e"
        focusedEditorId="e"
        isFloatingLinkOpen={false}
        isAIChatOpen={false}
        floatingToolbarState={{}}
        clickOutsideRef={vi.fn()}
        hidden={false}
        rootProps={{}}
        floatingRef={vi.fn()}
        ref={vi.fn()}
      />
    );
    expect(screen.getByText('tools')).toBeTruthy();

    const ghost = render(<GhostTextView element={{}} isSuggested={false} />);
    expect(ghost.container.firstChild).toBeNull();
    ghost.rerender(<GhostTextView element={{}} isSuggested />);
    expect(ghost.container.textContent).toBe('');
    mocks.suggestionText = 'continue';
    ghost.rerender(<GhostTextView element={{}} isSuggested />);
    expect(screen.getByText('continue')).toBeTruthy();
  });

  it('renders horizontal rule focus/read-only permutations', () => {
    const view = render(<HrElement {...props({})} />);
    expect(view.container.querySelector('hr')?.className).toContain('cursor-pointer');
    mocks.focused = true;
    mocks.selected = true;
    mocks.readOnly = true;
    view.rerender(<HrElement {...props({})} />);
    expect(view.container.querySelector('hr')?.className).toContain('ring-2');
    expect(view.container.querySelector('hr')?.className).not.toContain('cursor-pointer');
  });

  it('renders image focus/drag/read-only alternatives and prevents caption focus', () => {
    const view = render(<ImageElement {...props({})} />);
    expect(view.container.querySelector('img')?.className).not.toContain('ring-2');
    mocks.focused = true;
    mocks.selected = true;
    mocks.dragging = true;
    mocks.readOnly = true;
    view.rerender(<ImageElement {...props({})} />);
    expect(view.container.querySelector('img')?.className).toContain('ring-2');
    expect(view.container.querySelector('img')?.className).toContain('opacity-50');
    fireEvent.focus(screen.getByRole('textbox', { name: 'caption' }));
  });

  it('renders closed and open toggle rotations', () => {
    const view = render(
      <ToggleElementView props={props({})} element={{}} state={{}} buttonProps={{}} open={false} />
    );
    expect(view.container.querySelector('svg')?.getAttribute('class')).toContain('rotate-0');
    view.rerender(
      <ToggleElementView props={props({})} element={{}} state={{}} buttonProps={{}} open />
    );
    expect(view.container.querySelector('svg')?.getAttribute('class')).toContain('rotate-90');
  });
});
