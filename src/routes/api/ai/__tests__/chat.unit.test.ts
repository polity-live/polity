import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAssistantConversationForUser: vi.fn(),
  getAiCatalog: vi.fn(),
  resolveLanguageModelForUser: vi.fn(),
  getAiSkillsBySlugs: vi.fn(),
  getAiToolsByNames: vi.fn(),
  getConversationMessagesForAi: vi.fn(),
  enrichAiAttachmentsForPrompt: vi.fn(),
  enrichAiAttachmentsFromContextJson: vi.fn(),
  buildCurrentUserScopePrompt: vi.fn(),
  compressHistory: vi.fn(),
  isAssistantSender: vi.fn(),
  stepCountIs: vi.fn(),
  streamText: vi.fn(),
  touchAiCredential: vi.fn(),
  persistAssistantMessage: vi.fn(),
  setAssistantConversationTitle: vi.fn(),
  buildAiTools: vi.fn(() => ({ present_findings: {} })),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));

vi.mock('ai', () => ({
  stepCountIs: mocks.stepCountIs,
  streamText: mocks.streamText,
  tool: vi.fn(definition => definition),
}));

vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/ai-models', () => ({
  getAiCatalog: mocks.getAiCatalog,
  resolveLanguageModelForUser: mocks.resolveLanguageModelForUser,
}));
vi.mock('@/server/ai-db', () => ({
  enrichAiAttachmentsForPrompt: mocks.enrichAiAttachmentsForPrompt,
  enrichAiAttachmentsFromContextJson: mocks.enrichAiAttachmentsFromContextJson,
  getAiSkillsBySlugs: mocks.getAiSkillsBySlugs,
  getAiToolsByNames: mocks.getAiToolsByNames,
  getAssistantConversationForUser: mocks.getAssistantConversationForUser,
  getConversationMessagesForAi: mocks.getConversationMessagesForAi,
  isAssistantSender: mocks.isAssistantSender,
  persistAssistantMessage: mocks.persistAssistantMessage,
  setAssistantConversationTitle: mocks.setAssistantConversationTitle,
  touchAiCredential: mocks.touchAiCredential,
}));
vi.mock('@/server/ai-tools', () => ({
  buildAiTools: mocks.buildAiTools,
  buildCurrentUserScopePrompt: mocks.buildCurrentUserScopePrompt,
}));
vi.mock('@/lib/ai/historyCompression', () => ({
  compressConversationHistory: (input: Record<string, any>) => mocks.compressHistory(input),
}));

import { handleAiChatRequest } from '../chat';

const validBody = {
  conversationId: 'conversation-1',
  content: 'Hello',
  model: { provider: 'openrouter', id: 'openrouter/free' },
  reasoningEffort: 'medium',
  skillSlugs: [],
  toolNames: [],
  attachments: [],
};

