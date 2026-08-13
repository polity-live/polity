/* @vitest-environment jsdom */

import React, { type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  readOnly: false,
  editor: { tf: { insertNodes: vi.fn() } },
  toastError: vi.fn(),
  modeContext: {
    currentMode: 'edit',
    modeDisabledReasons: {},
    onModeChange: vi.fn(),
    isOwnerOrCollaborator: true,
  } as any,
  modeController: {
    open: false,
    onOpenChange: vi.fn(),
    mode: 'edit',
    currentOption: { label: 'Edit', Icon: () => <span>icon</span> },
    labels: { editingMode: 'Editing mode', viewOnly: 'View only' },
    onModeChange: vi.fn(),
  } as any,
}));

vi.mock('platejs', () => ({
  KEYS: {
    highlight: 'highlight',
    bold: 'bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'strike',
    code: 'code',
    color: 'color',
    backgroundColor: 'background',
    img: 'img',
    video: 'video',
    audio: 'audio',
    file: 'file',
  },
  isUrl: (value: string) => value.startsWith('http'),
}));
vi.mock('platejs/react', () => ({
  useEditorReadOnly: () => state.readOnly,
  useEditorRef: () => state.editor,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => state.toastError(...args) } }));
vi.mock('@/features/shared/ui/kit-platejs/mode-context.tsx', () => ({
  useModeContext: () => state.modeContext,
}));
vi.mock('@/features/shared/hooks/useModeToolbarButtonController', () => ({
  useModeToolbarButtonController: () => state.modeController,
}));

