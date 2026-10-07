// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AiEditorTraceContext } from '../ai-editor-trace-context';
import { createPlateEditor, ParagraphPlugin } from 'platejs/react';
import { BoldPlugin, H1Plugin } from '@platejs/basic-nodes/react';
import { ListPlugin } from '@platejs/list/react';
import { AIChatPlugin, AIPlugin } from '@platejs/ai/react';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { AI_PREVIEW_KEY } from '@platejs/ai';
import { type Value } from 'platejs';
import { MarkdownKit } from '../markdown-kit';
import {
  getEditorPromptContext,
  editorContextSystemMessage,
  resolveEditorPrompt,
} from '../ai-editor-context';

const mocks = vi.hoisted(() => ({ session: { access_token: 'session-token' } as any }));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    session: mocks.session,
  }),
}));

import {
  buildEditorCommandBody,
  getAppendText,
  getMessageTextContent,
  toUiMessage,
  useChat,
} from '../use-chat';

const originalFetch = globalThis.fetch;

function createChatStreamResponse(text = 'Done'): Response {
  const events = [
    { type: 'start', messageId: 'assistant-1' },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop' },
  ];

  return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function contextEditor(
  value: Value = [
    { id: 'heading', type: 'h1', children: [{ text: 'Amendment title' }] },
    {
      id: 'first',
      type: 'p',
      children: [{ text: 'Before ' }, { text: 'selected words', bold: true }, { text: ' after' }],
    },
    { id: 'middle', type: 'p', children: [{ text: 'Unselected middle paragraph' }] },
    { id: 'last', type: 'p', children: [{ text: 'Last context paragraph' }] },
  ]
) {
  return createPlateEditor({
    plugins: [
      ParagraphPlugin,
      H1Plugin,
      BoldPlugin,
      ListPlugin,
      ...MarkdownKit,
      AIPlugin,
      AIChatPlugin,
      BlockSelectionPlugin,
    ],
    value,
  });
}

describe('editor AI chat adapter', () => {
  beforeEach(() => {
    mocks.session = { access_token: 'session-token' };
    globalThis.fetch = vi.fn(async () => createChatStreamResponse());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('converts legacy text messages to AI SDK 7 message parts', () => {
    expect(toUiMessage({ role: 'unexpected', content: 'Draft text' }, 2)).toEqual({
      id: 'editor-message-2',
      role: 'user',
      parts: [{ type: 'text', text: 'Draft text' }],
    });
  });

  it('preserves existing AI SDK message parts without reusing the mutable array', () => {
    const parts = [{ type: 'text' as const, text: 'Existing answer' }];
    const message = toUiMessage({ id: 'assistant-7', role: 'assistant', parts }, 0);

    expect(message).toEqual({
      id: 'assistant-7',
      role: 'assistant',
      parts,
    });
    expect(message.parts).not.toBe(parts);
  });

  it('builds the editor command body with a leading system message and valid text only', () => {
    expect(
      buildEditorCommandBody(
        [
          { role: 'user', content: 'Rewrite this' },
          { role: 'assistant', parts: [{ type: 'text', text: 'Rewritten text' }] },
          { role: 'tool', content: 'ignored role' },
          { role: 'user', content: '' },
        ],
        { system: '  Be concise.  ' }
      )
    ).toEqual({
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Rewrite this' },
        { role: 'assistant', content: 'Rewritten text' },
      ],
    });
  });

  it('handles invalid system bodies and non-text legacy parts', () => {
    expect(buildEditorCommandBody([], null)).toEqual({ messages: [] });
    expect(buildEditorCommandBody([], { system: 42 })).toEqual({ messages: [] });
    expect(buildEditorCommandBody([], { system: '   ' })).toEqual({ messages: [] });
    expect(getMessageTextContent({ role: 'user', content: [{ type: 'image' }] })).toBe('');
    expect(getMessageTextContent({ role: 'assistant', parts: [{ type: 'file' } as any] })).toBe('');
    expect(getMessageTextContent({ role: 'user' })).toBe('');
    expect(toUiMessage({ role: 'system', content: 'System' }, 0).role).toBe('system');
  });

  it('uses snapshot text and exact reversed selection boundaries, preserving existing system and history', () => {
    const editor = contextEditor();
    const snapshot = editor.children;
    editor.tf.setValue([{ type: 'p', children: [{ text: 'Different live text' }] }]);
    const body = buildEditorCommandBody(
      [
        { role: 'system', content: 'Earlier system instruction' },
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
        { role: 'user', content: 'Rewrite this' },
      ],
      {
        system: 'Keep it formal.',
        ctx: {
          children: snapshot,
          selection: {
            anchor: { path: [1, 1], offset: 14 },
            focus: { path: [1, 1], offset: 0 },
          },
        },
      },
      editor
    );
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: expect.stringContaining('Keep it formal.'),
    });
    const context = body.messages[0].content;
    expect(context).toContain('# Amendment title');
    expect(context).toContain('Unselected middle paragraph');
    expect(context).toContain('<Selection>\n**selected words**\n</Selection>');
    expect(context).toContain('<Block>\nBefore **selected words** after\n</Block>');
    expect(context).not.toContain('Different live text');
    expect(body.messages.slice(1)).toEqual([
      { role: 'system', content: 'Earlier system instruction' },
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'Earlier answer' },
      { role: 'user', content: 'Rewrite this' },
    ]);
  });

  it('targets non-adjacent blocks without adding the intervening paragraph to the selection', () => {
    const editor = contextEditor();
    editor.getApi(BlockSelectionPlugin).blockSelection.set(['first', 'last']);
    const context = getEditorPromptContext(editor, {
      ctx: {
        children: editor.children,
        selection: editor.api.nodesRange(
          editor.getApi(BlockSelectionPlugin).blockSelection.getNodes()
        ),
      },
    });
    expect(context.document).toContain('Unselected middle paragraph');
    expect(context.selection).toBe('Before **selected words** after\n\nLast context paragraph');
    expect(context.selection).not.toContain('Unselected middle paragraph');
  });

  it('keeps selection paths correct when an excluded AI anchor precedes the selected paragraph', () => {
    const editor = contextEditor();
    const snapshot: Value = [
      { type: 'aiChat', children: [{ text: 'Temporary anchor' }] },
      { type: 'p', children: [{ text: 'Before target after' }] },
      { type: 'p', [AI_PREVIEW_KEY]: true, children: [{ text: 'Unaccepted preview' }] },
    ];
    const context = getEditorPromptContext(editor, {
      ctx: {
        children: snapshot,
        selection: { anchor: { path: [1, 0], offset: 7 }, focus: { path: [1, 0], offset: 13 } },
      },
    });
    expect(context).toEqual({
      document: 'Before target after',
      block: 'Before target after',
      selection: 'target',
    });
  });

  it('includes the current block for a cursor and only the document when there is no target', () => {
    const editor = contextEditor();
    const point = { path: [2, 0], offset: 4 };
    editor.tf.select({ anchor: point, focus: point });
    const cursor = getEditorPromptContext(editor);
    expect(cursor.selection).toBe('');
    expect(cursor.block).toBe('Unselected middle paragraph');
    const documentOnly = getEditorPromptContext(editor, {
      ctx: { children: editor.children, selection: null },
    });
    expect(documentOnly.selection).toBe('');
    expect(documentOnly.block).toBe('');
    expect(documentOnly.document).toContain('# Amendment title');
  });

  it('preserves list formatting while excluding temporary AI anchors and previews without mutating the document', () => {
    const value: Value = [
      {
        type: 'p',
        indent: 1,
        listStyleType: 'disc',
        children: [{ text: 'List item', bold: true }],
      },
      { type: 'aiChat', children: [{ text: 'Temporary anchor' }] },
      { type: 'p', [AI_PREVIEW_KEY]: true, children: [{ text: 'Preview block' }] },
      { type: 'p', children: [{ text: 'Original text' }, { text: 'Stream preview', ai: true }] },
    ];
    const editor = contextEditor(value);
    const before = JSON.stringify(editor.children);
    expect(getEditorPromptContext(editor).document).toBe('* **List item**\n\nOriginal text');
    expect(JSON.stringify(editor.children)).toBe(before);
  });

  it('handles empty preview snapshots and stale block selections without leaking temporary text', () => {
    const preview = contextEditor([
      { type: 'p', children: [{ text: 'Unaccepted text', ai: true }] },
    ]);
    expect(getEditorPromptContext(preview).document).toMatch(/^\u200B?$/);
    const editor = contextEditor();
    const getOption = editor.getOption.bind(editor);
    vi.spyOn(editor, 'getOption').mockImplementation((plugin: any, option: any) =>
      option === 'isSelectingSome' ? true : getOption(plugin, option)
    );
    // The live block selection can outlive the snapshot sent with an editor request.
    vi.spyOn(editor.getApi(BlockSelectionPlugin).blockSelection, 'getNodes').mockReturnValue([
      [{ ...editor.children[1], id: 'stale-block' }, [999]],
    ]);
    expect(getEditorPromptContext(editor, { ctx: { children: [], selection: null } })).toEqual({
      document: '',
      block: '',
      selection: '',
    });
  });

  it('resolves each scoped preset and identifies a document-only target for model instructions', () => {
    const context = {
      document: 'Current document',
      block: 'Current block',
      selection: 'Exact selection',
    };
    expect(
      resolveEditorPrompt(
        '{editor} / {block} / {selection} / {blockSelection} / {unknown}',
        context
      )
    ).toBe('Current document / Current block / Exact selection / Exact selection / {unknown}');
    const message = editorContextSystemMessage({ ...context, block: '', selection: '' });
    expect(message).toContain('The Document is the target');
    expect(message).toContain('<Document>\nCurrent document\n</Document>');
    expect(message).toContain('<Selection>\n\n</Selection>');
  });

  it('sends scoped presets and follow-ups with current unsaved text while preserving resolved history', async () => {
    const editor = contextEditor();
    const point = { path: [2, 0], offset: 4 };
    const requestBody = {
      ctx: { children: editor.children, selection: { anchor: point, focus: point } },
    };
    const { result } = renderHook(() => useChat(editor));
    await act(async () =>
      result.current.plateChat.sendMessage({ text: 'Summarize {editor}' }, { body: requestBody })
    );
    const first = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body));
    expect(first.messages[0].content).toContain('<Block>\nUnselected middle paragraph\n</Block>');
    expect(first.messages[1].content).toContain('Summarize # Amendment title');
    expect(first.messages[1].content).not.toContain('{editor}');
    editor.tf.insertText(' UNSAVED', { at: { path: [3, 0], offset: 22 } });
    await act(async () =>
      result.current.plateChat.sendMessage(
        { text: 'Make it shorter' },
        {
          body: { ctx: { children: editor.children, selection: { anchor: point, focus: point } } },
        }
      )
    );
    const second = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[1][1]?.body));
    expect(second.messages[0].content).toContain('UNSAVED');
    expect(second.messages[1]).toEqual(first.messages[1]);
    expect(second.messages[1].content).not.toContain('UNSAVED');
    expect(second.messages.at(-1)).toEqual({ role: 'user', content: 'Make it shorter' });
  });

  it('normalizes append input without unsafe message casts', () => {
    expect(getAppendText()).toBe('');
    expect(getAppendText({ text: 'Direct text' })).toBe('Direct text');
    expect(getAppendText({ role: 'user', content: [{ type: 'text', text: 'Legacy text' }] })).toBe(
      'Legacy text'
    );
    expect(getAppendText({ text: undefined })).toBe('');
  });

  it('keeps the native Plate chat stable while editing input and exposes SDK message parts', async () => {
    const { result } = renderHook(() => useChat());
    const initialChat = result.current.plateChat;
    act(() => result.current.setInput('draft'));
    expect(result.current.plateChat).toBe(initialChat);
    await act(async () => result.current.plateChat.sendMessage({ text: 'Native prompt' }));
    await waitFor(() =>
      expect(result.current.plateChat.messages.at(-1)?.parts).toEqual([
        { type: 'text', text: 'Done', state: 'done' },
      ])
    );
    expect(result.current.plateChat).not.toBe(initialChat);
    expect(result.current.plateChat.messages[0]).not.toHaveProperty('content');
    expect(result.current.messages[0].content).toBe('Native prompt');
    act(() => result.current.plateChat.setMessages([]));
    expect(result.current.messages).toEqual([]);
  });

  it('supports signed-out headers, functional messages, empty appends, and form submission', async () => {
    mocks.session = undefined;
    const preventDefault = vi.fn();
    const { result } = renderHook(() => useChat());
    await act(async () => result.current.append());
    act(() => result.current.setMessages(current => [...current]));
    act(() => result.current.handleSubmit({ preventDefault }));
    expect(preventDefault).toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    act(() => result.current.handleInputChange({ target: { value: '  Submit me  ' } } as any));
    act(() => result.current.handleSubmit());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  });

  it('sends authenticated editor requests and appends streamed responses', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.append(
        { role: 'user', content: 'Improve this sentence' },
        { body: { system: 'Use formal language.' } }
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/command');
    const requestHeaders = new Headers(request?.headers);
    expect(requestHeaders.get('authorization')).toBe('Bearer session-token');
    expect(requestHeaders.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(request?.body))).toEqual({
      messages: [
        { role: 'system', content: 'Use formal language.' },
        { role: 'user', content: 'Improve this sentence' },
      ],
    });

    await waitFor(() => {
      expect(result.current.messages).toEqual([
        expect.objectContaining({ role: 'user', content: 'Improve this sentence' }),
        expect.objectContaining({ role: 'assistant', content: 'Done' }),
      ]);
    });
  });

  it('sends a scoped editor request with its current document diagnostics header', async () => {
    const documentId = crypto.randomUUID();
    const { result } = renderHook(() => useChat(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AiEditorTraceContext.Provider value={documentId}>{children}</AiEditorTraceContext.Provider>
      ),
    });
    await act(async () => result.current.append({ role: 'user', content: 'Review this document' }));
    const request = vi.mocked(globalThis.fetch).mock.calls[0][1];
    expect(new Headers(request?.headers).get('X-AI-Document-Id')).toBe(documentId);
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer session-token');
    await waitFor(() => expect(result.current.messages.at(-1)?.content).toBe('Done'));
  });

  it('supports legacy setMessages updates and regeneration', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setMessages([
        { id: 'user-1', role: 'user', content: 'Original prompt' },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Original answer' }],
        },
      ]);
    });

    expect(result.current.messages).toEqual([
      expect.objectContaining({ id: 'user-1', content: 'Original prompt' }),
      expect.objectContaining({ id: 'assistant-1', content: 'Original answer' }),
    ]);

    fetchMock.mockClear();
    await act(async () => {
      await result.current.reload();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