function chatRequest(body: unknown) {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockSuccessfulChatSetup(options?: {
  conversationName?: string;
  contextWindow?: number | null;
  tutorialRunId?: string | null;
  history?: {
    id: string;
    sender_id: string;
    content: string;
    context_json: string;
    created_at: string;
  }[];
  fullStream?: AsyncIterable<Record<string, unknown>>;
}) {
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.getAssistantConversationForUser.mockResolvedValue({
    id: 'conversation-1',
    assistant_for_user_id: 'user-1',
    name: options?.conversationName ?? null,
    tutorial_run_id: options?.tutorialRunId ?? null,
  });
  mocks.getAiCatalog.mockResolvedValue({
    credentials: [],
    models: [
      {
        provider: 'openrouter',
        id: 'openrouter/free',
        label: 'Free Models Router',
        source: 'app',
        free: true,
        supports_reasoning_effort: true,
        context_window: options?.contextWindow === undefined ? 200000 : options.contextWindow,
      },
    ],
  });
  mocks.resolveLanguageModelForUser.mockResolvedValue({
    model: { modelId: 'openrouter/free' },
    credentialProvider: null,
  });
  mocks.getConversationMessagesForAi.mockResolvedValue(options?.history ?? []);
  mocks.streamText.mockReturnValue({
    fullStream:
      options?.fullStream ??
      (async function* () {
        yield* [];
      })(),
  });
}

describe('AI chat route setup errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiSkillsBySlugs.mockResolvedValue([]);
    mocks.getAiToolsByNames.mockResolvedValue([]);
    mocks.getConversationMessagesForAi.mockResolvedValue([]);
    mocks.enrichAiAttachmentsForPrompt.mockResolvedValue([]);
    mocks.enrichAiAttachmentsFromContextJson.mockResolvedValue([]);
    mocks.buildCurrentUserScopePrompt.mockResolvedValue('Current user: user-1');
    mocks.isAssistantSender.mockImplementation(senderId => senderId === 'assistant-1');
    mocks.setAssistantConversationTitle.mockResolvedValue(true);
    mocks.compressHistory.mockImplementation(input => ({
      messages: input.messages,
      wasCompressed: false,
      compressedMessageCount: 0,
    }));
  });

  it('returns a structured 401 response', async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await handleAiChatRequest(chatRequest(validBody));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { version: 1, code: 'permission_denied' },
    });
  });

  it('returns a structured 400 response for invalid input', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    const response = await handleAiChatRequest(chatRequest({ content: '' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { version: 1, code: 'validation_failed' },
    });
  });

  it('returns a structured 403 response for another conversation', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.getAssistantConversationForUser.mockResolvedValue(null);
    const response = await handleAiChatRequest(chatRequest(validBody));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { version: 1, code: 'permission_denied' },
    });
  });

  it('returns a structured model-unavailable response', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.getAssistantConversationForUser.mockResolvedValue({
      id: 'conversation-1',
      assistant_for_user_id: 'user-1',
    });
    mocks.getAiCatalog.mockResolvedValue({ credentials: [], models: [] });

    const response = await handleAiChatRequest(chatRequest(validBody));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { version: 1, code: 'ai_model_unavailable' },
    });
  });

  it('hides unexpected setup details behind a stable 500 response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.getAssistantConversationForUser.mockRejectedValue(
      new Error('permission denied for table conversation')
    );

    const response = await handleAiChatRequest(chatRequest(validBody));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        version: 1,
        code: 'ai_operation_failed',
      },
    });
    consoleSpy.mockRestore();
  });

  it('streams successful text as NDJSON', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.getAssistantConversationForUser.mockResolvedValue({
      id: 'conversation-1',
      assistant_for_user_id: 'user-1',
    });
    mocks.getAiCatalog.mockResolvedValue({
      credentials: [],
      models: [
        {
          provider: 'openrouter',
          id: 'openrouter/free',
          label: 'Free Models Router',
          source: 'app',
          free: true,
          supports_reasoning_effort: true,
          context_window: 200000,
        },
      ],
    });
    mocks.resolveLanguageModelForUser.mockResolvedValue({
      model: { modelId: 'openrouter/free' },
      credentialProvider: null,
    });
    mocks.streamText.mockReturnValue({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'Hello' };
        yield { type: 'text-delta', text: ' world' };
      })(),
    });

    const response = await handleAiChatRequest(chatRequest(validBody));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/x-ndjson');
    expect(await response.text()).toBe(
      '{"type":"text-delta","text":"Hello"}\n' + '{"type":"text-delta","text":" world"}\n'
    );
  });

  it('enables the internal title tool on the first user message and hides it from the stream', async () => {
    const fullStream = (async function* () {
      yield {
        type: 'tool-call',
        toolName: 'set_chat_title',
        input: { title: 'Kommunale Beteiligung verbessern' },
      };
      yield { type: 'tool-result', toolName: 'set_chat_title' };
      yield { type: 'text-delta', text: 'Hier ist meine Antwort.' };
    })();
    mockSuccessfulChatSetup({
      conversationName: 'Assistent Aria & Kai',
      history: [
        {
          id: 'welcome',
          sender_id: 'assistant-1',
          content: 'Willkommen',
          context_json: '[]',
          created_at: '2026-07-26T10:00:00.000Z',
        },
      ],
      fullStream,
    });
    let streamOptions: any;
    mocks.streamText.mockImplementation(options => {
      streamOptions = options;
      return { fullStream };
    });

    const response = await handleAiChatRequest(chatRequest(validBody));

    expect(await response.text()).toBe('{"type":"text-delta","text":"Hier ist meine Antwort."}\n');
    expect(streamOptions.activeTools).toContain('set_chat_title');
    expect(streamOptions.system).toContain('call set_chat_title exactly once');
    expect(streamOptions.system).toContain('Pass the title as plain text only');
    expect(streamOptions.system).toContain('Do not use Markdown');
    expect(mocks.stepCountIs).toHaveBeenCalledWith(5);

    await expect(
      streamOptions.tools.set_chat_title.execute({
        title: 'Kommunale Beteiligung verbessern',
      })
    ).resolves.toEqual({ updated: true });
    expect(mocks.setAssistantConversationTitle).toHaveBeenCalledWith(
      'user-1',
      'conversation-1',
      'Kommunale Beteiligung verbessern'
    );
  });

  it('recognizes the first turn when the current user message is already persisted', async () => {
    mockSuccessfulChatSetup({
      conversationName: 'Assistent Aria & Kai',
      history: [
        {
          id: 'welcome',
          sender_id: 'assistant-1',
          content: 'Willkommen',
          context_json: '[]',
          created_at: '2026-07-26T10:00:00.000Z',
        },
        {
          id: 'question',
          sender_id: 'user-1',
          content: 'Hello',
          context_json: '[]',
          created_at: '2026-07-26T10:01:00.000Z',
        },
      ],
    });
    let streamOptions: any;
    mocks.streamText.mockImplementation(options => {
      streamOptions = options;
      return {
        fullStream: (async function* () {
          yield* [];
        })(),
      };
    });

    const response = await handleAiChatRequest(chatRequest(validBody));
    await response.text();

    expect(streamOptions.activeTools).toContain('set_chat_title');
    expect(mocks.stepCountIs).toHaveBeenCalledWith(5);
  });

  it.each([
    {
      label: 'a later user message',
      conversationName: 'Assistent Aria & Kai',
      history: [
        {
          id: 'welcome',
          sender_id: 'assistant-1',
          content: 'Willkommen',
          context_json: '[]',
          created_at: '2026-07-26T10:00:00.000Z',
        },
        {
          id: 'question-1',
          sender_id: 'user-1',
          content: 'Erste Frage',
          context_json: '[]',
          created_at: '2026-07-26T10:01:00.000Z',
        },
        {
          id: 'answer-1',
          sender_id: 'assistant-1',
          content: 'Erste Antwort',
          context_json: '[]',
          created_at: '2026-07-26T10:02:00.000Z',
        },
        {
          id: 'question-2',
          sender_id: 'user-1',
          content: 'Zweite Frage',
          context_json: '[]',
          created_at: '2026-07-26T10:03:00.000Z',
        },
      ],
    },
    {
      label: 'a manually renamed chat',
      conversationName: 'Mein eigener Titel',
      history: [
        {
          id: 'welcome',
          sender_id: 'assistant-1',
          content: 'Willkommen',
          context_json: '[]',
          created_at: '2026-07-26T10:00:00.000Z',
        },
      ],
    },
  ])('does not enable the title tool for $label', async ({ conversationName, history }) => {
    mockSuccessfulChatSetup({ conversationName, history });
    let streamOptions: any;
    mocks.streamText.mockImplementation(options => {
      streamOptions = options;
      return {
        fullStream: (async function* () {
          yield* [];
        })(),
      };
    });

    const response = await handleAiChatRequest(chatRequest(validBody));
    await response.text();

    expect(streamOptions.tools).not.toHaveProperty('set_chat_title');
    expect(streamOptions.activeTools).not.toContain('set_chat_title');
    expect(mocks.stepCountIs).toHaveBeenCalledWith(4);
  });

  it('keeps title update failures from interrupting the assistant response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSuccessfulChatSetup({
      conversationName: 'Assistent Aria & Kai',
      history: [
        {
          id: 'welcome',
          sender_id: 'assistant-1',
          content: 'Willkommen',
          context_json: '[]',
          created_at: '2026-07-26T10:00:00.000Z',
        },
      ],
    });
    let streamOptions: any;
    mocks.streamText.mockImplementation(options => {
      streamOptions = options;
      return {
        fullStream: (async function* () {
          yield { type: 'text-delta', text: 'Antwort trotz Titelfehler' };
        })(),
      };
    });
    mocks.setAssistantConversationTitle.mockRejectedValue(new Error('database unavailable'));

    const response = await handleAiChatRequest(chatRequest(validBody));

    await expect(
      streamOptions.tools.set_chat_title.execute({ title: 'Sinnvoller Titel' })
    ).resolves.toEqual({ updated: false });
    expect(await response.text()).toBe(
      '{"type":"text-delta","text":"Antwort trotz Titelfehler"}\n'
    );
    consoleSpy.mockRestore();
  });

  it('persists combined entity attachments and findings in the V1 context', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.getAssistantConversationForUser.mockResolvedValue({
      id: 'conversation-1',
      assistant_for_user_id: 'user-1',
    });
    mocks.getAiCatalog.mockResolvedValue({
      credentials: [],
      models: [
        {
          provider: 'openrouter',
          id: 'openrouter/free',
          label: 'Free Models Router',
          source: 'app',
          free: true,
          supports_reasoning_effort: true,
          context_window: 200000,
        },
      ],
    });
    mocks.resolveLanguageModelForUser.mockResolvedValue({
      model: { modelId: 'openrouter/free' },
      credentialProvider: null,
    });
    let streamOptions: any;
    mocks.streamText.mockImplementation(options => {
      streamOptions = options;
      return {
        fullStream: (async function* () {
          yield* [];
        })(),
      };
    });

    const response = await handleAiChatRequest(chatRequest(validBody));
    await response.text();
    const attachment = { entityType: 'group', entityId: 'group-1', title: 'Group' };
    const finalAttachment = { entityType: 'event', entityId: 'event-1', title: 'Event' };
    const presentation = {
      type: 'findings',
      id: 'findings-1',
      title: 'Comparison',
      items: [
        { id: 'a', title: 'A', description: 'First', tone: 'neutral' },
        { id: 'b', title: 'B', description: 'Second', tone: 'info' },
      ],
    };
    await streamOptions.onStepFinish({
      toolResults: [{ output: { attachments: [attachment], presentations: [presentation] } }],
    });
    await streamOptions.onFinish({
      text: 'Short summary.',
      toolResults: [{ output: { attachments: [finalAttachment], presentations: [presentation] } }],
    });

    expect(mocks.persistAssistantMessage).toHaveBeenCalledWith('conversation-1', 'Short summary.', {
      version: 1,
      attachments: [attachment, finalAttachment],
      presentations: [presentation],
    });
  });

  it('adds tutorial skills and tools while filtering disabled and unknown skills', async () => {
    mockSuccessfulChatSetup({
      contextWindow: null,
      tutorialRunId: 'tutorial-1',
      history: [
        {
          id: 'assistant-null',
          sender_id: 'assistant-1',
          content: null as unknown as string,
          context_json: '[]',
          created_at: '2026-07-26T10:00:00.000Z',
        },
        {
          id: 'user-null',
          sender_id: 'user-1',
          content: null as unknown as string,
          context_json: '[]',
          created_at: '2026-07-26T10:01:00.000Z',
        },
      ],
    });
    mocks.getAiSkillsBySlugs.mockResolvedValue([
      {
        slug: 'custom-enabled',
        name: 'Enabled skill',
        system_prompt: 'Enabled prompt',
        enabled: true,
      },
      {
        slug: 'custom-disabled',
        name: 'Disabled skill',
        system_prompt: 'Disabled prompt',
        enabled: false,
      },
    ]);
    mocks.getAiToolsByNames.mockResolvedValue([{ tool_name: 'create_todo', enabled: true }]);
    mocks.buildAiTools.mockReturnValueOnce({ present_findings: {}, create_todo: {} } as any);
    let streamOptions: any;
    mocks.streamText.mockImplementation(options => {
      streamOptions = options;
      return {
        fullStream: (async function* () {
          yield* [];
        })(),
      };
    });

    const response = await handleAiChatRequest(
      chatRequest({
        ...validBody,
        skillSlugs: ['custom-enabled', 'custom-disabled', 'unknown', 'live-tutorial'],
        toolNames: ['create_todo'],
      })
    );
    await response.text();

    expect(mocks.getAiSkillsBySlugs).toHaveBeenCalledWith('user-1', [
      'custom-enabled',
      'custom-disabled',
      'unknown',
      'live-tutorial',
    ]);
    expect(mocks.getAiToolsByNames).toHaveBeenCalledWith('user-1', ['create_todo']);
    expect(streamOptions.system).toContain('Enabled prompt');
    expect(streamOptions.system).not.toContain('Disabled prompt');
    expect(streamOptions.activeTools).toContain('create_todo');
  });

  it('streams compression, public tool events, errors and ignored stream parts', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fullStream = (async function* () {
      yield { type: 'tool-call', toolName: 'create_todo', input: { title: 'Task' } };
      yield { type: 'tool-result', toolName: 'create_todo' };
      yield { type: 'finish-step' };
      yield { type: 'error', error: new Error('provider failed') };
    })();
    mockSuccessfulChatSetup({ fullStream });
    mocks.compressHistory.mockImplementation(input => ({
      messages: input.messages,
      wasCompressed: true,
      compressedMessageCount: 3,
    }));

    const response = await handleAiChatRequest(chatRequest(validBody));
    const text = await response.text();
    expect(text).toContain('"type":"compression-start"');
    expect(text).toContain('"type":"tool-call"');
    expect(text).toContain('"type":"tool-result"');
    expect(text).toContain('"type":"error"');
    errorSpy.mockRestore();
  });

  it('persists attachment-only output, touches credentials and isolates finish hooks', async () => {
    mockSuccessfulChatSetup();
    mocks.resolveLanguageModelForUser.mockResolvedValue({
      model: { modelId: 'openrouter/free' },
      credentialProvider: 'openrouter',
    });
    let streamOptions: any;
    mocks.streamText.mockImplementation(options => {
      streamOptions = options;
      return {
        fullStream: (async function* () {
          yield* [];
        })(),
      };
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await handleAiChatRequest(chatRequest(validBody));
    await response.text();

    await streamOptions.onFinish({ text: '   ', toolResults: [] });
    expect(mocks.persistAssistantMessage).not.toHaveBeenCalled();

    await streamOptions.onFinish({
      text: '   ',
      toolResults: [
        {
          output: {
            attachments: [{ entityType: 'group', entityId: 'group-1', title: 'Group' }],
          },
        },
      ],
    });
    expect(mocks.persistAssistantMessage).toHaveBeenCalled();
    expect(mocks.touchAiCredential).toHaveBeenCalledWith('user-1', 'openrouter');

    await streamOptions.onStepFinish({ toolResults: undefined });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to collect AI tool attachments:',
      expect.any(Error)
    );

    mocks.persistAssistantMessage.mockRejectedValueOnce(new Error('database failed'));
    await streamOptions.onFinish({ text: 'answer', toolResults: [] });
    expect(errorSpy).toHaveBeenCalledWith('Failed to persist AI chat response:', expect.any(Error));
    errorSpy.mockRestore();
  });
});
