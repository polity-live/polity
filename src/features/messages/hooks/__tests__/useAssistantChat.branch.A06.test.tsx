// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAssistantChat } from '../useAssistantChat';

const mocks = vi.hoisted(() => ({
  session: { access_token: 'token' } as any,
  skills: [] as any[],
  tools: [] as any[],
  preferredModelKey: 'openai:model-a',
  createSkill: vi.fn(),
  sendMessage: vi.fn(),
  selectedAttachments: [] as any[],
  clearAttachments: vi.fn(),
  streamPush: vi.fn(),
  streamFinish: vi.fn(),
  trailingChunk: '',
  readError: vi.fn(),
  localizeError: vi.fn(),
  buildPreview: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/features/assistant/logic/defaultAiSkills', () => ({
  DEFAULT_AI_SKILLS: [
    {
      slug: 'builtin',
      name: 'Zulu built in',
      aliases: ['built'],
      systemPrompt: 'Built prompt',
    },
    {
      slug: 'second',
      name: 'Alpha built in',
      aliases: [],
      systemPrompt: 'Second prompt',
    },
  ],
}));

vi.mock('@/lib/ai/models', () => ({
  buildAiModelKey: (model: any) => `${model.provider}:${model.id}`,
  getPreferredDefaultAiModelKey: () => mocks.preferredModelKey,
}));

vi.mock('@/lib/ai/defaultAiTools', () => ({
  DEFAULT_AI_TOOLS: [
    {
      name: 'read_polity_docs',
      label: 'Docs',
      kind: 'search',
      description: 'Read docs',
    },
    { name: 'search_web', label: 'Web', kind: 'search', description: 'Search web' },
    { name: 'create_group', label: 'Create', kind: 'create', description: 'Create group' },
    { name: 'update_group', label: 'Update', kind: 'update', description: 'Update group' },
  ],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: mocks.session }),
}));

vi.mock('@/zero/ai/useAiState', () => ({
  useAiState: () => ({ skills: mocks.skills, tools: mocks.tools }),
}));

vi.mock('@/zero/ai/useAiActions', () => ({
  useAiActions: () => ({ createSkill: mocks.createSkill }),
}));

vi.mock('../useMessageMutations', () => ({
  useMessageMutations: () => ({ sendMessage: mocks.sendMessage }),
}));

vi.mock('../useMessageAttachments', () => ({
  useMessageAttachments: () => ({
    selectedAttachments: mocks.selectedAttachments,
    attachmentOptions: ['option'],
    resolveAttachmentCardData: vi.fn(),
    addAttachment: vi.fn(),
    removeAttachment: vi.fn(),
    clearAttachments: mocks.clearAttachments,
    addUploadedFiles: vi.fn(),
    isUploadingAttachments: false,
    uploadingAttachmentName: null,
  }),
}));

vi.mock('../../logic/assistantComposer', () => ({
  slugifySkillName: (name: string) => `slug:${name.trim().toLowerCase()}`,
}));

vi.mock('../../logic/assistantStream', () => ({
  AssistantChatStreamDecoder: class {
    push(chunk: string) {
      return mocks.streamPush(chunk);
    }

    finish() {
      return mocks.streamFinish();
    }
  },
  buildToolCallPreview: (...args: any[]) => mocks.buildPreview(...args),
  readAiChatErrorResponse: (...args: any[]) => mocks.readError(...args),
}));

vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: (...args: any[]) => mocks.localizeError(...args),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation-1',
    tutorial_run_id: null,
    messages: [],
    ...overrides,
  } as any;
}

function model(id = 'model-a') {
  return {
    provider: 'openai',
    id,
    label: id,
    source: 'app',
    free: true,
    supports_reasoning_effort: true,
    context_window: 100,
  } as any;
}

function catalogResponse(models: any[] | undefined = [model()]) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ models }),
    text: vi.fn(),
  } as any;
}

function failedResponse(message = 'catalog failed') {
  return {
    ok: false,
    text: vi.fn().mockResolvedValue(message),
    json: vi.fn(),
  } as any;
}

function chatResponse(reads: { done: boolean; value?: unknown }[] = [{ done: true }], body = true) {
  const read = vi.fn();
  for (const item of reads) read.mockResolvedValueOnce(item);
  return {
    ok: true,
    body: body ? { getReader: () => ({ read }) } : null,
  } as any;
}

