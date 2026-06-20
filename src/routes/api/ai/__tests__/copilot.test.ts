import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start/api', () => ({
  createAPIFileRoute: () => (handlers: unknown) => handlers,
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/server/ai-db', () => ({
  touchAiCredential: vi.fn(),
}));

vi.mock('@/server/ai-models', () => ({
  getAiCatalog: vi.fn(),
  resolveLanguageModelForUser: vi.fn(),
}));

import { generateText } from 'ai';
import { getSession } from '@/lib/supabase/server';
import { touchAiCredential } from '@/server/ai-db';
import { getAiCatalog, resolveLanguageModelForUser } from '@/server/ai-models';
import { handleCopilotRequest, normalizeCopilotCompletion } from '../copilot';

const mockedGenerateText = vi.mocked(generateText);
const mockedGetSession = vi.mocked(getSession);
const mockedTouchAiCredential = vi.mocked(touchAiCredential);
const mockedGetAiCatalog = vi.mocked(getAiCatalog);
const mockedResolveLanguageModelForUser = vi.mocked(resolveLanguageModelForUser);

function copilotRequest(body: unknown) {
  return new Request('http://localhost/api/ai/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('AI copilot route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    mockedGetSession.mockResolvedValue(null);

    const response = await handleCopilotRequest(copilotRequest({ prompt: 'Continue this' }));

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
    expect(mockedGetAiCatalog).not.toHaveBeenCalled();
  });

  it('returns 0 for empty prompts without calling the model catalog', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<
      ReturnType<typeof getSession>
    >);

    const response = await handleCopilotRequest(copilotRequest({ prompt: '   ' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: '0' });
    expect(mockedGetAiCatalog).not.toHaveBeenCalled();
  });

  it('returns 400 when no AI models are available', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockedGetAiCatalog.mockResolvedValue({ credentials: [], models: [] });

    const response = await handleCopilotRequest(copilotRequest({ prompt: 'Continue this' }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('No AI models are available for this user.');
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid request bodies', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<
      ReturnType<typeof getSession>
    >);

    const response = await handleCopilotRequest(copilotRequest({ system: 'No prompt' }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Invalid copilot request.');
    expect(mockedGetAiCatalog).not.toHaveBeenCalled();
  });

  it('returns Plate-compatible text from the preferred model', async () => {
    const model = {
      provider: 'openrouter' as const,
      id: 'free-model',
      label: 'free models router',
      source: 'app' as const,
      free: true,
      supports_reasoning_effort: true,
      context_window: null,
    };
    const languageModel = { modelId: 'free-model' };

    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockedGetAiCatalog.mockResolvedValue({ credentials: [], models: [model] });
    mockedResolveLanguageModelForUser.mockResolvedValue({
      model: languageModel as never,
      providerOptions: undefined,
      credentialProvider: 'openrouter',
    });
    mockedGenerateText.mockResolvedValue({ text: ' a useful continuation.' } as Awaited<
      ReturnType<typeof generateText>
    >);

    const response = await handleCopilotRequest(
      copilotRequest({ prompt: 'The policy should', system: 'Complete inline.' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: 'a useful continuation.' });
    expect(mockedResolveLanguageModelForUser).toHaveBeenCalledWith(
      'user-1',
      { provider: 'openrouter', id: 'free-model' },
      'low'
    );
    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: languageModel,
        prompt: 'The policy should',
        system: 'Complete inline.',
        temperature: 0.2,
        maxTokens: 48,
      })
    );
    expect(mockedTouchAiCredential).toHaveBeenCalledWith('user-1', 'openrouter');
  });

  it('normalizes unusable completions to 0', () => {
    expect(normalizeCopilotCompletion('')).toBe('0');
    expect(normalizeCopilotCompletion('0')).toBe('0');
    expect(normalizeCopilotCompletion('- a list item')).toBe('0');
    expect(normalizeCopilotCompletion('" continued text. "')).toBe('continued text.');
  });
});
