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
  buildCurrentUserScopePrompt: vi.fn(),
  streamText: vi.fn(),
  persistAssistantMessage: vi.fn(),
  buildAiTools: vi.fn(() => ({ present_findings: {} })),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));

vi.mock('ai', () => ({
  stepCountIs: vi.fn(),
  streamText: mocks.streamText,
}));

vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/ai-models', () => ({
  getAiCatalog: mocks.getAiCatalog,
  resolveLanguageModelForUser: mocks.resolveLanguageModelForUser,
}));
vi.mock('@/server/ai-db', () => ({
  enrichAiAttachmentsForPrompt: mocks.enrichAiAttachmentsForPrompt,
  enrichAiAttachmentsFromContextJson: vi.fn(),
  getAiSkillsBySlugs: mocks.getAiSkillsBySlugs,
  getAiToolsByNames: mocks.getAiToolsByNames,
  getAssistantConversationForUser: mocks.getAssistantConversationForUser,
  getConversationMessagesForAi: mocks.getConversationMessagesForAi,
  isAssistantSender: vi.fn(),
  persistAssistantMessage: mocks.persistAssistantMessage,
  touchAiCredential: vi.fn(),
}));
vi.mock('@/server/ai-tools', () => ({
  buildAiTools: mocks.buildAiTools,
  buildCurrentUserScopePrompt: mocks.buildCurrentUserScopePrompt,
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

describe('AI chat route setup errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiSkillsBySlugs.mockResolvedValue([]);
    mocks.getAiToolsByNames.mockResolvedValue([]);
    mocks.getConversationMessagesForAi.mockResolvedValue([]);
    mocks.enrichAiAttachmentsForPrompt.mockResolvedValue([]);
    mocks.buildCurrentUserScopePrompt.mockResolvedValue('Current user: user-1');
  });

  it('returns a structured 401 response', async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await handleAiChatRequest(chatRequest(validBody));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns a structured 400 response for invalid input', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    const response = await handleAiChatRequest(chatRequest({ content: '' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('returns a structured 403 response for another conversation', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.getAssistantConversationForUser.mockResolvedValue(null);
    const response = await handleAiChatRequest(chatRequest(validBody));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
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
    await expect(response.json()).resolves.toMatchObject({ code: 'MODEL_UNAVAILABLE' });
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
      code: 'CHAT_SETUP_FAILED',
      message: 'The AI response could not be started.',
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
      toolResults: [{ result: { attachments: [attachment], presentations: [presentation] } }],
    });
    await streamOptions.onFinish({ text: 'Short summary.', toolResults: [] });

    expect(mocks.persistAssistantMessage).toHaveBeenCalledWith('conversation-1', 'Short summary.', {
      version: 1,
      attachments: [attachment],
      presentations: [presentation],
    });
  });
});