vi.mock('../ai-toolbar-button.tsx', () => ({
  AIToolbarButton: ({ children }: any) => <button data-testid="AIToolbarButton">{children}</button>,
}));
vi.mock('../align-toolbar-button.tsx', () => ({
  AlignToolbarButton: () => <button data-testid="AlignToolbarButton" />,
}));
vi.mock('../chart-toolbar-button.tsx', () => ({
  ChartToolbarButton: () => <button data-testid="ChartToolbarButton" />,
}));
vi.mock('../comment-toolbar-button.tsx', () => ({
  CommentToolbarButton: () => <button data-testid="CommentToolbarButton" />,
}));
vi.mock('../emoji-toolbar-button.tsx', () => ({
  EmojiToolbarButton: () => <button data-testid="EmojiToolbarButton" />,
}));
vi.mock('../export-toolbar-button.tsx', () => ({
  ExportToolbarButton: ({ children }: any) => (
    <button data-testid="ExportToolbarButton">{children}</button>
  ),
}));
vi.mock('../font-color-toolbar-button.tsx', () => ({
  FontColorToolbarButton: ({ children }: any) => (
    <button data-testid="FontColorToolbarButton">{children}</button>
  ),
}));
vi.mock('../font-size-toolbar-button.tsx', () => ({
  FontSizeToolbarButton: () => <button data-testid="FontSizeToolbarButton" />,
}));
vi.mock('../history-toolbar-button.tsx', () => ({
  RedoToolbarButton: () => <button data-testid="RedoToolbarButton" />,
  UndoToolbarButton: () => <button data-testid="UndoToolbarButton" />,
}));
vi.mock('../import-toolbar-button.tsx', () => ({
  ImportToolbarButton: () => <button data-testid="ImportToolbarButton" />,
}));
vi.mock('../indent-toolbar-button.tsx', () => ({
  IndentToolbarButton: () => <button data-testid="IndentToolbarButton" />,
  OutdentToolbarButton: () => <button data-testid="OutdentToolbarButton" />,
}));
vi.mock('../insert-toolbar-button.tsx', () => ({
  InsertToolbarButton: () => <button data-testid="InsertToolbarButton" />,
}));
vi.mock('../line-height-toolbar-button.tsx', () => ({
  LineHeightToolbarButton: () => <button data-testid="LineHeightToolbarButton" />,
}));
vi.mock('../link-toolbar-button.tsx', () => ({
  LinkToolbarButton: () => <button data-testid="LinkToolbarButton" />,
}));
vi.mock('../list-toolbar-button.tsx', () => ({
  BulletedListToolbarButton: () => <button data-testid="BulletedListToolbarButton" />,
  NumberedListToolbarButton: () => <button data-testid="NumberedListToolbarButton" />,
  TodoListToolbarButton: () => <button data-testid="TodoListToolbarButton" />,
}));
vi.mock('../mark-toolbar-button.tsx', () => ({
  MarkToolbarButton: ({ children }: any) => (
    <button data-testid="MarkToolbarButton">{children}</button>
  ),
}));
vi.mock('../more-toolbar-button.tsx', () => ({
  MoreToolbarButton: () => <button data-testid="MoreToolbarButton" />,
}));
vi.mock('../table-toolbar-button.tsx', () => ({
  TableToolbarButton: () => <button data-testid="TableToolbarButton" />,
}));
vi.mock('../toggle-toolbar-button.tsx', () => ({
  ToggleToolbarButton: () => <button data-testid="ToggleToolbarButton" />,
}));
vi.mock('../turn-into-toolbar-button.tsx', () => ({
  TurnIntoToolbarButton: () => <button data-testid="TurnIntoToolbarButton" />,
}));
vi.mock('../equation-toolbar-button.tsx', () => ({
  InlineEquationToolbarButton: () => <button data-testid="InlineEquationToolbarButton" />,
}));
vi.mock('../suggestion-toolbar-button.tsx', () => ({
  SuggestionToolbarButton: () => <button data-testid="SuggestionToolbarButton" />,
}));
vi.mock('../caption.tsx', () => ({
  CaptionButton: ({ children }: any) => <button data-testid="CaptionButton">{children}</button>,
}));
vi.mock('../media-toolbar-button.tsx', () => ({
  MediaToolbarButton: () => <button data-testid="MediaToolbarButton" />,
}));
vi.mock('../editor-shortcuts', () => ({
  editorShortcuts: { bold: 'b', italic: 'i', underline: 'u', strikethrough: 's', code: 'c' },
}));
vi.mock('@/features/shared/ui/layout', () => ({
  ToolbarGroup: ({ children }: { children: ReactNode }) => (
    <div data-testid="group">{children}</div>
  ),
  ToolbarButton: ({ children, pressed: _pressed, isDropdown: _isDropdown, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  ToolbarSplitButton: ({ children, ...props }: any) => (
    <div role="group" {...props}>
      {children}
    </div>
  ),
  ToolbarSplitButtonPrimary: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  ToolbarSplitButtonSecondary: (props: any) => <button {...props}>secondary</button>,
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children, onClick }: any) => (
    <div data-testid="dropdown-content" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: any) => <button onClick={onSelect}>{children}</button>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/alert-dialog.tsx', () => ({
  AlertDialog: ({ children, onOpenChange }: any) => (
    <div>
      <button aria-label="close-dialog" onClick={() => onOpenChange(false)} />
      {children}
    </div>
  ),
  AlertDialogAction: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/input.tsx', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverAnchor: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children, onOpenAutoFocus }: any) => (
    <div>
      <button aria-label="popover-focus" onClick={onOpenAutoFocus} />
      {children}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({
    children,
    pressed: _pressed,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) => (
    <button {...props}>{children}</button>
  ),
  buttonVariants: () => 'button',
}));
vi.mock('@/features/shared/ui/ui/separator.tsx', () => ({ Separator: () => <hr /> }));
vi.mock('@platejs/media/react', () => ({
  FloatingMedia: {
    UrlInput: (props: any) => <input aria-label="media-url" {...props} />,
    EditButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  },
}));
vi.mock('@/features/shared/ui/status', () => ({
  EditingModeMenuItems: (props: any) => (
    <button onClick={() => props.onValueChange('edit')}>modes</button>
  ),
}));

import { FixedToolbarButtons } from '../fixed-toolbar-buttons';
import { FloatingToolbarButtonsView } from '../FloatingToolbarButtonsView';
import { FontSizeToolbarButtonView } from '../FontSizeToolbarButtonView';
import { MediaToolbarButtonView } from '../MediaToolbarButtonView';
import { MediaToolbarView } from '../MediaToolbarView';
import { ModeToolbarButton } from '../mode-toolbar-button';
import { ModeToolbarButtonView } from '../ModeToolbarButtonView';

beforeEach(() => {
  vi.clearAllMocks();
  state.readOnly = false;
  state.modeContext = {
    currentMode: 'edit',
    modeDisabledReasons: {},
    onModeChange: vi.fn(),
    isOwnerOrCollaborator: true,
  };
  state.modeController = {
    open: false,
    onOpenChange: vi.fn(),
    mode: 'edit',
    currentOption: { label: 'Edit', Icon: () => <span>icon</span> },
    labels: { editingMode: 'Editing mode', viewOnly: 'View only' },
    onModeChange: vi.fn(),
  };
});
afterEach(cleanup);

describe('fixed and floating toolbar variants', () => {
  it('covers wrapper defaults, mode visibility and read-only groups', () => {
    const view = render(<FixedToolbarButtons />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.getByTestId('UndoToolbarButton')).toBeTruthy();
    state.readOnly = true;
    view.rerender(<FixedToolbarButtons showModeToolbarButton={false} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByTestId('UndoToolbarButton')).toBeNull();

    view.rerender(<FloatingToolbarButtonsView readOnly={false} t={(key: string) => key} />);
    expect(screen.getByTestId('AIToolbarButton')).toBeTruthy();
    expect(screen.getByTestId('MoreToolbarButton')).toBeTruthy();
    view.rerender(<FloatingToolbarButtonsView readOnly t={(key: string) => key} />);
    expect(screen.queryByTestId('AIToolbarButton')).toBeNull();
    expect(screen.queryByTestId('MoreToolbarButton')).toBeNull();
  });
});

describe('font and media toolbar interactions', () => {
  it('covers every font-size control and keyboard branch', () => {
    const callbacks = {
      onBlur: vi.fn(),
      onDecrease: vi.fn(),
      onFocus: vi.fn(),
      onIncrease: vi.fn(),
      onInputChange: vi.fn(),
      onInputCommit: vi.fn(),
      onSelectFontSize: vi.fn(),
    };
    render(
      <FontSizeToolbarButtonView
        displayValue="16"
        fontSizes={['16', '20']}
        isFocused
        label="Font size"
        {...callbacks}
      />
    );
    const input = screen.getByRole('combobox', { name: 'Font size' });
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '18' } });
    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '16' }));
    fireEvent.click(document.querySelector('.lucide-minus')?.closest('button') as Element);
    fireEvent.click(document.querySelector('.lucide-plus')?.closest('button') as Element);
    fireEvent.click(screen.getByLabelText('popover-focus'));
    expect(callbacks.onInputCommit).toHaveBeenCalled();
    expect(callbacks.onSelectFontSize).toHaveBeenCalledWith('16');
    expect(callbacks.onDecrease).toHaveBeenCalled();
    expect(callbacks.onIncrease).toHaveBeenCalled();
  });

  it('covers media upload/menu keys, invalid/valid URL embeds and file naming', () => {
    const setOpen = vi.fn();
    const openFilePicker = vi.fn();
    const props = {
      nodeType: 'file',
      props: {},
      editor: state.editor,
      open: false,
      setOpen,
      dialogOpen: true,
      setDialogOpen: vi.fn(),
      t: (key: string) => key,
      MEDIA_CONFIG: {},
      currentConfig: { accept: [], icon: <span>media</span>, title: 'Media', tooltip: 'Media' },
      openFilePicker,
    };
    const view = render(<MediaToolbarButtonView {...props} />);
    const primary = screen.getByRole('button', { name: 'Media' });
    fireEvent.click(primary);
    fireEvent.keyDown(primary, { key: 'Escape' });
    fireEvent.keyDown(primary, { key: 'ArrowDown' });
    expect(openFilePicker).toHaveBeenCalledOnce();
    expect(setOpen).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Media: plateJs.toolbar.more' })).toBeTruthy();
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /uploadFromComputer/ })
        .find(node => node.tagName === 'BUTTON') as Element
    );
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /insertViaURL/ })
        .find(node => node.tagName === 'BUTTON') as Element
    );
    fireEvent.click(screen.getByRole('button', { name: 'plateJs.toolbar.accept' }));
    expect(state.toastError).toHaveBeenCalled();
    const input = screen.getByLabelText('plateJs.toolbar.url');
    fireEvent.change(input, { target: { value: 'http://host/file.txt' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(state.editor.tf.insertNodes).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'file.txt', type: 'file' })
    );
    fireEvent.click(screen.getByLabelText('close-dialog'));
    view.rerender(<MediaToolbarButtonView {...props} nodeType="img" />);
    fireEvent.change(screen.getByLabelText('plateJs.toolbar.url'), {
      target: { value: 'http://host/image.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'plateJs.toolbar.accept' }));
    expect(state.editor.tf.insertNodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: undefined, type: 'img' })
    );
  });

  it('covers read-only, editing and action media toolbar states', () => {
    const base = {
      children: <span>media-child</span>,
      plugin: { key: 'media' },
      isOpen: true,
      removeButtonProps: { onClick: vi.fn() },
      labels: { embedLinkPlaceholder: 'URL', editLink: 'Edit', caption: 'Caption' },
    } as any;
    const view = render(<MediaToolbarView {...base} readOnly isEditing={false} />);
    expect(screen.getByText('media-child')).toBeTruthy();
    view.rerender(<MediaToolbarView {...base} readOnly={false} isEditing />);
    expect(screen.getByLabelText('media-url')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('popover-focus'));
    view.rerender(<MediaToolbarView {...base} readOnly={false} isEditing={false} />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });
});

