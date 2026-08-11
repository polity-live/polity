import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConversation: vi.fn(),
  getCatalog: vi.fn(),
  resolveModel: vi.fn(),
  getSkills: vi.fn(),
  getTools: vi.fn(),
  getMessages: vi.fn(),
  enrichPrompt: vi.fn(),
  enrichContext: vi.fn(),
  currentScope: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock('ai', () => ({
  stepCountIs: vi.fn(),
  streamText: mocks.streamText,
  tool: vi.fn((definition: unknown) => definition),
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/ai-models', () => ({
  getAiCatalog: mocks.getCatalog,
  resolveLanguageModelForUser: mocks.resolveModel,
}));
vi.mock('@/server/ai-db', () => ({
  enrichAiAttachmentsForPrompt: mocks.enrichPrompt,
  enrichAiAttachmentsFromContextJson: mocks.enrichContext,
  getAiSkillsBySlugs: mocks.getSkills,
  getAiToolsByNames: mocks.getTools,
  getAssistantConversationForUser: mocks.getConversation,
  getConversationMessagesForAi: mocks.getMessages,
  isAssistantSender: () => false,
  persistAssistantMessage: vi.fn(),
  setAssistantConversationTitle: vi.fn(),
  touchAiCredential: vi.fn(),
}));
vi.mock('@/server/ai-tools', () => ({
  buildAiTools: () => ({ present_findings: {} }),
  buildCurrentUserScopePrompt: mocks.currentScope,
}));
vi.mock('@/lib/ai/historyCompression', () => ({
  compressConversationHistory: (input: any) => ({
    messages: input.messages,
    wasCompressed: false,
    compressedMessageCount: 0,
  }),
}));

import { handleAiChatRequest } from '../chat';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user' } });
  mocks.getConversation.mockResolvedValue({
    id: 'conversation',
    assistant_for_user_id: 'user',
    name: 'Existing chat',
    tutorial_run_id: null,
  });
  mocks.getCatalog.mockResolvedValue({
    credentials: [],
    models: [
      {
        provider: 'openrouter',
        id: 'openrouter/free',
        label: 'Free',
        source: 'app',
        free: true,
        supports_reasoning_effort: true,
        context_window: 1000,
      },
    ],
  });
  mocks.resolveModel.mockResolvedValue({ model: {}, credentialProvider: null });
  mocks.getSkills.mockResolvedValue([]);
  mocks.getTools.mockResolvedValue([]);
  mocks.getMessages.mockResolvedValue([]);
  mocks.enrichPrompt.mockResolvedValue([]);
  mocks.enrichContext.mockResolvedValue([]);
  mocks.currentScope.mockResolvedValue('scope');
});

it('serializes an error when the AI stream iterator throws', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.streamText.mockReturnValue({
    fullStream: (async function* () {
      yield* [];
      throw new Error('stream disconnected');
    })(),
  });
  const response = await handleAiChatRequest(
    new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conversation',
        content: 'Hello',
        model: { provider: 'openrouter', id: 'openrouter/free' },
        reasoningEffort: 'medium',
        skillSlugs: [],
        toolNames: [],
        attachments: [],
      }),
    })
  );

  const body = await response.text();
  expect(body).toContain('"type":"error"');
  expect(errorSpy).toHaveBeenCalledWith(
    'AI chat stream failed after response started:',
    expect.any(Error)
  );
});
