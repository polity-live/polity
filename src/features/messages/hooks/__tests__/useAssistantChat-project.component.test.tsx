// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../../types/message.types';
import type { ProjectAssistantChatOptions } from '../useAssistantChat';
import { useAssistantChat } from '../useAssistantChat';

const boundary = vi.hoisted(() => ({
  session: { access_token: 'test-session' } as { access_token: string } | null,
  sendMessage: vi.fn(),
  clearAttachments: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ session: boundary.session }) }));
vi.mock('@/zero/ai/useAiState', () => {
  const skills: never[] = [],
    tools: never[] = [];
  return { useAiState: () => ({ skills, tools }) };
});
vi.mock('@/zero/ai/useAiActions', () => ({ useAiActions: () => ({ createSkill: vi.fn() }) }));
vi.mock('../useMessageMutations', () => ({
  useMessageMutations: () => ({ sendMessage: boundary.sendMessage }),
}));
vi.mock('../useMessageAttachments', () => ({
  useMessageAttachments: () => ({
    selectedAttachments: [],
    attachmentOptions: [],
    clearAttachments: boundary.clearAttachments,
    resolveAttachmentCardData: vi.fn(),
    addAttachment: vi.fn(),
    removeAttachment: vi.fn(),
    addUploadedFiles: vi.fn(),
    isUploadingAttachments: false,
    uploadingAttachmentName: null,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }), translate: t };
});
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: boundary.toast } }));