describe('mode toolbar wrappers and view states', () => {
  it('covers wrapper defaults and explicit options', () => {
    const view = render(<ModeToolbarButton />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    view.rerender(<ModeToolbarButton iconOnly isOwnerOrCollaborator={false} />);
    expect(screen.getByText('View only')).toBeTruthy();
  });

  it('covers both tutorial anchors, icon labels, owner states and menu changes', () => {
    const base = {
      dropdownProps: {},
      disabledModeReasons: {},
      open: true,
      onOpenChange: vi.fn(),
      currentOption: state.modeController.currentOption,
      labels: state.modeController.labels,
      onModeChange: vi.fn(),
    } as any;
    const view = render(
      <ModeToolbarButtonView
        {...base}
        mode="suggest_internal"
        iconOnly={false}
        isOwnerOrCollaborator
      />
    );
    expect(screen.getByText('Edit').className).toContain('hidden');
    expect(
      view.container.querySelector('[data-tutorial-anchor="amendment-mode-vote-internal"]')
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'modes' }));
    view.rerender(
      <ModeToolbarButtonView {...base} mode="edit" iconOnly isOwnerOrCollaborator={false} />
    );
    expect(screen.getByText('Edit').className).toContain('sr-only');
    expect(screen.getByText('View only')).toBeTruthy();
    expect(
      view.container.querySelector('[data-tutorial-anchor="amendment-mode-suggest-internal"]')
    ).toBeTruthy();
  });
});