function renderAssistant(
  conversationValue = conversation(),
  userId: string | undefined = 'user-1'
) {
  return renderHook(
    ({ activeConversation, currentUserId }) => useAssistantChat(activeConversation, currentUserId),
    {
      initialProps: { activeConversation: conversationValue, currentUserId: userId },
    }
  );
}

async function waitForCatalog(result: { current: ReturnType<typeof useAssistantChat> }) {
  await waitFor(() => expect(result.current.isCatalogLoading).toBe(false));
}

describe('useAssistantChat branch coverage', () => {
  beforeEach(() => {
    mocks.session = { access_token: 'token' };
    mocks.skills = [];
    mocks.tools = [];
    mocks.preferredModelKey = 'openai:model-a';
    mocks.createSkill.mockReset();
    mocks.sendMessage.mockReset().mockResolvedValue({ success: true });
    mocks.selectedAttachments = [];
    mocks.clearAttachments.mockReset();
    mocks.streamPush.mockReset().mockReturnValue([]);
    mocks.streamFinish.mockReset().mockReturnValue([]);
    mocks.trailingChunk = '';
    mocks.readError.mockReset().mockResolvedValue('server-error');
    mocks.localizeError.mockReset().mockImplementation((error: unknown) => String(error));
    mocks.buildPreview.mockReset().mockReturnValue('preview');
    mocks.toastError.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogResponse()));
    vi.stubGlobal(
      'TextDecoder',
      class {
        decode(value?: unknown) {
          return value === undefined ? mocks.trailingChunk : String(value);
        }
      }
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('handles an unauthenticated catalog and exposes tutorial state', async () => {
    mocks.session = null;
    const { result } = renderAssistant(conversation({ tutorial_run_id: 'tutorial' }));

    await waitForCatalog(result);
    expect(result.current.isTutorialConversation).toBe(true);
    expect(result.current.models).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => result.current.refreshCatalog());
    expect(result.current.models).toEqual([]);
  });

  it('loads, selects, preserves, clears, and rejects catalog models', async () => {
    const fetchMock = vi.mocked(fetch);
    const { result } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));
    expect(result.current.selectedModelKey).toBe('openai:model-a');
    expect(result.current.selectedModel?.id).toBe('model-a');

    act(() => result.current.setSelectedModelKey('openai:model-a'));
    fetchMock.mockResolvedValueOnce(catalogResponse([model(), model('model-b')]));
    await act(async () => result.current.refreshCatalog());
    expect(result.current.selectedModelKey).toBe('openai:model-a');

    mocks.preferredModelKey = '';
    act(() => result.current.setSelectedModelKey('missing'));
    fetchMock.mockResolvedValueOnce(catalogResponse([model('model-b')]));
    await act(async () => result.current.refreshCatalog());
    expect(result.current.selectedModel).toBeNull();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ models: undefined }),
    } as any);
    await act(async () => result.current.refreshCatalog());
    expect(result.current.models).toEqual([]);
    expect(result.current.selectedModelKey).toBe('');

    fetchMock.mockResolvedValueOnce(failedResponse());
    await act(async () => result.current.refreshCatalog());
    expect(mocks.toastError).toHaveBeenCalledWith(
      'generated.inline.0734_failed_to_load_ai_models_9302850d'
    );
    expect(result.current.models).toEqual([]);
  });

  it('merges skills, parses aliases, filters disabled entries, and updates skill selections', async () => {
    mocks.skills = [
      {
        slug: 'builtin',
        name: 'Overridden built in',
        aliases: ' one, , two ',
        system_prompt: 'Override',
        enabled: true,
      },
      {
        slug: 'custom',
        name: 'Custom',
        aliases: null,
        system_prompt: 'Custom prompt',
        enabled: true,
      },
      {
        slug: 'disabled',
        name: 'Disabled',
        aliases: '',
        system_prompt: 'No',
        enabled: false,
      },
    ];
    const { result, rerender } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));
    expect(result.current.availableSkills.map(skill => skill.slug)).toEqual([
      'second',
      'custom',
      'builtin',
    ]);
    expect(result.current.availableSkills.find(skill => skill.slug === 'builtin')?.aliases).toEqual(
      ['one', 'two']
    );
    expect(result.current.availableSkills.find(skill => skill.slug === 'builtin')?.isBuiltIn).toBe(
      true
    );
    expect(result.current.availableSkills.find(skill => skill.slug === 'custom')?.isBuiltIn).toBe(
      false
    );

    act(() => result.current.setSkillSelection('custom', true));
    act(() => result.current.setSkillSelection('custom', true));
    expect(result.current.selectedSkills.map(skill => skill.slug)).toEqual(['custom']);
    act(() => result.current.setSkillSelection('custom', false));
    act(() => result.current.setSkillSelection('missing', false));
    expect(result.current.selectedSkills).toEqual([]);

    act(() => result.current.toggleSelectedSkillSlug('builtin'));
    act(() => result.current.toggleSelectedSkillSlug('missing'));
    expect(result.current.selectedSkills.map(skill => skill.slug)).toEqual(['builtin']);
    act(() => result.current.toggleSelectedSkillSlug('builtin'));
    expect(result.current.selectedSkillSlugs).toEqual(['missing']);

    mocks.skills = [];
    rerender({ activeConversation: conversation(), currentUserId: 'user-1' });
    await waitFor(() => expect(result.current.selectedSkillSlugs).toEqual([]));
  });

  it('merges tool overrides and supports individual and group selection branches', async () => {
    mocks.tools = [
      { tool_name: 'search_web', enabled: false },
      { tool_name: 'create_group', enabled: true },
    ];
    const { result, rerender } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));
    await waitFor(() =>
      expect(result.current.selectedToolNames).toEqual([
        'create_group',
        'read_polity_docs',
        'update_group',
      ])
    );
    expect(result.current.availableTools.find(tool => tool.name === 'read_polity_docs')).toEqual(
      expect.objectContaining({ enabled: true, alwaysActive: true })
    );
    expect(
      result.current.availableTools.find(tool => String(tool.name) === 'search_web')?.enabled
    ).toBe(false);

    mocks.tools = [...mocks.tools];
    rerender({ activeConversation: conversation(), currentUserId: 'user-1' });
    await waitFor(() => expect(result.current.selectedToolNames).toHaveLength(3));

    act(() => result.current.toggleSelectedToolName('missing_tool' as any));
    expect(result.current.selectedToolNames).toContain('missing_tool');
    expect(result.current.selectedTools.every(tool => tool.name !== ('missing_tool' as any))).toBe(
      true
    );
    act(() => result.current.toggleSelectedToolName('missing_tool' as any));

    act(() => result.current.setToolSelection('read_polity_docs' as any, false));
    act(() => result.current.toggleSelectedToolName('read_polity_docs' as any));
    expect(result.current.selectedToolNames).toContain('read_polity_docs');

    act(() => result.current.setToolSelection('search_web' as any, true));
    act(() => result.current.setToolSelection('search_web' as any, true));
    act(() => result.current.setToolSelection('search_web' as any, false));
    act(() => result.current.setToolSelection('search_web' as any, false));
    act(() => result.current.toggleSelectedToolName('search_web' as any));
    act(() => result.current.toggleSelectedToolName('search_web' as any));

    act(() => result.current.setToolGroupSelection('search', true));
    expect(result.current.selectedToolNames).toContain('search_web');
    act(() => result.current.setToolGroupSelection('search', true));
    act(() => result.current.setToolGroupSelection('search', false));
    expect(result.current.selectedToolNames).toContain('read_polity_docs');
    expect(result.current.selectedToolNames).not.toContain('search_web');

    act(() => result.current.toggleSelectedToolName('create_group' as any));
    mocks.tools = [];
    rerender({ activeConversation: conversation(), currentUserId: 'user-1' });
    expect(result.current.selectedToolNames).not.toContain('create_group');
  });

  it('creates skills using explicit and generated slugs', async () => {
    const { result } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));

    let slug = '';
    act(() => {
      slug = result.current.createSkill({
        name: ' Custom Name ',
        slug: ' explicit ',
        aliases: ' aliases ',
        systemPrompt: ' prompt ',
      });
    });
    expect(slug).toBe('explicit');
    expect(mocks.createSkill).toHaveBeenLastCalledWith({
      slug: 'explicit',
      name: 'Custom Name',
      aliases: 'aliases',
      system_prompt: 'prompt',
    });

    act(() => {
      slug = result.current.createSkill({ name: ' Generated ', systemPrompt: ' prompt ' });
    });
    expect(slug).toBe('slug:generated');
    expect(mocks.createSkill.mock.calls.at(-1)?.[0].aliases).toBeUndefined();
  });

  it('guards message sending for user, session, and model prerequisites', async () => {
    const missingUser = renderAssistant(conversation(), '');
    await waitForCatalog(missingUser.result);
    await expect(missingUser.result.current.sendAssistantMessage('hello')).resolves.toBe(false);
    expect(mocks.toastError).toHaveBeenLastCalledWith('features.messages.ai.authRequired');
    missingUser.unmount();

    mocks.session = null;
    const missingSession = renderAssistant();
    await waitForCatalog(missingSession.result);
    await expect(missingSession.result.current.sendAssistantMessage('hello')).resolves.toBe(false);
    expect(mocks.toastError).toHaveBeenLastCalledWith('features.messages.ai.sessionMissing');
    missingSession.unmount();

    mocks.session = { access_token: 'token' };
    mocks.preferredModelKey = '';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogResponse([])));
    const missingModel = renderAssistant();
    await waitForCatalog(missingModel.result);
    await expect(missingModel.result.current.sendAssistantMessage('hello')).resolves.toBe(false);
    expect(mocks.toastError).toHaveBeenLastCalledWith('features.messages.ai.modelRequired');
  });

  it('persists a normal message with skills, attachments, callback, and an empty stream', async () => {
    mocks.skills = [
      {
        slug: 'custom',
        name: 'Custom',
        aliases: null,
        system_prompt: 'Skill context',
        enabled: true,
      },
    ];
    mocks.selectedAttachments = [
      { entityType: 'todo', entityId: 'todo-1', title: 'Todo', prompt_context: 'Todo context' },
    ];
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(catalogResponse()).mockResolvedValueOnce(chatResponse());
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: '' }) }) as any
    );
    const callback = vi.fn();
    const { result } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));
    act(() => result.current.setSkillSelection('custom', true));

    await act(async () => {
      expect(
        await result.current.sendAssistantMessage('hello', { onUserMessageSent: callback })
      ).toBe(true);
    });

    expect(mocks.sendMessage).toHaveBeenCalledWith(
      'conversation-1',
      'user-1',
      'hello',
      undefined,
      expect.objectContaining({ contextJson: expect.stringContaining('Skill context') })
    );
    expect(callback).toHaveBeenCalledOnce();
    expect(mocks.clearAttachments).toHaveBeenCalledOnce();
    const chatRequest = fetchMock.mock.calls.find(([url]) => url === '/api/ai/chat');
    expect(chatRequest).toBeDefined();
    if (!chatRequest) throw new Error('Expected an AI chat request');
    expect(JSON.parse(String((chatRequest[1] as RequestInit).body))).toEqual(
      expect.objectContaining({
        conversationId: 'conversation-1',
        model: { provider: 'openai', id: 'model-a' },
        timeZone: 'UTC',
        attachments: expect.arrayContaining([
          expect.objectContaining({ entityType: 'todo' }),
          expect.objectContaining({ entityType: 'skill', entityId: 'custom' }),
        ]),
      })
    );
    expect(result.current.streamingText).toBe('');
    expect(result.current.isSending).toBe(false);
  });

  it('returns early when user-message persistence fails', async () => {
    mocks.sendMessage.mockResolvedValueOnce({ success: false });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(catalogResponse());
    const { result } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));

    await act(async () => {
      expect(await result.current.sendAssistantMessage('not sent')).toBe(false);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isSending).toBe(false);
  });

  it('handles missing bodies and non-ok chat responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(catalogResponse())
      .mockResolvedValueOnce({ ok: false } as any)
      .mockResolvedValueOnce(chatResponse([], false));
    mocks.localizeError.mockReturnValueOnce('localized-server-error');
    const { result } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));

    await act(async () => {
      expect(await result.current.sendAssistantMessage('first')).toBe(false);
    });
    expect(result.current.streamError).toBe('localized-server-error');
    expect(mocks.readError).toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.sendAssistantMessage('second')).toBe(false);
    });
    expect(result.current.streamError).toBe('features.messages.ai.sendFailed');
  });

  it('processes every stream event, chunks, trailing data, and persistence acknowledgement', async () => {
    const eventsByChunk: Record<string, any[]> = {
      first: [
        { type: 'compression-start' },
        { type: 'text-delta', text: '' },
        { type: 'tool-call-delta' },
        { type: 'tool-call', toolName: 'search_web', args: { q: 'query' } },
        { type: 'tool-result' },
      ],
      second: [{ type: 'text-delta', text: ' Hello ' }],
      trailing: [{ type: 'tool-call', toolName: null, args: {} }],
    };
    mocks.streamPush.mockImplementation((chunk: string) => eventsByChunk[chunk] ?? []);
    mocks.streamFinish.mockReturnValue([
      { type: 'tool-call', toolName: 'unknown_tool', args: null },
      { type: 'text-delta', text: 'world' },
    ]);
    mocks.trailingChunk = 'trailing';
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(catalogResponse())
      .mockResolvedValueOnce(
        chatResponse([
          { done: false, value: 'first' },
          { done: false, value: '' },
          { done: false, value: 'second' },
          { done: true },
        ])
      );
    const { result, rerender } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));

    await act(async () => {
      expect(await result.current.sendAssistantMessage('stream')).toBe(true);
    });
    expect(result.current.streamingText).toBe(' Hello world');
    expect(mocks.buildPreview).toHaveBeenCalledWith(null, {});
    expect(mocks.buildPreview).toHaveBeenCalledWith('unknown_tool', null);
    expect(result.current.activeToolCall).toBeNull();

    rerender({
      activeConversation: conversation({
        messages: [
          { sender: { id: 'user-1' }, content: 'own message' },
          { sender: { id: 'assistant' }, content: ' Hello world ' },
        ],
      }),
      currentUserId: 'user-1',
    });
    await waitFor(() => expect(result.current.streamingText).toBe(''));
  });

  it('handles stream errors and retries the exact failed request without persisting twice', async () => {
    mocks.streamPush.mockReturnValue([{ type: 'error', error: 'stream exploded' }]);
    mocks.localizeError.mockReturnValue('localized-stream-error');
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(catalogResponse())
      .mockResolvedValueOnce(chatResponse([{ done: false, value: 'error' }]))
      .mockResolvedValueOnce(chatResponse());
    const { result } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));

    await act(async () => {
      expect(await result.current.sendAssistantMessage('retry me')).toBe(false);
    });
    expect(result.current.streamError).toBe('localized-stream-error');
    expect(result.current.canRetry).toBe(true);

    mocks.streamPush.mockReturnValue([]);
    await act(async () => {
      expect(await result.current.retryLastAssistantMessage()).toBe(true);
    });
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(result.current.canRetry).toBe(false);
    await expect(result.current.retryLastAssistantMessage()).resolves.toBe(false);
  });

  it('uses fallback errors for non-errors and empty Error messages', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(catalogResponse())
      .mockRejectedValueOnce('plain failure')
      .mockRejectedValueOnce(new Error(''));
    const { result } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));

    await act(async () => {
      expect(await result.current.sendAssistantMessage('plain')).toBe(false);
    });
    expect(result.current.streamError).toBe('features.messages.ai.sendFailed');

    await act(async () => {
      expect(await result.current.sendAssistantMessage('empty')).toBe(false);
    });
    expect(result.current.streamError).toBe('features.messages.ai.sendFailed');
  });

  it('sends a request override without a model, attachment enrichment, or persistence', async () => {
    mocks.preferredModelKey = '';
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(catalogResponse([])).mockResolvedValueOnce(chatResponse());
    const { result } = renderAssistant();
    await waitForCatalog(result);
    const requestOverride = {
      conversationId: 'override-conversation',
      content: 'override',
      model: { provider: 'openai', id: 'override-model' },
      reasoningEffort: 'high',
      skillSlugs: [],
      toolNames: [],
      attachments: [{ entityType: 'group', entityId: 'group-1', title: 'Group' }],
      timeZone: 'UTC',
    } as any;

    await act(async () => {
      expect(
        await result.current.sendAssistantMessage('ignored', {
          skipUserMessagePersistence: true,
          requestOverride,
        })
      ).toBe(true);
    });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.at(-1)?.[1]).toEqual(
      expect.objectContaining({ body: JSON.stringify(requestOverride) })
    );
  });

  it('resets transient state when the conversation changes', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(catalogResponse()).mockRejectedValueOnce(new Error('failed'));
    const { result, rerender } = renderAssistant();
    await waitFor(() => expect(result.current.models).toHaveLength(1));
    act(() => result.current.setSkillSelection('builtin', true));
    act(() => result.current.setToolSelection('search_web' as any, false));
    await act(async () => result.current.sendAssistantMessage('fail'));
    expect(result.current.streamError).toBe('failed');

    rerender({
      activeConversation: conversation({ id: 'conversation-2' }),
      currentUserId: 'user-1',
    });
    await waitFor(() => expect(result.current.streamError).toBeNull());
    expect(result.current.streamingText).toBe('');
    expect(result.current.isSending).toBe(false);
  });
});
