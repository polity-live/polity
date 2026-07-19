// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    session: { access_token: 'session-token' },
  }),
}));

import { buildEditorCommandBody, getAppendText, toUiMessage, useChat } from '../use-chat';

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

describe('editor AI chat adapter', () => {
  beforeEach(() => {
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

  it('normalizes append input without unsafe message casts', () => {
    expect(getAppendText({ text: 'Direct text' })).toBe('Direct text');
    expect(getAppendText({ role: 'user', content: [{ type: 'text', text: 'Legacy text' }] })).toBe(
      'Legacy text'
    );
    expect(getAppendText({ text: undefined })).toBe('');
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