const conversation = {
  id: 'project-conversation',
  tutorial_run_id: null,
  messages: [],
} as unknown as Conversation;
const model = {
  provider: 'openrouter',
  id: 'openrouter/free',
  label: 'Free',
  source: 'app',
  free: true,
  supports_reasoning_effort: false,
  context_window: null,
};
function stream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start: current => {
      controller = current;
    },
  });
  return {
    response: new Response(body, { headers: { 'X-AI-Trace-Id': 'trace-project' } }),
    send: (event: Record<string, unknown>, newline = true) =>
      controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + (newline ? '\n' : ''))),
    bytes: (value: Uint8Array) => controller.enqueue(value),
    close: () => controller.close(),
  };
}
function project(
  overrides: Partial<ProjectAssistantChatOptions> = {}
): ProjectAssistantChatOptions {
  return {
    beforeSend: vi.fn().mockResolvedValue({ surface: 'studio', contentRevision: 'revision-7' }),
    projectTools: [
      {
        name: 'read_project',
        label: 'Read project',
        kind: 'project',
        description: 'Read',
        enabled: true,
        alwaysActive: false,
      },
    ],
    onSent: vi.fn(),
    ...overrides,
  };
}
async function renderProject(options = project(), userId: string | undefined = 'user-1') {
  const hook = renderHook(() => useAssistantChat(conversation, userId, { project: options }));
  await waitFor(() => expect(hook.result.current.isCatalogLoading).toBe(false));
  if (boundary.session) {
    await waitFor(() => expect(hook.result.current.models).toHaveLength(1));
    act(() => hook.result.current.setSelectedModelKey('openrouter:app:openrouter/free'));
  }
  return hook;
}
beforeEach(() => {
  boundary.session = { access_token: 'test-session' };
  boundary.sendMessage.mockReset().mockResolvedValue({ success: true, messageId: 'message-1' });
  boundary.clearAttachments.mockReset();
  boundary.toast.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url === '/api/ai/catalog') return Promise.resolve(Response.json({ models: [model] }));
      return Promise.resolve(new Response(''));
    })
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('project chat submission and cancellation', () => {
  it('removes selected project tools when the server withdraws them from the current scope', async () => {
    const options = project();
    const hook = await renderProject(options);
    expect(hook.result.current.selectedToolNames).toEqual(['read_project']);
    options.projectTools = [];
    hook.rerender();
    await waitFor(() => expect(hook.result.current.selectedToolNames).toEqual([]));
    expect(hook.result.current.selectedTools).toEqual([]);
  });
  it('clears a missing model list when refreshing an expired catalog response', async () => {
    const hook = await renderProject();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({}));
    await act(async () => hook.result.current.refreshCatalog());
    expect(hook.result.current.models).toEqual([]);
    expect(hook.result.current.selectedModel).toBeNull();
  });
  it.each([false, true])(
    'freezes editor context, uses only project tools and acknowledges the accepted send (skip persistence=%s)',
    async skipUserMessagePersistence => {
      const options = project();
      const hook = await renderProject(options);
      const sent = vi.fn();
      expect(hook.result.current.selectedToolNames).toEqual(['read_project']);
      expect(hook.result.current.projectDraftKey).toBe(
        'project-chat-draft:user-1:project-conversation'
      );
      await act(async () =>
        expect(
          await hook.result.current.sendAssistantMessage('Edit the heading', {
            onUserMessageSent: sent,
            skipUserMessagePersistence,
          })
        ).toBe(true)
      );
      const request = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/ai/chat');
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
        conversationId: conversation.id,
        content: 'Edit the heading',
        editorContext: { surface: 'studio', contentRevision: 'revision-7' },
        toolNames: [],
        attachments: [],
        requestId: expect.any(String),
      });
      expect(options.beforeSend).toHaveBeenCalledOnce();
      expect(options.onSent).toHaveBeenCalledOnce();
      expect(boundary.sendMessage).not.toHaveBeenCalled();
      expect(sent).toHaveBeenCalledTimes(skipUserMessagePersistence ? 0 : 1);
      expect(boundary.clearAttachments).toHaveBeenCalledOnce();
      expect(hook.result.current.canRetry).toBe(false);
    }
  );

  it('retains the draft when the editor flush fails before constructing a request', async () => {
    const options = project({
      beforeSend: vi.fn().mockRejectedValue(new Error('Workspace switched')),
    });
    const hook = await renderProject(options);
    await act(async () =>
      expect(await hook.result.current.sendAssistantMessage('Draft')).toBe(false)
    );
    expect(hook.result.current.streamError).toBe('Workspace switched');
    expect(hook.result.current.canRetry).toBe(false);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/ai/chat')).toHaveLength(0);
    expect(boundary.clearAttachments).not.toHaveBeenCalled();
    expect(options.onSent).not.toHaveBeenCalled();
  });

  it('keeps retry disabled while an externally owned project run is active', async () => {
    const hook = await renderProject(
      project({ externallyBusy: true, resumeRequestId: 'pending-run' })
    );
    expect(hook.result.current.isSending).toBe(true);
    expect(hook.result.current.canRetry).toBe(false);
    expect(hook.result.current.sharesAttachmentsWithProject).toBe(true);
    await expect(hook.result.current.retryLastAssistantMessage()).resolves.toBe(false);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/ai/chat')).toHaveLength(0);
  });

  it('cancels the native request and invokes durable project cancellation without leaving a retry error', async () => {
    const cancelled = vi.fn().mockResolvedValue(undefined);
    const hook = await renderProject(project({ onCancel: cancelled }));
    vi.mocked(fetch).mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          );
        })
    );
    let pending!: Promise<boolean>;
    act(() => {
      pending = hook.result.current.sendAssistantMessage('Cancel this');
    });
    await waitFor(() => expect(hook.result.current.isSending).toBe(true));
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([url]) => url === '/api/ai/chat')).toBe(true)
    );
    await act(async () => {
      await hook.result.current.cancelAssistantMessage();
      expect(await pending).toBe(false);
    });
    expect(cancelled).toHaveBeenCalledOnce();
    expect(hook.result.current.streamError).toBeNull();
    expect(hook.result.current.canRetry).toBe(false);
    expect(hook.result.current.isSending).toBe(false);
  });

  it('allows durable cancellation when no local request exists', async () => {
    const cancelled = vi.fn().mockResolvedValue(undefined);
    const hook = await renderProject(project({ onCancel: cancelled }));
    await act(async () => hook.result.current.cancelAssistantMessage());
    expect(cancelled).toHaveBeenCalledOnce();
    expect(hook.result.current.canCancel).toBe(true);
  });

  it('uses the anonymous project draft key when signed out and never fetches the catalog', async () => {
    boundary.session = null;
    const hook = renderHook(() =>
      useAssistantChat(conversation, undefined, { project: project() })
    );
    expect(hook.result.current.projectDraftKey).toBe(
      'project-chat-draft:anonymous:project-conversation'
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('durable project run resumption with native NDJSON streams', () => {
  it('resumes the exact persisted run and updates compression, tool, text and persistence states', async () => {
    const options = project({ resumeRequestId: 'run-resume' });
    const hook = await renderProject(options);
    const incoming = stream();
    vi.mocked(fetch).mockResolvedValueOnce(incoming.response);
    let pending!: Promise<boolean>;
    act(() => {
      pending = hook.result.current.retryLastAssistantMessage();
    });
    await waitFor(() => expect(hook.result.current.isSending).toBe(true));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body))).toEqual({
      conversationId: conversation.id,
      requestId: 'run-resume',
      resume: true,
    });
    await act(async () => incoming.send({ type: 'compression-start' }));
    await waitFor(() => expect(hook.result.current.isCompressing).toBe(true));
    await act(async () => incoming.send({ type: 'tool-call-delta' }));
    await act(async () =>
      incoming.send({ type: 'tool-call', toolName: 'read_project', args: { path: 'heading' } })
    );
    await waitFor(() =>
      expect(hook.result.current.activeToolCall).toEqual({
        label: 'Read project',
        preview: 'read_project(path: "heading")',
      })
    );
    expect(hook.result.current.isCompressing).toBe(false);
    await act(async () => incoming.send({ type: 'tool-result', toolName: 'read_project' }));
    await waitFor(() => expect(hook.result.current.activeToolCall).toBeNull());
    expect(hook.result.current.isThinking).toBe(true);
    await act(async () => incoming.send({ type: 'text-delta', text: 'Updated ' }));
    await waitFor(() => expect(hook.result.current.streamingText).toBe('Updated '));
    await act(async () => {
      incoming.send({ type: 'text-delta', text: 'heading' }, false);
      incoming.close();
      expect(await pending).toBe(true);
    });
    expect(hook.result.current.streamingText).toBe('Updated heading');
    expect(hook.result.current.activeTraceId).toBe('trace-project');
    expect(hook.result.current.isSending).toBe(false);
    expect(hook.result.current.isCompressing).toBe(false);
    expect(options.beforeSend).not.toHaveBeenCalled();
    expect(options.onSent).not.toHaveBeenCalled();
    expect(boundary.sendMessage).not.toHaveBeenCalled();
    expect(boundary.clearAttachments).not.toHaveBeenCalled();
  });

  it.each(['unadvertised-tool', null])(
    'preserves an unknown or absent resumed tool label (%s)',
    async toolName => {
      const hook = await renderProject(project({ resumeRequestId: 'run-tools' }));
      const incoming = stream();
      vi.mocked(fetch).mockResolvedValueOnce(incoming.response);
      let pending!: Promise<boolean>;
      act(() => {
        pending = hook.result.current.retryLastAssistantMessage();
      });
      await waitFor(() => expect(hook.result.current.isSending).toBe(true));
      await act(async () => incoming.send({ type: 'tool-call', toolName, args: {} }));
      await waitFor(() => expect(hook.result.current.isToolCalling).toBe(true));
      expect(hook.result.current.activeToolName).toBe(toolName);
      await act(async () => {
        incoming.close();
        expect(await pending).toBe(true);
      });
      expect(hook.result.current.activeToolName).toBeNull();
      expect(hook.result.current.activeToolCall).toBeNull();
    }
  );

  it('uses the persisted run identity when the server omits a trace header and the response is empty', async () => {
    const hook = await renderProject(project({ resumeRequestId: 'run-empty' }));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(''));
    await act(async () => expect(await hook.result.current.retryLastAssistantMessage()).toBe(true));
    expect(hook.result.current.activeTraceId).toBe('run-empty');
    expect(hook.result.current.streamingText).toBe('');
  });

  it.each(['http-error', 'missing-body', 'stream-error', 'transport-error', 'non-error'] as const)(
    'settles a failed resumption and keeps its durable retry available (%s)',
    async kind => {
      const hook = await renderProject(project({ resumeRequestId: 'run-failure' }));
      if (kind === 'http-error')
        vi.mocked(fetch).mockResolvedValueOnce(
          Response.json({ error: { code: 'forbidden' } }, { status: 403 })
        );
      if (kind === 'missing-body') vi.mocked(fetch).mockResolvedValueOnce(new Response(null));
      if (kind === 'stream-error')
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ type: 'error', error: { code: 'forbidden' } }) + '\n')
        );
      if (kind === 'transport-error')
        vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection closed'));
      if (kind === 'non-error') vi.mocked(fetch).mockRejectedValueOnce('Connection closed');
      await act(async () =>
        expect(await hook.result.current.retryLastAssistantMessage()).toBe(false)
      );
      expect(hook.result.current.streamError).toBeTruthy();
      expect(hook.result.current.canRetry).toBe(true);
      expect(hook.result.current.isSending).toBe(false);
      expect(hook.result.current.isThinking).toBe(false);
      expect(hook.result.current.isToolCalling).toBe(false);
      expect(hook.result.current.isCompressing).toBe(false);
    }
  );

  it('refuses a second retry while the first stream is still active', async () => {
    const hook = await renderProject(project({ resumeRequestId: 'run-active' }));
    const incoming = stream();
    vi.mocked(fetch).mockResolvedValueOnce(incoming.response);
    let pending!: Promise<boolean>;
    act(() => {
      pending = hook.result.current.retryLastAssistantMessage();
    });
    await waitFor(() => expect(hook.result.current.isSending).toBe(true));
    await expect(hook.result.current.retryLastAssistantMessage()).resolves.toBe(false);
    await act(async () => {
      incoming.close();
      await pending;
    });
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/ai/chat')).toHaveLength(1);
  });

  it('does not resume without a current session', async () => {
    boundary.session = null;
    const hook = await renderProject(project({ resumeRequestId: 'run-signed-out' }));
    await expect(hook.result.current.retryLastAssistantMessage()).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cancels a resumed native request without turning cancellation into a stream error', async () => {
    const cancelled = vi.fn().mockResolvedValue(undefined);
    const hook = await renderProject(
      project({ resumeRequestId: 'run-cancel', onCancel: cancelled })
    );
    vi.mocked(fetch).mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          );
        })
    );
    let pending!: Promise<boolean>;
    act(() => {
      pending = hook.result.current.retryLastAssistantMessage();
    });
    await waitFor(() => expect(hook.result.current.isSending).toBe(true));
    await act(async () => {
      await hook.result.current.cancelAssistantMessage();
      expect(await pending).toBe(false);
    });
    expect(cancelled).toHaveBeenCalledOnce();
    expect(hook.result.current.streamError).toBeNull();
    expect(hook.result.current.streamingText).toBe('');
    expect(hook.result.current.isSending).toBe(false);
  });
});
