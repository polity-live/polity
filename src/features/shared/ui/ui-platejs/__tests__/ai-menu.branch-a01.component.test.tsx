/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { KeyboardEvent, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  block: vi.fn(),
  blocks: vi.fn(),
  blockSelectionSet: vi.fn(),
  editorChatConfig: undefined as Record<string, (...args: never[]) => void> | undefined,
  focus: vi.fn(),
  hide: vi.fn(),
  insertBelow: vi.fn(),
  isAt: vi.fn(),
  isEmpty: vi.fn(),
  isSelecting: false,
  lastAssistantMessage: undefined as { parts: { text?: string; type: string }[] } | undefined,
  node: vi.fn(),
  nodeString: 'existing paragraph',
  optionAiEditor: { children: [] } as unknown,
  optionMessages: [] as unknown[] | undefined,
  optionMode: 'chat',
  optionOpen: true,
  optionStreaming: false,
  reload: vi.fn(),
  replaceSelection: vi.fn(),
  setInput: vi.fn(),
  show: vi.fn(),
  stop: vi.fn(),
  submit: vi.fn(),
  toDOMNode: vi.fn(),
  undo: vi.fn(),
  hotkeyHandler: undefined as (() => void) | undefined,
  chat: {
    input: '',
    messages: [] as unknown[],
    setInput: vi.fn(),
    status: 'ready',
  },
}));

const editor = {
  api: {
    block: mocks.block,
    blocks: mocks.blocks,
    isAt: mocks.isAt,
    isEmpty: mocks.isEmpty,
    toDOMNode: mocks.toDOMNode,
  },
  getApi: (plugin: { key?: string }) =>
    plugin.key === 'blockSelection'
      ? { blockSelection: { set: mocks.blockSelectionSet } }
      : { aiChat: { hide: mocks.hide, reload: mocks.reload, submit: mocks.submit } },
  getTransforms: (plugin: { key?: string }) =>
    plugin.key === 'aiPlugin'
      ? { ai: { undo: mocks.undo } }
      : {
          aiChat: {
            accept: mocks.accept,
            insertBelow: mocks.insertBelow,
            replaceSelection: mocks.replaceSelection,
          },
        },
  tf: { focus: mocks.focus },
};

const aiApi = {
  aiChat: {
    hide: mocks.hide,
    node: mocks.node,
    show: mocks.show,
    stop: mocks.stop,
    submit: mocks.submit,
  },
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/kit-platejs/use-chat.ts', () => ({
  useChat: () => mocks.chat,
}));

vi.mock('@platejs/ai/react', () => ({
  AIChatPlugin: { key: 'aiChat' },
  AIPlugin: { key: 'aiPlugin' },
  useEditorChat: (config: Record<string, (...args: never[]) => void>) => {
    mocks.editorChatConfig = config;
  },
  useLastAssistantMessage: () => mocks.lastAssistantMessage,
}));

vi.mock('@platejs/selection/react', () => ({
  BlockSelectionPlugin: { key: 'blockSelection' },
  useIsSelecting: () => mocks.isSelecting,
}));

vi.mock('platejs', () => ({
  NodeApi: { string: () => mocks.nodeString },
  isHotkey: (hotkey: string) => (event: KeyboardEvent) => event.key.toLowerCase() === hotkey,
}));

vi.mock('platejs/react', () => ({
  useEditorPlugin: () => ({ api: aiApi, editor }),
  useEditorRef: () => editor,
  useHotkeys: (_hotkey: string, callback: () => void) => {
    mocks.hotkeyHandler = callback;
  },
  usePluginOption: (_plugin: unknown, option: string) => {
    if (option === 'open') return mocks.optionOpen;
    if (option === 'mode') return mocks.optionMode;
    if (option === 'streaming') return mocks.optionStreaming;
    if (option === 'chat') {
      return { messages: mocks.optionMessages, status: mocks.chat.status };
    }
    if (option === 'aiEditor') return mocks.optionAiEditor;
    return undefined;
  },
}));

vi.mock('cmdk', () => ({
  Command: {
    Input: ({
      onKeyDown,
      onValueChange,
      ...props
    }: {
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
      onValueChange: (value: string) => void;
      [key: string]: unknown;
    }) => (
      <input
        {...props}
        aria-label="AI prompt"
        onChange={event => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
    ),
  },
}));

vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({
    children,
    className: _className,
    size: _size,
    variant: _variant,
    ...props
  }: {
    children: ReactNode;
    className?: string;
    size?: string;
    variant?: string;
    [key: string]: unknown;
  }) => <button {...props}>{children}</button>,
}));

