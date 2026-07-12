import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAnthropic: vi.fn(),
  createOpenAI: vi.fn(),
  getDecryptedAiCredential: vi.fn(),
  listAiCredentialSummaries: vi.fn(),
  translateText: vi.fn((key: string, fallback?: string) => fallback ?? key),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: mocks.createAnthropic,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mocks.createOpenAI,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: mocks.translateText,
}));

vi.mock('../ai-db', () => ({
  getDecryptedAiCredential: mocks.getDecryptedAiCredential,
  listAiCredentialSummaries: mocks.listAiCredentialSummaries,
}));

import { resolveLanguageModelForUser } from '../ai-models';

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalViteAppUrl = process.env.VITE_APP_URL;
const originalFetch = globalThis.fetch;

function createOpenAiProviderMock() {
  const responseModel = { transport: 'responses' };
  const chatModel = { transport: 'chat' };
  const provider = Object.assign(
    vi.fn(() => responseModel),
    {
      chat: vi.fn(() => chatModel),
    }
  );

  return { chatModel, provider, responseModel };
}

function createAnthropicProviderMock() {
  const model = { transport: 'anthropic' };
  const provider = vi.fn(() => model);

  return { model, provider };
}

function mockOpenRouterCatalog(modelId: string) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: [
          {
            id: modelId,
            name: 'Free Models Router',
            pricing: { prompt: '0', completion: '0' },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  );
}

describe('resolveLanguageModelForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.VITE_APP_URL;
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    if (originalOpenRouterApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
    }

    if (originalViteAppUrl === undefined) {
      delete process.env.VITE_APP_URL;
    } else {
      process.env.VITE_APP_URL = originalViteAppUrl;
    }

    globalThis.fetch = originalFetch;
  });

  it('uses OpenAI-compatible chat completions for app-level OpenRouter free models', async () => {
    process.env.OPENROUTER_API_KEY = 'app-openrouter-key';
    mockOpenRouterCatalog('openrouter/free');
    mocks.getDecryptedAiCredential.mockResolvedValue(null);
    const { chatModel, provider } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);

    const result = await resolveLanguageModelForUser(
      'user-1',
      { provider: 'openrouter', id: 'openrouter/free' },
      'medium'
    );

    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'app-openrouter-key',
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Polity',
      },
    });
    expect(provider.chat).toHaveBeenCalledWith('openrouter/free');
    expect(provider).not.toHaveBeenCalled();
    expect(result).toEqual({
      model: chatModel,
      credentialProvider: null,
    });
  });

  it('uses OpenAI-compatible chat completions for BYOK OpenRouter models', async () => {
    mocks.getDecryptedAiCredential.mockResolvedValue('user-openrouter-key');
    globalThis.fetch = vi.fn();
    const { chatModel, provider } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);

    const result = await resolveLanguageModelForUser(
      'user-1',
      { provider: 'openrouter', id: 'anthropic/claude-sonnet-4.5' },
      'high'
    );

    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'user-openrouter-key',
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Polity',
      },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(provider.chat).toHaveBeenCalledWith('anthropic/claude-sonnet-4.5');
    expect(provider).not.toHaveBeenCalled();
    expect(result).toEqual({
      model: chatModel,
      credentialProvider: 'openrouter',
    });
  });

  it('keeps native OpenAI model resolution on the OpenAI provider', async () => {
    mocks.getDecryptedAiCredential.mockResolvedValue('openai-key');
    const { provider, responseModel } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);

    const result = await resolveLanguageModelForUser(
      'user-1',
      { provider: 'openai', id: 'gpt-4.1-mini' },
      'low'
    );

    expect(mocks.createOpenAI).toHaveBeenCalledWith({ apiKey: 'openai-key' });
    expect(provider).toHaveBeenCalledWith('gpt-4.1-mini');
    expect(provider.chat).not.toHaveBeenCalled();
    expect(result).toEqual({
      model: responseModel,
      credentialProvider: 'openai',
      providerOptions: { openai: { reasoningEffort: 'low' } },
    });
  });

  it('keeps Anthropic model resolution and reasoning provider options', async () => {
    mocks.getDecryptedAiCredential.mockResolvedValue('anthropic-key');
    const { model, provider } = createAnthropicProviderMock();
    mocks.createAnthropic.mockReturnValue(provider);

    const result = await resolveLanguageModelForUser(
      'user-1',
      { provider: 'anthropic', id: 'claude-sonnet-4-5' },
      'high'
    );

    expect(mocks.createAnthropic).toHaveBeenCalledWith({ apiKey: 'anthropic-key' });
    expect(provider).toHaveBeenCalledWith('claude-sonnet-4-5');
    expect(result).toEqual({
      model,
      providerOptions: {
        anthropic: {
          effort: 'high',
        },
      },
      credentialProvider: 'anthropic',
    });
  });
});
