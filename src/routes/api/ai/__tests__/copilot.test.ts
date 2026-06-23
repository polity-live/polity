import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
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
import {
  handleCopilotRequest,
  isCopilotProviderCooldownActive,
  normalizeCopilotCompletion,
  resetCopilotProviderCooldownForTests,
} from '../copilot';

const mockedGenerateText = vi.mocked(generateText);
const mockedGetSession = vi.mocked(getSession);
const mockedTouchAiCredential = vi.mocked(touchAiCredential);
const mockedGetAiCatalog = vi.mocked(getAiCatalog);
const mockedResolveLanguageModelForUser = vi.mocked(resolveLanguageModelForUser);
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

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
    resetCopilotProviderCooldownForTests();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
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

  it('returns 0 when no AI models are available', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockedGetAiCatalog.mockResolvedValue({ credentials: [], models: [] });

    const response = await handleCopilotRequest(copilotRequest({ prompt: 'Continue this' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: '0' });
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

  it('returns Plate-compatible text from openrouter/free when it is available', async () => {
    const alphabeticallyEarlierFreeModel = {
      provider: 'openrouter' as const,
      id: 'cohere/north-mini-code:free',
      label: 'Cohere: North Mini Code (free)',
      source: 'app' as const,
      free: true,
      supports_reasoning_effort: true,
      context_window: null,
    };
    const openRouterFreeModel = {
      provider: 'openrouter' as const,
      id: 'openrouter/free',
      label: 'Free Models Router',
      source: 'app' as const,
      free: true,
      supports_reasoning_effort: true,
      context_window: null,
    };
    const languageModel = { modelId: 'openrouter/free' };

    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockedGetAiCatalog.mockResolvedValue({
      credentials: [],
      models: [alphabeticallyEarlierFreeModel, openRouterFreeModel],
    });
    mockedResolveLanguageModelForUser.mockResolvedValue({
      model: languageModel as never,
      providerOptions: undefined,
      credentialProvider: null,
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
      { provider: 'openrouter', id: 'openrouter/free' },
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
    expect(mockedTouchAiCredential).not.toHaveBeenCalled();
  });

  it('returns 0 when loading the model catalog fails', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockedGetAiCatalog.mockRejectedValue(new Error('Failed to load AI credentials'));

    const response = await handleCopilotRequest(copilotRequest({ prompt: 'Continue this' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: '0' });
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it('returns 0 and starts a cooldown for transient provider failures', async () => {
    const model = {
      provider: 'openrouter' as const,
      id: 'openrouter/free',
      label: 'Free Models Router',
      source: 'app' as const,
      free: true,
      supports_reasoning_effort: true,
      context_window: null,
    };

    mockedGetSession.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockedGetAiCatalog.mockResolvedValue({ credentials: [], models: [model] });
    mockedResolveLanguageModelForUser.mockResolvedValue({
      model: { modelId: 'openrouter/free' } as never,
      providerOptions: undefined,
      credentialProvider: null,
    });
    mockedGenerateText.mockRejectedValue(
      Object.assign(new Error('Provider returned 503'), {
        status: 503,
      })
    );

    const response = await handleCopilotRequest(copilotRequest({ prompt: 'Continue this' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: '0' });
    expect(isCopilotProviderCooldownActive()).toBe(true);

    const responseDuringCooldown = await handleCopilotRequest(
      copilotRequest({ prompt: 'Continue this again' })
    );

    expect(responseDuringCooldown.status).toBe(200);
    await expect(responseDuringCooldown.json()).resolves.toEqual({ text: '0' });
    expect(mockedGetAiCatalog).toHaveBeenCalledTimes(1);
  });

  it('normalizes unusable completions to 0', () => {
    expect(normalizeCopilotCompletion('')).toBe('0');
    expect(normalizeCopilotCompletion('0')).toBe('0');
    expect(normalizeCopilotCompletion('- a list item')).toBe('0');
    expect(normalizeCopilotCompletion('" continued text. "')).toBe('continued text.');
  });
});