vi.mock('@/features/shared/ui/ui/command.tsx', () => ({
  Command: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => (
    <div>
      <button
        type="button"
        aria-label="clear command selection"
        onClick={() => onValueChange('')}
      />
      {children}
    </div>
  ),
  CommandGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandItem: ({
    children,
    onSelect,
    value,
  }: {
    children: ReactNode;
    onSelect: () => void;
    value: string;
  }) => (
    <button type="button" aria-label={value} onClick={onSelect}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({
    children,
    onOpenChange,
  }: {
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div>
      <button type="button" aria-label="open popover" onClick={() => onOpenChange(true)} />
      <button type="button" aria-label="close popover" onClick={() => onOpenChange(false)} />
      {children}
    </div>
  ),
  PopoverAnchor: () => <div data-testid="anchor" />,
  PopoverContent: ({
    children,
    onEscapeKeyDown,
    style,
  }: {
    children: ReactNode;
    onEscapeKeyDown: (event: { preventDefault: () => void }) => void;
    style: { width: number };
  }) => (
    <div
      data-testid="popover-content"
      data-width={style.width}
      onKeyDown={event => {
        if (event.key === 'Escape') onEscapeKeyDown(event);
      }}
    >
      {children}
    </div>
  ),
}));

vi.mock('../ai-chat-editor.tsx', () => ({
  AIChatEditor: ({ content }: { content: string }) => <div>assistant:{content}</div>,
}));

vi.mock('@/features/shared/utils/utils.ts', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

import { AILoadingBar, AIMenu, AIMenuItems } from '../ai-menu';

function anchor(width = 320) {
  const element = document.createElement('div');
  Object.defineProperty(element, 'offsetWidth', { configurable: true, value: width });
  return element;
}

function openFromBlockSelection(element = anchor()) {
  mocks.toDOMNode.mockReturnValue(element);
  act(() => {
    mocks.editorChatConfig?.onOpenBlockSelection([[{ id: 'block-1' }, [0]]] as never);
  });
  return element;
}

function clickItem(value: string) {
  fireEvent.click(screen.getByRole('button', { name: value }));
}

describe('AIMenu branch campaign A01', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editorChatConfig = undefined;
    mocks.hotkeyHandler = undefined;
    mocks.isSelecting = false;
    mocks.lastAssistantMessage = undefined;
    mocks.nodeString = 'existing paragraph';
    mocks.optionAiEditor = { children: [] };
    mocks.optionMessages = [];
    mocks.optionMode = 'chat';
    mocks.optionOpen = true;
    mocks.optionStreaming = false;
    mocks.chat.input = '';
    mocks.chat.messages = [];
    mocks.chat.status = 'ready';
    mocks.chat.setInput = mocks.setInput;
    mocks.block.mockReturnValue(undefined);
    mocks.blocks.mockReturnValue([]);
    mocks.isAt.mockReturnValue(true);
    mocks.isEmpty.mockReturnValue(false);
    mocks.node.mockReturnValue(undefined);
    mocks.toDOMNode.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens from block and text selections, including absent blocks and DOM anchors', () => {
    render(<AIMenu />);
    expect(screen.queryByLabelText('AI prompt')).toBeNull();

    act(() => {
      mocks.editorChatConfig?.onOpenBlockSelection([] as never);
      mocks.editorChatConfig?.onOpenSelection();
    });
    expect(mocks.show).not.toHaveBeenCalled();

    mocks.toDOMNode.mockReturnValue(null);
    act(() => {
      mocks.editorChatConfig?.onOpenBlockSelection([[{ id: 'one' }, [0]]] as never);
    });
    expect(mocks.show).not.toHaveBeenCalled();

    mocks.blocks.mockReturnValue([[{ id: 'two' }, [1]]]);
    act(() => {
      mocks.editorChatConfig?.onOpenSelection();
    });
    expect(mocks.show).not.toHaveBeenCalled();

    mocks.toDOMNode.mockReturnValue(anchor(410));
    act(() => {
      mocks.editorChatConfig?.onOpenSelection();
    });

    expect(mocks.show).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('popover-content').dataset.width).toBe('410');
  });

  it('handles cursor opening, selection setup, close resets and escape stopping', () => {
    render(<AIMenu />);

    act(() => mocks.editorChatConfig?.onOpenCursor());
    expect(mocks.show).not.toHaveBeenCalled();

    const block = { id: 'cursor-block' };
    mocks.block.mockReturnValue([block, [0]]);
    mocks.isAt.mockReturnValue(false);
    mocks.isEmpty.mockReturnValue(false);
    mocks.toDOMNode.mockReturnValue(anchor());
    act(() => mocks.editorChatConfig?.onOpenCursor());

    expect(mocks.blockSelectionSet).toHaveBeenCalledWith('cursor-block');
    expect(mocks.show).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'open popover' }));
    fireEvent.click(screen.getByRole('button', { name: 'close popover' }));
    expect(mocks.show).toHaveBeenCalledTimes(2);
    expect(mocks.hide).toHaveBeenCalledTimes(1);

    act(() => mocks.editorChatConfig?.onOpenChange(true as never));
    expect(mocks.setInput).not.toHaveBeenCalled();
    act(() => mocks.editorChatConfig?.onOpenChange(false as never));
    expect(mocks.setInput).toHaveBeenCalledWith('');

    openFromBlockSelection();
    fireEvent.keyDown(screen.getByTestId('popover-content'), { key: 'Escape' });
    mocks.hotkeyHandler?.();
    expect(mocks.hide).toHaveBeenCalledTimes(2);
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it('does not select an empty or end-position cursor block and tolerates a missing DOM node', () => {
    render(<AIMenu />);
    mocks.block.mockReturnValue([{ id: 'empty' }, [0]]);
    mocks.isAt.mockReturnValue(false);
    mocks.isEmpty.mockReturnValue(true);
    mocks.toDOMNode.mockReturnValue(null);
    act(() => mocks.editorChatConfig?.onOpenCursor());

    mocks.isAt.mockReturnValue(true);
    mocks.isEmpty.mockReturnValue(false);
    act(() => mocks.editorChatConfig?.onOpenCursor());

    expect(mocks.blockSelectionSet).not.toHaveBeenCalled();
    expect(mocks.show).not.toHaveBeenCalled();
  });

  it('anchors asynchronously while streaming and ignores unavailable stream anchors', () => {
    vi.useFakeTimers();
    mocks.optionStreaming = true;
    mocks.optionMode = 'chat';
    mocks.chat.status = 'streaming';
    const streamAnchor = anchor(275);
    mocks.node.mockReturnValue([{ id: 'stream' }, [0]]);
    mocks.toDOMNode.mockReturnValue(streamAnchor);

    render(<AIMenu />);
    act(() => vi.runAllTimers());
    expect(screen.getByTestId('popover-content').dataset.width).toBe('275');

    cleanup();
    mocks.node.mockReturnValue(undefined);
    render(<AIMenu />);
    act(() => vi.runAllTimers());
    expect(screen.queryByTestId('popover-content')).toBeNull();

    cleanup();
    mocks.node.mockReturnValue([{ id: 'stream' }, [0]]);
    mocks.toDOMNode.mockReturnValue(null);
    render(<AIMenu />);
    act(() => vi.runAllTimers());
    expect(screen.queryByTestId('popover-content')).toBeNull();
  });

  it('renders loading and assistant states with deterministic status labels', () => {
    mocks.optionMode = 'chat';
    mocks.chat.status = 'streaming';
    mocks.chat.messages = [{ id: 1 }];
    const first = render(<AIMenu />);
    openFromBlockSelection();
    expect(screen.getByText('plateJs.ai.menu.thinking')).toBeTruthy();

    first.unmount();
    mocks.chat.status = 'submitted';
    mocks.chat.messages = [{ id: 1 }, { id: 2 }];
    render(<AIMenu />);
    openFromBlockSelection();
    expect(screen.getByText('plateJs.ai.menu.editing')).toBeTruthy();

    cleanup();
    mocks.chat.status = 'ready';
    mocks.isSelecting = true;
    mocks.lastAssistantMessage = {
      parts: [{ type: 'tool' }, { text: 'Hello ', type: 'text' }, { text: 'world', type: 'text' }],
    };
    render(<AIMenu />);
    openFromBlockSelection();
    expect(screen.getByText('assistant:Hello world')).toBeTruthy();
  });

  it('hides insert-mode loading and exercises prompt keyboard boundaries', () => {
    mocks.optionMode = 'insert';
    mocks.chat.status = 'streaming';
    const hidden = render(<AIMenu />);
    expect(screen.queryByTestId('popover-content')).toBeNull();

    hidden.unmount();
    mocks.optionMode = 'chat';
    mocks.chat.status = 'ready';
    render(<AIMenu />);
    openFromBlockSelection();

    const input = screen.getByLabelText('AI prompt');
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(mocks.hide).toHaveBeenCalledTimes(1);

    cleanup();
    mocks.chat.input = 'draft';
    render(<AIMenu />);
    openFromBlockSelection();
    const draftInput = screen.getByLabelText('AI prompt');
    fireEvent.keyDown(draftInput, { key: 'Backspace' });
    expect(mocks.hide).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(draftInput, { key: 'Enter' });
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'clear command selection' }));
    fireEvent.keyDown(draftInput, { key: 'Enter', shiftKey: true });
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.keyDown(draftInput, { key: 'Enter' });
    expect(mocks.submit).toHaveBeenCalledWith('draft');

    fireEvent.change(draftInput, { target: { value: 'new prompt' } });
    expect(mocks.setInput).toHaveBeenCalledWith('new prompt');
  });
});

describe('AIMenuItems branch campaign A01', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSelecting = false;
    mocks.optionAiEditor = { children: [] };
    mocks.optionMessages = [];
    mocks.nodeString = 'existing paragraph';
    mocks.block.mockReturnValue([{ id: 'paragraph' }, [0]]);
  });

  afterEach(cleanup);

  it('runs all cursor commands and both continue-writing prompt variants', () => {
    const setValue = vi.fn();
    const view = render(<AIMenuItems setValue={setValue} />);
    expect(setValue).toHaveBeenCalledWith('generateMdxSample');

    for (const value of ['generateMdxSample', 'generateMarkdownSample', 'summarize', 'explain']) {
      clickItem(value);
    }
    clickItem('continueWrite');
    expect(mocks.submit).toHaveBeenLastCalledWith('', {
      mode: 'insert',
      prompt: 'Continue writing AFTER <Block> ONLY ONE SENTENCE. DONT REPEAT THE TEXT.',
    });

    mocks.nodeString = '   ';
    clickItem('continueWrite');
    expect(mocks.submit).toHaveBeenLastCalledWith('', {
      mode: 'insert',
      prompt: expect.stringContaining('Start writing a new paragraph'),
    });

    mocks.block.mockReturnValue(undefined);
    clickItem('continueWrite');
    expect(mocks.submit).toHaveBeenCalledTimes(6);
    view.unmount();
  });

  it('runs cursor-suggestion actions and editor transforms', () => {
    mocks.optionMessages = [{ id: 'assistant' }];
    render(<AIMenuItems setValue={vi.fn()} />);

    for (const value of ['accept', 'discard', 'tryAgain']) clickItem(value);

    expect(mocks.accept).toHaveBeenCalledTimes(1);
    expect(mocks.focus).toHaveBeenCalledWith({ edge: 'end' });
    expect(mocks.undo).toHaveBeenCalledTimes(1);
    expect(mocks.hide).toHaveBeenCalledTimes(1);
    expect(mocks.reload).toHaveBeenCalledTimes(1);
  });

  it('runs every selection command', () => {
    mocks.isSelecting = true;
    mocks.optionMessages = undefined;
    render(<AIMenuItems setValue={vi.fn()} />);

    for (const value of [
      'improveWriting',
      'emojify',
      'makeLonger',
      'makeShorter',
      'fixSpelling',
      'simplifyLanguage',
    ]) {
      clickItem(value);
    }

    expect(mocks.submit).toHaveBeenCalledTimes(6);
    expect(mocks.submit).toHaveBeenCalledWith('', { prompt: 'Emojify' });
    expect(mocks.submit).toHaveBeenCalledWith('', { prompt: 'plateJs.ai.menu.simplifyLanguage' });
  });

  it('runs selection-suggestion replacement actions and returns no menu without an AI editor', () => {
    mocks.isSelecting = true;
    mocks.optionMessages = [{ id: 'assistant' }];
    const setValue = vi.fn();
    const view = render(<AIMenuItems setValue={setValue} />);

    for (const value of ['replace', 'insertBelow', 'discard', 'tryAgain']) clickItem(value);
    expect(mocks.replaceSelection).toHaveBeenCalledWith(mocks.optionAiEditor);
    expect(mocks.insertBelow).toHaveBeenCalledWith(mocks.optionAiEditor);

    view.unmount();
    mocks.optionAiEditor = undefined;
    render(<AIMenuItems setValue={setValue} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('AILoadingBar branch campaign A01', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.optionMode = 'insert';
    mocks.chat.status = 'ready';
  });

  afterEach(cleanup);

  it('stays hidden while idle and outside insert mode', () => {
    const view = render(<AILoadingBar />);
    expect(screen.queryByRole('button')).toBeNull();

    view.unmount();
    mocks.chat.status = 'streaming';
    mocks.optionMode = 'chat';
    render(<AILoadingBar />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows submitted and streaming labels and lets the user stop generation', () => {
    mocks.chat.status = 'submitted';
    const view = render(<AILoadingBar />);
    expect(screen.getByText('plateJs.ai.menu.thinking')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(mocks.stop).toHaveBeenCalledTimes(1);

    view.unmount();
    mocks.chat.status = 'streaming';
    render(<AILoadingBar />);
    expect(screen.getByText('plateJs.ai.menu.writing')).toBeTruthy();
  });
});
